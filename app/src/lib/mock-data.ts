/**
 * Mock data for the Braindump UI.
 *
 * The app is intentionally mocked for now — no persistence is wired up. These
 * shapes loosely mirror the Drizzle schema in `src/db/schema.ts` so swapping in
 * real queries later is straightforward.
 */

export interface Label {
  id: string
  name: string
}

export interface PersonEvent {
  id: string
  title: string
  notes?: string
  /** Where it happened — a conference, office, call, etc. */
  context?: string
  /** Other people who were in the meeting (besides this person). */
  attendees?: string[]
  /** ISO date string */
  date: string
}

export interface Person {
  id: string
  name: string
  description: string
  labels: Label[]
  events: PersonEvent[]
}

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** ISO datetime string */
  timestamp: string
}

export const mockPeople: Person[] = [
  {
    id: "p1",
    name: "Ada Lovelace",
    description:
      "Analytical engine collaborator. Sharp on long-term product vision, prefers async written updates.",
    labels: [
      { id: "l1", name: "mentor" },
      { id: "l2", name: "engineering" },
    ],
    events: [
      {
        id: "e1",
        title: "Coffee chat",
        notes:
          "Walked through the braindump idea. She suggested framing it around recall, not capture. Challenge she's chewing on: keeping teams aligned without endless meetings.",
        context: "DevConf 2026",
        date: "2026-05-28",
      },
      {
        id: "e2",
        title: "Architecture review",
        notes:
          "Liked the local-first SQLite plan. Flagged sync as the hard part.",
        context: "Office",
        attendees: ["Alan Turing"],
        date: "2026-06-03",
      },
    ],
  },
  {
    id: "p2",
    name: "Grace Hopper",
    description:
      "Pragmatic operator. Great at turning fuzzy ideas into shippable scope.",
    labels: [
      { id: "l3", name: "advisor" },
      { id: "l4", name: "go-to-market" },
    ],
    events: [
      {
        id: "e3",
        title: "Intro at the systems meetup",
        notes:
          "Offered to review the first prototype. Interested in the relationship-building angle.",
        context: "Systems Meetup",
        date: "2026-05-30",
      },
    ],
  },
  {
    id: "p3",
    name: "Alan Turing",
    description:
      "Deep thinker on search and ranking. Quiet but incisive in reviews.",
    labels: [{ id: "l2", name: "engineering" }],
    events: [
      {
        id: "e4",
        title: "Whiteboard session",
        notes: "Sketched a relevance model for searching across braindumps.",
        context: "Office",
        attendees: ["Ada Lovelace"],
        date: "2026-06-01",
      },
      {
        id: "e5",
        title: "Conference talk",
        notes:
          "Spoke about decidability. Afterwards we talked about how agents decide what to store.",
        context: "DevConf 2026",
        date: "2026-05-28",
      },
    ],
  },
  {
    id: "p4",
    name: "Radia Perlman",
    description:
      "Network thinker. Helpful sounding board for resilience and edge cases.",
    labels: [
      { id: "l2", name: "engineering" },
      { id: "l5", name: "investor" },
    ],
    events: [],
  },
]

export const mockMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Just back from somewhere? Dump it all — who you met, what you talked about, who else was there. I'll sort it into your people and timeline.",
    timestamp: "2026-06-08T09:00:00.000Z",
  },
  {
    id: "m2",
    role: "user",
    content:
      "I was at DevConf. Met Ada Lovelace over coffee, we talked about framing the product around recall.",
    timestamp: "2026-06-08T09:01:00.000Z",
  },
  {
    id: "m3",
    role: "assistant",
    content:
      "Logged a coffee chat with Ada Lovelace at DevConf. What challenge was she trying to solve — it helps to capture that for next time you talk?",
    timestamp: "2026-06-08T09:01:05.000Z",
  },
  {
    id: "m4",
    role: "user",
    content:
      "She's trying to keep teams aligned without endless meetings. Also tag her as a mentor.",
    timestamp: "2026-06-08T09:02:00.000Z",
  },
  {
    id: "m5",
    role: "assistant",
    content:
      "Done — noted the alignment challenge and added the \"mentor\" label to Ada. Anyone else from DevConf?",
    timestamp: "2026-06-08T09:02:04.000Z",
  },
]

