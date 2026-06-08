import {
  addEvent,
  addFollowUp,
  addRelationship,
  findPeople,
  upsertPerson,
  type BraindumpDb,
} from "./db-harness"

// Typed against Genkit without importing it at runtime (these are erased), so
// requiring this module never pulls Genkit's ESM dependency graph.
type Ai = import("genkit").Genkit
type Zod = (typeof import("genkit"))["z"]

/** Build the DB tools the braindump agent calls. They mutate the given db. */
export function makeTools(ai: Ai, z: Zod, db: BraindumpDb) {
  const findPeopleTool = ai.defineTool(
    {
      name: "find_people",
      description:
        "List people already in the database (optionally filtered by a name substring). ALWAYS call this before creating a person, so you can update/merge an existing record (via upsert_person with its id) instead of creating a duplicate.",
      inputSchema: z.object({ query: z.string().optional() }),
      outputSchema: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          description: z.string().optional(),
          labels: z.array(z.string()),
        })
      ),
    },
    async ({ query }) => findPeople(db, query)
  )

  const upsertPersonTool = ai.defineTool(
    {
      name: "upsert_person",
      description:
        "Create a new person, or update an existing one. Pass `id` (from find_people) to update/merge/correct an existing person — e.g. add a last name, fix a typo, add facts, or attach labels. Without `id`, a person with the same name is updated if found, otherwise created. Put facts (role, company, challenges, learnings) into `description`. Only attach labels the user explicitly asked for.",
      inputSchema: z.object({
        id: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        labels: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({ id: z.number() }),
    },
    async (input) => ({ id: upsertPerson(db, input) })
  )

  const logEventTool = ai.defineTool(
    {
      name: "log_event",
      description:
        "Record a meeting/encounter that happened at a point in time. `occurredAt` MUST be an absolute date YYYY-MM-DD — resolve relative times ('yesterday', 'last Friday', 'two weeks ago') against the reference time you were given. `attendees` are full names; each is matched to an existing person or created. Use ONE event with multiple attendees for a group meeting.",
      inputSchema: z.object({
        title: z.string(),
        occurredAt: z.string(),
        context: z.string().optional(),
        notes: z.string().optional(),
        attendees: z.array(z.string()),
      }),
      outputSchema: z.object({ id: z.number() }),
    },
    async (input) => ({ id: addEvent(db, input) })
  )

  const addRelationshipTool = ai.defineTool(
    {
      name: "add_relationship",
      description:
        "Link two people (e.g. coworker, manager, 'introduced by', 'went to school together'). For directional links such as manager/report, state the direction in `note` (e.g. 'A reports to B').",
      inputSchema: z.object({
        personA: z.string(),
        personB: z.string(),
        type: z.string(),
        note: z.string().optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
    },
    async (input) => {
      addRelationship(db, input)
      return { ok: true }
    }
  )

  const addFollowUpTool = ai.defineTool(
    {
      name: "add_follow_up",
      description:
        "Record a commitment. `owner` is 'you' (you owe them) or 'them' (they owe you). `due` is an absolute date YYYY-MM-DD when known.",
      inputSchema: z.object({
        person: z.string(),
        summary: z.string(),
        owner: z.enum(["you", "them"]),
        due: z.string().optional(),
        done: z.boolean().optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
    },
    async (input) => {
      addFollowUp(db, input)
      return { ok: true }
    }
  )

  return [
    findPeopleTool,
    upsertPersonTool,
    logEventTool,
    addRelationshipTool,
    addFollowUpTool,
  ]
}
