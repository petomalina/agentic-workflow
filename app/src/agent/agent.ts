/**
 * The braindump agent — the product's write engine.
 *
 * Design (see plan §5): the model is given the LIVE database schema in its
 * system prompt and two generic, guarded SQL tools (`queryDb` / `executeDb`).
 * It writes its own SELECTs (for dedup/merge/correction) and INSERT/UPDATE/
 * DELETEs. There are no granular per-entity tools. This single `createAgent`
 * is driven by both callers — the live `POST /api/chat` endpoint and the eval
 * harness `run-conversation.ts` — so one engine makes the UI and the fixtures
 * real.
 */
import { vertexAI } from "@genkit-ai/google-genai"
import { genkit, z, type MessageData } from "genkit"
import type Database from "better-sqlite3"

import { executeDb, queryDb } from "../db/repository"
import { AGENT_CONFIG, AGENT_MODEL } from "./config"

/** Read the live CREATE TABLE DDL so the prompt can never drift from schema.ts. */
function readSchemaDdl(sqlite: Database.Database): string {
  const rows = sqlite
    .prepare(
      `SELECT sql FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name != '__drizzle_migrations'
       ORDER BY name`
    )
    .all() as { sql: string }[]
  return rows.map((r) => r.sql).join(";\n\n")
}

function weekdayOf(now: string): string {
  const datePart = now.slice(0, 10)
  const date = new Date(`${datePart}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return "unknown weekday"
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  })
}

function buildSystemPrompt(ddl: string, now: string): string {
  return `You are Braindump's capture agent. The user braindumps the people they
meet and the meetings/conferences they attend. You turn that into structured,
durable records in a SQLite database and reply conversationally. The chat is the
ONLY way to capture or edit — so every fact the user states must be persisted by
you via the tools, and you must never claim you saved something you did not
actually write.

## Your tools (the only way to persist)
- queryDb({ sql }) — read-only (SELECT / WITH). Use it to look things up BEFORE
  writing: check whether a person/event/label already exists.
- executeDb({ sql }) — INSERT / UPDATE / DELETE. Every mutation goes through here.
Both run a single statement. If a statement fails, the error is returned to you —
read it and fix your SQL, do not give up. Inline ALL literal values directly in
the SQL (there are no bind parameters); escape a single quote in a string by
doubling it ('O''Brien').

## The live database schema
${ddl}

## Reference time
Now is ${now} (a ${weekdayOf(now)}). Resolve EVERY relative time expression
yourself against this anchor; never read a clock. Direction depends on what you
are dating:
- PAST events (meetings/encounters you are recording) resolve BACKWARD:
  "tonight"/"this morning" → today, "yesterday"/"last night" → the day before,
  "last Thursday" → the most recent past Thursday, "about two weeks ago" → ~14
  days back.
- FUTURE commitments (follow-up due dates, plans) resolve FORWARD: a bare
  weekday like "by Friday" → the NEXT upcoming Friday, "end of next week" → the
  Friday of the following week, "in two weeks" → ~14 days ahead.

Store dates in the integer epoch-seconds columns using SQLite's date function:
write \`unixepoch('YYYY-MM-DD')\` (e.g. \`unixepoch('2026-06-09')\`) for
occurred_at and due_at. Also:
- Set events.occurred_at_text to the user's original phrasing and
  events.occurred_at_precision to 'exact' (a time was given), 'day' (you know the
  calendar day), or 'approximate' ("about two weeks ago").
- Set follow_ups.due_text to the user's original phrasing for the due date.

## Rules
1. QUERY BEFORE INSERT. Before creating a person, SELECT to see if they already
   exist — match on name, and recognize a first-name-only mention ("Jordan") and
   a later full name ("Jordan Lee") as the SAME person: UPDATE that one row, do
   not create a second. When the user corrects a name ("it's Teo, not Theo"),
   UPDATE the existing person — no duplicate may remain.
2. ONE EVENT PER MEETING. A meeting with several people is ONE row in events with
   one event_attendees row per person — never one event per attendee. Put what a
   specific attendee said/did in event_attendees.note, and a role like
   'primary contact' or 'speaker' in event_attendees.role. When someone has a
   notable role (e.g. the primary point of contact), ALSO record it in that
   person's people.description so it surfaces in recall, not only on the event.
3. CORRECTIONS UPDATE, they don't append. If the user re-attributes a fact from
   one person to another, or changes a fact ("not blocked — delayed a week"),
   UPDATE the records so the contradictory version is gone.
4. RELATIONSHIPS are stored left-to-right as personA <type> personB in
   person_relationships:
   - Manager/report: store personA = the person who reports, personB = the
     manager, type = 'manager', and a note like 'Maya reports to Ravi'.
   - Symmetric links ('coworker', 'went to school together', 'introduced by')
     are stored once. If several people are all mutual coworkers, insert one row
     for each unique pair.
   To reference people/events by id, use subqueries on their natural keys, e.g.
   (SELECT id FROM people WHERE name = 'Marcus Webb'), or the lastInsertRowid
   returned by executeDb.
5. LABELS: labels.name is unique. Reuse existing labels — \`INSERT OR IGNORE INTO
   labels(name) VALUES('finch')\` then link via person_labels (look the ids up).
6. NEVER invent a follow-up. Only create a follow_up row when the user states a
   real commitment ("I'll send them X", "they'll review Y"). If the user declines
   ("no follow-up"), create none. owner is 'you' or 'them'.
7. ASK, don't guess, when a material detail is genuinely ambiguous — and don't
   persist the guessed value. In particular, if the user gives a date RANGE
   ("last Thursday and Friday") and it's unclear which day a specific meeting
   happened, ASK which day before setting that event's date (you can still
   create the person now). Resolve the date once they answer.
8. A person only REFERENCED in passing (e.g. as the far end of a relationship —
   "Ravi went to school with my old colleague Sam") is not necessarily someone to
   track. OFFER to add them and WAIT — do not create that person or the
   relationship until the user confirms. Once they say yes, create the person and
   the relationship.

## Your reply
After persisting, confirm in one or two sentences WHAT you captured. Whenever you
log or mention an event, state its CONCRETE resolved date in the reply (e.g.
"yesterday (Jun 8)", "today (Jun 9)", "around May 26") — never leave a relative
phrase unresolved. When natural, ask exactly ONE clarifying question that would
build rapport (a challenge they face, a personal detail, a follow-up). When the
user signals they're finished ("that's it", "that's everything"), give a brief
confirmation with no new question. Keep replies short and concrete.`
}

/**
 * Build Genkit history from the plain text thread (user → "user", assistant →
 * "model"). Used to seed the live `/api/chat` route's working context on a cold
 * start (text turns only — the DB is the source of truth, so the agent
 * re-queries it). After that, both the live route and the eval harness carry the
 * agent's full returned `messages` (with tool-call parts) forward each turn.
 */
export function toMessageHistory(
  turns: { role: "user" | "assistant"; content: string }[]
): MessageData[] {
  return turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    content: [{ text: t.content }],
  }))
}

