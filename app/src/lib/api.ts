/**
 * Braindump API client. The views are pure reads; the chat is the only write.
 * Response shapes equal the `mock-data.ts` interfaces, so components are
 * unchanged.
 */
import type {
  ChatMessage,
  FollowUp,
  Person,
  RelatedPerson,
  TimelineEntry,
} from "@/lib/mock-data"

export interface PersonDetail {
  person: Person
  relations: RelatedPerson[]
  followUps: FollowUp[]
}

export interface ChatResponse {
  userMessage: ChatMessage
  reply: ChatMessage
  /** Tables the agent wrote to this turn — which views to refetch. */
  touched: string[]
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchPeople(query?: string): Promise<Person[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ""
  return get<Person[]>(`/people${qs}`)
}

export function fetchPerson(id: string): Promise<PersonDetail> {
  return get<PersonDetail>(`/people/${id}`)
}

export function fetchTimeline(): Promise<TimelineEntry[]> {
  return get<TimelineEntry[]>("/timeline")
}

export function fetchFollowUps(): Promise<FollowUp[]> {
  return get<FollowUp[]>("/follow-ups")
}

export function fetchMessages(): Promise<ChatMessage[]> {
  return get<ChatMessage[]>("/chat/messages")
}

export async function sendChat(
  message: string,
  now?: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, now }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error ?? `POST /chat failed: ${res.status}`)
  }
  return res.json() as Promise<ChatResponse>
}
