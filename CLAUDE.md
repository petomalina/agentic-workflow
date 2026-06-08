# Agentic Workflow — Braindump

This repo holds a product and its living documentation:

- **`bank/`** — the **Product Memory Bank**: a Vite + React app that renders MDX
  docs (personas, intents, flows, surfaces). It is the source of truth for *what*
  we're building and *why*. Ground feature work here before touching `app/`.
- **`app/`** — **Braindump**: the product itself. A person braindumps meetings
  and conferences via chat; an (eventually LLM-based) agent organizes who they
  met, what was discussed, when, and who else was there, so they can recall it
  and build rapport.

There is **no root package.json** — `bank/` and `app/` are independent projects,
each installed and run on its own.

## Layout

```
bank/                 # Memory Bank viewer (Vite + React + MDX + shadcn/ui)
  personas/*.mdx       # who we build for
  intents/*.mdx        # what they want to do (user + agent intents)
  flows/*.mdx          # how a session plays out
  surfaces/*.mdx       # where the product lives (chat, dictionary, timeline, follow-ups)
  src/                 # the viewer app (sidebar + MDX renderer)
app/                  # Braindump app (Vite + React + shadcn/ui + Drizzle + Jest)
  src/components/      # surfaces: chat-window, people-directory, timeline, follow-ups, person-detail
  src/lib/mock-data.ts # the app runs on MOCK data for now
  src/db/              # Drizzle schema + connection — SCAFFOLDING, not wired to the UI yet
  src/agent/           # Genkit + Vertex AI agent + LLM-judged eval harness
  drizzle/             # generated migrations (after db:generate)
conversations/        # agent eval fixtures: one JSON per scenario, each with the
                      # expected user/agent transcript AND expected final DB state
```

## Commands

Run inside `bank/` or `app/`:

| Command | What |
| --- | --- |
| `npm run dev` | Vite dev server with HMR / React Fast Refresh |
| `npm run build` | `tsc -b` typecheck + production `vite build` |
| `npm run lint` | `tsc --noEmit` |
| `npm test` *(app only)* | Jest unit + component tests |
| `npm run db:generate` *(app only)* | Generate SQL migrations from `src/db/schema.ts` |
| `npm run db:migrate` *(app only)* | Apply migrations |
| `npx playwright test --reporter=line` | e2e tests (never serve the HTML report) |

When running **both** dev servers at once, give them different ports
(`npm run dev -- --port 5174`) — Vite defaults both to 5173.

## Stack & conventions

- **shadcn/ui** (new-york style, neutral base) on **Tailwind CSS v4**. Add or
  update components with the **CLI** — `npx shadcn@latest add <name>` — never
  hand-write them. v4 has no `tailwind.config.js`; theme lives in
  `src/index.css`. Components import from the unified `radix-ui` package.
- **`@` path alias** → `src/` (Vite alias + tsconfig `paths`, no `baseUrl`).
- **MDX** (`bank/` only) via `@mdx-js/rollup`; the plugin must run **before**
  `@vitejs/plugin-react` (`enforce: "pre"`), and `.mdx` is in the react plugin's
  `include` so MDX hot-reloads. Frontmatter (`title`, `description`) is exported
  via `remark-mdx-frontmatter` and drives the sidebar. Add a doc by dropping a
  new `.mdx` file into a category folder — it's picked up automatically.
- **Drizzle + better-sqlite3** (`app/`): schema in `src/db/schema.ts`. It is
  scaffolding only — the UI uses `src/lib/mock-data.ts`. Wire `src/db/index.ts`
  in when adding persistence.
- **Jest** (`app/`) with ts-jest + Testing Library (jsdom). Tests are
  `*.test.ts(x)` under `src/`. UI tests go in Playwright, unit/logic tests in
  Jest.

## Product model (see `bank/`)

- **Chat** is the only way to capture or edit. Everything else is read-only.
- Surfaces: **Chat** (capture), **Dictionary** (per-person recall),
  **Timeline** (chronological, event-centric recall), **Follow-ups**
  (commitments the agent extracts). A *company/context map* is a documented
  future surface.
- The agent is meant to be LLM-based and tool-using: parse a braindump → extract
  people/events/attendees/labels → ask clarifying questions to enrich rapport →
  write via DB tools → answer recall by querying.

## Agent tech stack

The braindump agent (not yet wired up — UI runs on mock data) is built with:

- **Google Genkit** (`genkit` + `@genkit-ai/google-genai`) — agent/flow framework
  and tool calling.
- **Gemini 3.5 Flash via Vertex AI.** Initialize the Vertex plugin (`vertexAI()`)
  and rely on this machine's **preconfigured GCP project + Application Default
  Credentials** — no API keys in code, expect it to be set up. Reference the
  model with `vertexAI.model("gemini-3.5-flash")`.
- **temperature `0`** and **thinking budget `0`**
  (`config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } }`) — keep
  extraction, recall, and judging deterministic and fast, not exploratory.

Tools the agent uses are the Drizzle/SQLite operations over `src/db/schema.ts`
(create/update people, events, attendees, labels, relationships, follow-ups;
query for recall).

### Agent evals

`conversations/*.json` are eval fixtures — each is one scenario (`now` anchor,
the full expected user/agent `turns`, the expected final `expectedDb`, and
natural-language `assertions`). They cover edge cases: relative dates, merging a
person mentioned across turns, corrections/re-attribution, relationships, and
multi-attendee meetings.

The harness lives in `app/src/agent/`:
- `config.ts` — model + deterministic settings (Vertex `gemini-3.5-flash`, temp 0, thinking 0).
- `db-harness.ts` — a fresh in-memory SQLite per run (migrated from `src/db/schema.ts`) plus a `DbState` readback.
- `tools.ts` — the DB tools the agent calls (find/upsert person, log event, add relationship, add follow-up).
- `run-conversation.ts` — replays a fixture's user turns through the agent, returning the transcript + DB snapshot.
- `judge.ts` — the **LLM-as-judge**; the full conversation + expected + actual are always sent to it (the dataset is small, so no trimming).
- `conversations.test.ts` — validates every fixture's shape on every `npm test`, and (opt-in) runs the judged evals.
- `judge.test.ts` — validates the judge itself: correct data passes (true positive, no false negative) and wrong data fails (no false positive).

`run-conversation` and `judge` are implemented with Genkit + Vertex AI, so the
judged evals need the preconfigured Vertex project (ADC; the model is served from
the `GOOGLE_CLOUD_LOCATION` — `global` here). They are opt-in: run
`npm run test:evals`, or target one case by id:
`RUN_AGENT_EVALS=1 npx jest -t "04-person-merge" --forceExit`. (`--forceExit`
because Genkit's tracing keeps the process open; the agent tests use the `node`
Jest environment so Genkit's deps resolve to their CommonJS builds.) Fixture-shape
validation runs on every `npm test`.
