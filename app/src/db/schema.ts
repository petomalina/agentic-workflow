import { relations, sql } from "drizzle-orm"
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

/**
 * Braindump schema.
 *
 * This is scaffolding only — the UI currently runs on mock data
 * (see `src/lib/mock-data.ts`). Generate migrations with `npm run db:generate`
 * and apply them with `npm run db:migrate` once persistence is wired up.
 *
 * Domain model: a user braindumps via chat. An LLM agent turns those messages
 * into structured records — people, the events (meetings/encounters) where they
 * were met, who else attended, and the labels that describe them. Editing only
 * ever happens through the chat, so the `messages` table is the source log and
 * everything else is the agent's derived, queryable state.
 */

/** People you meet with and braindump about. */
export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
})

/** Reusable tags applied to people (e.g. "investor", "mentor"). */
export const labels = sqliteTable("labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color"),
})

/** Many-to-many join between people and labels. */
export const personLabels = sqliteTable(
  "person_labels",
  {
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.personId, table.labelId] })]
)

/**
 * An event — a meeting, call, or encounter that happened at a point in time.
 * It is not owned by a single person; attendees are joined via `eventAttendees`
 * so a meeting can involve several people.
 */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  notes: text("notes"),
  /** e.g. the conference or context where it took place. */
  context: text("context"),
  occurredAt: integer("occurred_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** The user's original phrasing for when it happened ("about two weeks ago"). */
  occurredAtText: text("occurred_at_text"),
  /** How precisely the date is known, so recall can stay honest. */
  occurredAtPrecision: text("occurred_at_precision", {
    enum: ["exact", "day", "approximate"],
  })
    .notNull()
    .default("day"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

/** Who attended an event (many-to-many people <-> events). */
export const eventAttendees = sqliteTable(
  "event_attendees",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** This attendee's role in the meeting, e.g. "primary contact", "speaker". */
    role: text("role"),
    /** What THIS attendee specifically said or did (per-attendee attribution). */
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.personId] })]
)

/**
 * The raw chat log. Each braindump message is stored here; the agent reads it,
 * extracts people/events/labels, and writes them to the tables above.
 */
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  /** Optional link to the event a message produced or refined. */
  eventId: integer("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Commitments the agent extracts from braindumps ("I owe them X", "they'll do
 * Y"). Surfaced read-only in the Follow-ups view; completed via chat.
 */
export const followUps = sqliteTable("follow_ups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  owner: text("owner", { enum: ["you", "them"] }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp" }),
  /** The user's original phrasing for the due date ("end of next week"). */
  dueText: text("due_text"),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Person-to-person relationships ("they work together", "she introduced us").
 * Stored and read left-to-right: `personA <type> personB`. Directional types
 * (e.g. "reports to", "manager") respect that order — "Maya reports to Ravi" is
 * (personA = Maya, personB = Ravi). Symmetric types ("coworker", "went to school
 * together") are stored once in either order.
 */
export const personRelationships = sqliteTable("person_relationships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personAId: integer("person_a_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  personBId: integer("person_b_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  // e.g. "coworker", "manager", "introduced by"
  type: text("type").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const peopleRelations = relations(people, ({ many }) => ({
  personLabels: many(personLabels),
  eventAttendees: many(eventAttendees),
  followUps: many(followUps),
  relationshipsAsA: many(personRelationships, { relationName: "personA" }),
  relationshipsAsB: many(personRelationships, { relationName: "personB" }),
}))

export const labelsRelations = relations(labels, ({ many }) => ({
  personLabels: many(personLabels),
}))

export const personLabelsRelations = relations(personLabels, ({ one }) => ({
  person: one(people, {
    fields: [personLabels.personId],
    references: [people.id],
  }),
  label: one(labels, {
    fields: [personLabels.labelId],
    references: [labels.id],
  }),
}))

export const eventsRelations = relations(events, ({ many }) => ({
  attendees: many(eventAttendees),
  messages: many(messages),
}))

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  person: one(people, {
    fields: [eventAttendees.personId],
    references: [people.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  event: one(events, {
    fields: [messages.eventId],
    references: [events.id],
  }),
}))

export const followUpsRelations = relations(followUps, ({ one }) => ({
  person: one(people, {
    fields: [followUps.personId],
    references: [people.id],
  }),
}))

export const personRelationshipsRelations = relations(
  personRelationships,
  ({ one }) => ({
    personA: one(people, {
      fields: [personRelationships.personAId],
      references: [people.id],
      relationName: "personA",
    }),
    personB: one(people, {
      fields: [personRelationships.personBId],
      references: [people.id],
      relationName: "personB",
    }),
  })
)

export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
export type Label = typeof labels.$inferSelect
export type Event = typeof events.$inferSelect
export type Message = typeof messages.$inferSelect
export type FollowUp = typeof followUps.$inferSelect
export type PersonRelationship = typeof personRelationships.$inferSelect
