# Plan — Making Braindump Real (API + Schema)

Turn the mocked Braindump UI and the `conversations/*.json` eval fixtures into a
working product: a real database, a real agent that writes to it, and a real API
the UI reads from.

This document covers **the database schema and the API contract** — the
foundation. The agent prompt/flow design and the frontend swap are scoped as
later phases (see [Roadmap](#roadmap)).

---

## 1. The core idea

The fixtures' `expectedDb`, the UI's `mock-data.ts`, and `db/schema.ts` are three
views of one system. The unifying principle:

> **Chat is the only write path. The agent's DB tools _are_ the write API.
> Everything else is read-only queries.**

```
                      ┌─────────────────────────────────────────┐
   POST /api/chat ───▶│  Braindump agent (Genkit + Gemini 3.5)   │
   { message, now }   │  defineFlow → generate({ tools, now })   │
                      └───────────────┬──────────────────────────┘
                                      │ SQL tool calls (the ONLY mutations)
                                      ▼
   GET /api/people     ◀──────  repository.ts (Drizzle queries)  ──────▶  SQLite
   GET /api/people/:id ◀──────  (pure reads power the views)
   GET /api/timeline   ◀──────
   GET /api/follow-ups ◀──────
```

A single `createAgent(db)` factory + `repository.ts` is driven by **two callers**:

- the live `POST /api/chat` endpoint (persistent file DB), and
- the eval harness `run-conversation.ts` (a fresh in-memory DB per fixture).

Building this engine once makes **both** the fixtures and the UI real, because
they share it.

---

## 2. Decisions

| Decision | Choice |
| --- | --- |
| **Backend topology** | Embedded Express server under `app/server/`. One Node process: Genkit chat flow + REST reads, sharing the Drizzle layer with the eval harness. Vite dev-proxies `/api`. |
| **Schema depth** | Enriched — add the 4 fields below so primary-contact, per-attendee attribution, and approximate dates are structured data the UI can render (not buried in prose). |
| **Reads** | Plain REST queries, not agent calls. Chat is the only *write* path; views are pure reads. |
| **Agent ↔ DB interface** | Generic, guarded **SQL tools** (`queryDb` / `executeDb`) plus the live DB schema in the system prompt — *not* a surface of granular typed tools. Chosen for simplicity and flexibility. |
| **Response shapes** | Identical to the existing `mock-data.ts` interfaces, so the frontend swap is import-only. |
| **Auth / multi-user** | Out of scope. Single local user, single chat thread. |

---

## 3. Database schema

`app/src/db/schema.ts` already covers ~90% of the fixtures: `people`, `labels`
(+ `personLabels`), `events`, `eventAttendees`, `messages`, `followUps`,
`personRelationships`. Only four fields are missing.

### Deltas to add

```ts
// events — preserve the user's phrasing + mark precision for honest recall
occurredAtText: text("occurred_at_text"),                       // "about two weeks ago"
occurredAtPrecision: text("occurred_at_precision", {
  enum: ["exact", "day", "approximate"],
}).notNull().default("day"),

// event_attendees — per-attendee facts within ONE shared meeting
// (PK stays the (eventId, personId) pair)
role: text("role"),   // "primary contact" (fixture 07), "speaker", …
note: text("note"),   // what THIS attendee said/did (fixture 05 re-attribution)

// follow_ups — preserve due phrasing
dueText: text("due_text"),                                      // "end of next week"
```

After editing: `npm run db:generate` (new migration), and the eval harness
migrates a fresh in-memory DB from the same migration files.

### Deliberately NOT added

- **`people.notes`** — `description` already carries the rapport blurb; the
  `notes` field in `expectedDb` is judge-guidance, not a column.
- **users / sessions / auth tables** — out of scope.

### Relationship direction (convention, no column change)

`manager` / `reports to` is **not** symmetric (fixture 06), so:

> Stored and read **left-to-right: `personA <type> personB`**.
> "Maya reports to Ravi" → `personA = Maya, personB = Ravi, type = "reports to"`.
> Symmetric types (`coworker`, `went to school together`) are stored once in
> either order.

Ship a small `type` vocabulary the agent picks from (rather than free-form
strings) so the UI renders direction consistently.

---

## 4. API contract

Base path `/api`, proxied by Vite in dev. All response shapes equal the existing
`mock-data.ts` interfaces (`Person`, `TimelineEntry`, `FollowUp`,
`RelatedPerson`, `ChatMessage`).

### Write — the only mutation entry

| Method | Endpoint | Body → Returns |
| --- | --- | --- |
| `POST` | `/api/chat` | `{ message: string; now?: string }` → `{ userMessage: ChatMessage; reply: ChatMessage; touched: string[] }` |
| `GET` | `/api/chat/messages` | → `ChatMessage[]` (the thread; replaces `mockMessages`) |
| `POST` | `/api/chat/reset` | dev-only: wipe + reseed. Optional. |

`POST /api/chat`: load history → run the Genkit flow with the agent's SQL tools
→ persist the user turn + assistant reply → return the reply plus `touched` (the
tables `executeDb` wrote to, so the client can refetch the affected views).
`now` defaults to server clock on the live endpoint; the eval harness passes
`fixture.now`.

> **Determinism rule:** relative dates are resolved by the *model* from the
> injected `now`, never from a clock read inside a tool. This is what keeps the
> evals reproducible.

### Read — views

| Method | Endpoint | Returns | Surface |
| --- | --- | --- | --- |
| `GET` | `/api/people?q=` | `Person[]` (labels + events nested) | Dictionary |
| `GET` | `/api/people/:id` | `{ person: Person; relations: RelatedPerson[]; followUps: FollowUp[] }` | Person detail |
| `GET` | `/api/timeline` | `TimelineEntry[]` (most recent first) | Timeline |
| `GET` | `/api/follow-ups` | `FollowUp[]` | Follow-ups |

Two modeling improvements the real API gives us over the mock:

- **Timeline de-duplication.** A 3-attendee meeting is one row (with all
  attendee names), not one per person as the nested mock would produce
  (fixtures 02, 07).
- **Attendee names vs ids.** Tables store `personId`; the read layer resolves to
  the `string[]` of names the UI expects, and for `/people/:id` excludes the
  person themselves from their own events' `attendees`.

### Writes go through the agent

There are **no granular write endpoints and no per-entity tools**. Every mutation
happens inside the agent via two generic SQL tools — see
[§5 The braindump agent](#5-the-braindump-agent). `repository.ts` still provides
the typed read queries that power the REST views above (and the retention prune),
plus the guarded SQL primitives the agent's tools wrap.

---

## 5. The braindump agent

The agent is the **write engine**: it handles the conversation and is the only
thing that mutates the DB. Design choice (for simplicity and flexibility): **give
the model the live DB schema in its system prompt and expose generic SQL tools**,
rather than a large surface of typed per-entity tools. The model writes its own
SELECTs and INSERT/UPDATE/DELETEs.

### Tools — two, both raw SQL against the app's SQLite DB

- `queryDb({ sql, params? })` → `{ rows }` — **read-only** (SELECT / WITH only).
  Powers recall ("who did I meet about X?") and, crucially, dedup / merge /
  correction: the agent SELECTs an existing person *before* deciding INSERT vs
  UPDATE. This is how "Jordan" → "Jordan Lee" (04) and "Theo" → "Teo" (02) stay
  one record.
- `executeDb({ sql, params? })` → `{ changes, lastInsertRowid }` —
  INSERT / UPDATE / DELETE. Every write goes through here.

Both use `better-sqlite3` **prepared statements** (single statement only — no
stacked queries) bound to the DB instance handed to `createAgent(db)`. The tools
live in `repository.ts` as guarded primitives; `agent.ts` wraps them as Genkit
tools.

### System prompt carries

1. **The live schema** — injected as the actual `CREATE TABLE` DDL read from the
   DB at agent-build time (`SELECT sql FROM sqlite_master WHERE type='table'`), so
   it can never drift from `schema.ts`. Includes enums and column meanings.
2. **`now`** (the reference timestamp) with the rule: resolve every relative date
   ("yesterday", "end of next week") to a concrete ISO date *yourself* and write
   it; when approximate, also set `occurred_at_text` + `occurred_at_precision`.
3. **The relationship convention** — `personA <type> personB`; symmetric types
   stored once.
4. **Behavior rules** from `bank/` — confirm what was captured, ask one enriching
   question, **query-before-insert** to avoid duplicate people, and never invent
   a follow-up the user declined (01).

### Flow & turn handling

- `braindumpFlow({ message, now, history })` → `{ reply, touched }`. Inside it:
  `ai.generate({ system, messages: history, prompt: message, tools: [queryDb,
  executeDb], config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } })`.
- The Genkit tool loop (`maxTurns`, default 5) lets the model **query → reason →
  execute → confirm**, self-correcting on SQL errors — errors are returned to the
  model as the tool result so it can fix its statement within the loop.
- **One transaction per chat turn:** wrap the flow so a turn that throws rolls
  back — no half-applied braindumps.

### Guardrails (raw LLM SQL, kept minimal)

- `queryDb` rejects anything but `SELECT`/`WITH`; `executeDb` rejects
  `DROP`/`ALTER`/`CREATE`/`PRAGMA`/`ATTACH`. Single statement each.
- `foreign_keys = ON`; the per-turn transaction bounds the blast radius.
- Acceptable because this is a single-user local store — revisit before any
  multi-tenant deployment.

### Shared by both callers

`createAgent(db)` is built once and used by the live `POST /api/chat`
(persistent file DB) **and** by `run-conversation.ts` (a fresh in-memory DB per
fixture, passing `fixture.now`). After a run, the eval harness reads the DB back
into a `DbState` via the same typed read queries that power the REST API, and
`judge.ts` scores it. This is why one agent makes both the fixtures and the UI
real.

---

## 6. File layout

```
app/
  server/
    index.ts            # express app, mounts /api; expressHandler(chatFlow) + read routes
    routes/
      chat.ts           # POST /api/chat, GET /api/chat/messages
      reads.ts          # GET /api/people, /people/:id, /timeline, /follow-ups
    cron.ts             # daily retention job (node-cron, 00:00 UTC)
  src/
    db/
      schema.ts          # + the 4 fields above
      index.ts           # existing connection
      repository.ts      # NEW — typed read queries (REST + prune) + guarded SQL primitives (queryDb/executeDb)
    agent/
      agent.ts           # NEW — createAgent(db) → genkit instance, SQL tools, braindumpFlow
      config.ts          # existing (model + generation config)
      run-conversation.ts # wire to createAgent + in-memory DB
      judge.ts            # wire to ai.generate
      types.ts            # existing
```

`repository.ts`, `schema.ts`, and `agent.ts` live under `src/` so the Jest eval
harness and the Express server share one implementation. The server runs as a
separate Node process (Vite only bundles `src/`).

New dependencies for later phases: `express`, `@genkit-ai/express`, `node-cron`,
`tsx` (for a `dev:api` script). `genkit` + `@genkit-ai/google-genai` +
`better-sqlite3` + `drizzle-orm` are already installed.

---

## 7. Retention cron (daily cleanup)

A scheduled job prunes old conversation data so the store doesn't grow without
bound.

- **Schedule:** every day at **00:00 UTC** (`node-cron`, cron expr `0 0 * * *`,
  `{ timezone: "UTC" }`), run inside the embedded Express process (`server/cron.ts`).
- **What it deletes:** chat messages older than **30 days**
  (`messages.createdAt < now − 30d`). The raw transcript is the disposable part;
  the agent's **derived memory — people, events, attendees, labels, follow-ups,
  relationships — is kept**, because durable recall is the whole point of the
  product. (Flag: if you'd rather delete the derived records too, say so — this
  is the one judgment call in the cron.)
- **Implementation:** a single repository function does the work and the cron is
  a thin wrapper around it, so it's unit-testable without the scheduler:

  ```ts
  // repository.ts
  pruneOldMessages({ olderThanDays = 30, now = new Date() }): { deleted: number }
  ```

  ```ts
  // server/cron.ts
  cron.schedule("0 0 * * *", () => repo.pruneOldMessages({ olderThanDays: 30 }),
    { timezone: "UTC" })
  ```

- **Determinism / testing:** `pruneOldMessages` takes `now` as a parameter (not a
  clock read), so a Jest test can assert the 30-day cutoff exactly — same pattern
  as the agent's injected `now`.
- **Optional:** expose `POST /api/admin/prune` (dev-only) to trigger it manually.

> Note: "conversation" here is the runtime chat log in the `messages` table — not
> the `conversations/*.json` eval fixtures, which are source-controlled test data
> and untouched by this job.

---

## 8. Roadmap

This document delivers **Phase 0** (schema + API contract). Subsequent phases:

1. **Schema + repository** — apply the 4 deltas, `db:generate` the migration,
   write `repository.ts` (the read/write core).
2. **Agent** — two SQL tools (`queryDb`/`executeDb`) + schema-in-prompt +
   `braindumpFlow`; wire `run-conversation.ts` (fresh in-memory DB) and
   `judge.ts` (real model call). Drive the 7 fixtures green — they *are* the test
   suite (a `/implement` job).
3. **Express server** — `@genkit-ai/express` `expressHandler` for `/api/chat`,
   plain routes for reads; Vite proxy for `/api`. Add the daily retention cron
   (`server/cron.ts` + `repository.pruneOldMessages`).
4. **Frontend swap** — a `lib/api.ts` client; `App.tsx` fetches on mount; chat
   `POST`s instead of `cannedReply`.

---

## 9. Genkit reference (verified against installed v1.36)

`genkit@^1.36.0` and `@genkit-ai/google-genai@^1.36.0` are in `app/package.json`.

- **Init:** `genkit({ plugins: [googleAI()], model: googleAI.model('gemini-3.5-flash') })`
- **Model config:** `config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } }`
  — matches `app/src/agent/config.ts` exactly. Model id `googleai/gemini-3.5-flash`.
- **Tools:** `ai.defineTool({ name, description, inputSchema, outputSchema }, fn)`;
  pass `tools: [...]` to `ai.generate`. Tool loop auto-runs; `maxTurns` (default
  5) caps iterations; `returnToolRequests: true` for manual handling.
- **History:** use the stateless `messages: MessageData[]` array on
  `ai.generate` (we own persistence in the DB) — **not** the beta
  `ai.chat()`/session API (`genkit/beta`, needs a Genkit-managed store).
- **HTTP:** `@genkit-ai/express` (separate install) → `expressHandler(flow)` to
  mount on an existing Express app, or `startFlowServer(...)`.
- **System prompt:** `ai.generate({ system, prompt, ... })`.

---

## 10. Fixture coverage

How each `conversations/*.json` maps onto the schema/API:

| Fixture | Exercises | Handled by |
| --- | --- | --- |
| 01-meetup-short | single person/event, "tonight"=today, no invented follow-up | base tables; model resolves date from `now` |
| 02-conference-long | relative dates, person merge, multi-attendee event, coworker rel, name correction, labels, follow-up | `findPeople`+`updatePerson` (merge/correction), `eventAttendees`, `dueText` |
| 03-relative-dates | several relative + approximate dates | `occurredAtText` / `occurredAtPrecision` |
| 04-person-merge | partial name → full name, one record | `findPeople` + `updatePerson` |
| 05-corrections | re-attribution + fact correction | `eventAttendees.note` per person; `updateEvent` |
| 06-relationships | directional manager link, school link, person added later | relationship convention (`personA <type> personB`) |
| 07-multi-person-meeting | one event/several attendees, group coworkers, primary contact | shared event + `eventAttendees.role = "primary contact"` |