/** Greeting shown when the user starts a brand-new conversation. */
export const freshChatGreeting: ChatMessage = {
  id: "fresh-greeting",
  role: "assistant",
  content: "New conversation — tell me who you met and what you talked about.",
  timestamp: "2026-06-09T00:00:00.000Z",
}

// Canned assistant replies that mimic the agent flow: acknowledge, then probe
// for the kind of detail that builds rapport. Cycled deterministically.
const CANNED_REPLIES = [
  "Got it — I've added that to your braindump. Who else was in the room?",
  "Noted. What was the main challenge they were trying to solve?",
  "Logged. Anything interesting you learned about them personally?",
  "Updated their labels. Want me to set a reminder to follow up?",
]

export function cannedReply(turn: number): string {
  return CANNED_REPLIES[turn % CANNED_REPLIES.length]
}

/** Initials for an avatar fallback, e.g. "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/** Filter people by name, description, or label — used by the search bar. */
export function filterPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase()
  if (!q) return people
  return people.filter(
    (person) =>
      person.name.toLowerCase().includes(q) ||
      person.description.toLowerCase().includes(q) ||
      person.labels.some((label) => label.name.toLowerCase().includes(q))
  )
}

export interface TimelineEntry extends PersonEvent {
  personId: string
  personName: string
}

/** Flatten everyone's events into one list, most recent first. */
export function getTimeline(people: Person[]): TimelineEntry[] {
  return people
    .flatMap((person) =>
      person.events.map((event) => ({
        ...event,
        personId: person.id,
        personName: person.name,
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Filter timeline entries by person, title, notes, context, or attendee. */
export function filterTimeline(
  entries: TimelineEntry[],
  query: string
): TimelineEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((entry) =>
    [
      entry.personName,
      entry.title,
      entry.notes ?? "",
      entry.context ?? "",
      ...(entry.attendees ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  )
}

export interface FollowUp {
  id: string
  personId: string
  personName: string
  /** The commitment, e.g. "Send Ada the architecture doc". */
  summary: string
  /** Who owns it. */
  owner: "you" | "them"
  /** ISO date string */
  due?: string
  done: boolean
}

// Commitments the agent extracted from braindumps. Completed only via chat.
export const mockFollowUps: FollowUp[] = [
  {
    id: "f1",
    personId: "p1",
    personName: "Ada Lovelace",
    summary: "Send Ada the local-first architecture doc",
    owner: "you",
    due: "2026-06-10",
    done: false,
  },
  {
    id: "f2",
    personId: "p2",
    personName: "Grace Hopper",
    summary: "Grace will review the first prototype",
    owner: "them",
    due: "2026-06-12",
    done: false,
  },
  {
    id: "f3",
    personId: "p3",
    personName: "Alan Turing",
    summary: "Share notes from the relevance-model whiteboard",
    owner: "you",
    done: true,
  },
]

/** Filter follow-ups by person or commitment text. */
export function filterFollowUps(items: FollowUp[], query: string): FollowUp[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) =>
    `${item.personName} ${item.summary}`.toLowerCase().includes(q)
  )
}

export interface PersonRelation {
  id: string
  personAId: string
  personBId: string
  /** e.g. "coworker", "manager", "introduced by" */
  type: string
  note?: string
}

// How people relate to each other. The user states these in chat
// ("Ada and Alan work together") and the agent records the link.
export const mockRelationships: PersonRelation[] = [
  {
    id: "rel1",
    personAId: "p1",
    personBId: "p3",
    type: "coworker",
    note: "Both on the platform team",
  },
  { id: "rel2", personAId: "p3", personBId: "p4", type: "coworker" },
  {
    id: "rel3",
    personAId: "p2",
    personBId: "p1",
    type: "introduced by",
    note: "Grace introduced you to Ada",
  },
]

export interface RelatedPerson {
  person: Person
  type: string
  note?: string
}

/** Resolve everyone a given person is related to (in either direction). */
export function relationsForPerson(
  personId: string,
  people: Person[] = mockPeople,
  relationships: PersonRelation[] = mockRelationships
): RelatedPerson[] {
  const byId = new Map(people.map((person) => [person.id, person]))
  return relationships
    .filter((rel) => rel.personAId === personId || rel.personBId === personId)
    .map((rel): RelatedPerson | null => {
      const otherId = rel.personAId === personId ? rel.personBId : rel.personAId
      const person = byId.get(otherId)
      return person ? { person, type: rel.type, note: rel.note } : null
    })
    .filter((value): value is RelatedPerson => value !== null)
}