export interface RespondInput {
  message: string
  now: string
  history: MessageData[]
}

export interface RespondResult {
  reply: string
  /** Full message history including this turn — feed back in as `history`. */
  messages: MessageData[]
  /** Tables that executeDb wrote to this turn, so the client can refetch. */
  touched: string[]
}

/** Pull the target table out of a mutating statement, for `touched`. */
const WRITE_TABLE =
  /^\s*(?:insert(?:\s+or\s+\w+)?\s+into|update|delete\s+from)\s+["'`]?(\w+)/i

function tableOf(sql: string): string | undefined {
  return WRITE_TABLE.exec(sql)?.[1]?.toLowerCase()
}

export interface BraindumpAgent {
  respond(input: RespondInput): Promise<RespondResult>
}

/**
 * Build the agent over a SQLite connection. The two SQL tools are bound to this
 * exact connection; the schema DDL is read from it at build time.
 */
export function createAgent(sqlite: Database.Database): BraindumpAgent {
  const ai = genkit({
    plugins: [
      vertexAI({ location: process.env.GOOGLE_CLOUD_LOCATION ?? "global" }),
    ],
  })

  const ddl = readSchemaDdl(sqlite)

  const queryDbTool = ai.defineTool(
    {
      name: "queryDb",
      description:
        "Run a read-only SQL query (SELECT or WITH only) against the braindump database and get the rows back. Use it to check for existing people, events, or labels before writing.",
      inputSchema: z.object({
        sql: z
          .string()
          .describe("A single SELECT or WITH statement, with all values inlined."),
      }),
      outputSchema: z.object({
        rows: z.array(z.any()),
        error: z.string().optional(),
      }),
    },
    async ({ sql }) => {
      try {
        return queryDb(sqlite, sql)
      } catch (e) {
        return { rows: [], error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  const executeDbTool = ai.defineTool(
    {
      name: "executeDb",
      description:
        "Run a single INSERT, UPDATE, or DELETE statement against the braindump database. This is the only way to persist. Returns the number of changed rows and the last inserted row id.",
      inputSchema: z.object({
        sql: z
          .string()
          .describe(
            "A single INSERT, UPDATE, or DELETE statement, with all values inlined."
          ),
      }),
      outputSchema: z.object({
        changes: z.number(),
        lastInsertRowid: z.number(),
        error: z.string().optional(),
      }),
    },
    async ({ sql }, ctx) => {
      try {
        const result = executeDb(sqlite, sql)
        const touched = (ctx?.context?.touched as Set<string> | undefined)
        const table = tableOf(sql)
        if (touched && table) touched.add(table)
        return result
      } catch (e) {
        return {
          changes: 0,
          lastInsertRowid: 0,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
  )

  return {
    async respond({ message, now, history }) {
      const touched = new Set<string>()
      const response = await ai.generate({
        model: vertexAI.model(AGENT_MODEL),
        config: AGENT_CONFIG,
        system: buildSystemPrompt(ddl, now),
        // Carry prior turns (incl. tool calls); drop any system message so it is
        // not duplicated alongside the `system` option.
        messages: history.filter((m) => m.role !== "system"),
        prompt: message,
        tools: [queryDbTool, executeDbTool],
        context: { touched },
        maxTurns: 25,
      })

      return {
        reply: response.text,
        messages: response.messages,
        touched: [...touched],
      }
    },
  }
}
