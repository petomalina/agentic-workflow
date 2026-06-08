import {
  cannedReply,
  filterFollowUps,
  filterPeople,
  filterTimeline,
  getTimeline,
  initials,
  mockFollowUps,
  mockPeople,
  relationsForPerson,
  type Person,
} from "@/lib/mock-data"

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Ada Lovelace")).toBe("AL")
  })

  it("handles a single name", () => {
    expect(initials("Grace")).toBe("G")
  })

  it("ignores extra whitespace", () => {
    expect(initials("  Alan   Turing  ")).toBe("AT")
  })
})

describe("filterPeople", () => {
  const people: Person[] = [
    {
      id: "a",
      name: "Ada Lovelace",
      description: "Long-term vision",
      labels: [{ id: "l1", name: "mentor" }],
      events: [],
    },
    {
      id: "b",
      name: "Grace Hopper",
      description: "Pragmatic operator",
      labels: [{ id: "l2", name: "advisor" }],
      events: [],
    },
  ]

  it("returns everyone for an empty query", () => {
    expect(filterPeople(people, "")).toHaveLength(2)
    expect(filterPeople(people, "   ")).toHaveLength(2)
  })

  it("matches on name (case-insensitive)", () => {
    const result = filterPeople(people, "ada")
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Ada Lovelace")
  })

  it("matches on description", () => {
    expect(filterPeople(people, "pragmatic")).toEqual([people[1]])
  })

  it("matches on label", () => {
    expect(filterPeople(people, "mentor")).toEqual([people[0]])
  })

  it("returns nothing when there is no match", () => {
    expect(filterPeople(people, "zzz")).toHaveLength(0)
  })

  it("works against the bundled mock data", () => {
    expect(filterPeople(mockPeople, "engineering").length).toBeGreaterThan(0)
  })
})

describe("getTimeline", () => {
  it("flattens every person's events into one list", () => {
    const totalEvents = mockPeople.reduce(
      (sum, person) => sum + person.events.length,
      0
    )
    expect(getTimeline(mockPeople)).toHaveLength(totalEvents)
  })

  it("sorts entries most-recent first", () => {
    const dates = getTimeline(mockPeople).map((entry) => entry.date)
    const sorted = [...dates].sort((a, b) => b.localeCompare(a))
    expect(dates).toEqual(sorted)
  })

  it("attaches the person to each entry", () => {
    const entry = getTimeline(mockPeople)[0]
    expect(entry).toHaveProperty("personId")
    expect(entry).toHaveProperty("personName")
  })
})

describe("filterTimeline", () => {
  it("matches on context and attendees", () => {
    const timeline = getTimeline(mockPeople)
    expect(filterTimeline(timeline, "DevConf").length).toBeGreaterThan(0)
  })

  it("returns everything for an empty query", () => {
    const timeline = getTimeline(mockPeople)
    expect(filterTimeline(timeline, "")).toEqual(timeline)
  })
})

describe("filterFollowUps", () => {
  it("matches on person name and summary", () => {
    expect(filterFollowUps(mockFollowUps, "Ada").length).toBeGreaterThan(0)
    expect(filterFollowUps(mockFollowUps, "prototype").length).toBeGreaterThan(0)
  })
})

describe("relationsForPerson", () => {
  it("resolves related people in both directions", () => {
    // p1 (Ada) is linked to p3 (coworker) and to p2 (introduced by).
    const relations = relationsForPerson("p1")
    const ids = relations.map((r) => r.person.id).sort()
    expect(ids).toEqual(["p2", "p3"])
  })

  it("carries the relationship type and note", () => {
    const coworker = relationsForPerson("p1").find((r) => r.person.id === "p3")
    expect(coworker?.type).toBe("coworker")
    expect(coworker?.note).toBeTruthy()
  })

  it("returns an empty list for someone with no relationships", () => {
    expect(relationsForPerson("does-not-exist")).toEqual([])
  })
})

describe("cannedReply", () => {
  it("cycles deterministically through the reply set", () => {
    expect(cannedReply(0)).toBe(cannedReply(4))
    expect(cannedReply(0)).not.toBe(cannedReply(1))
  })
})
