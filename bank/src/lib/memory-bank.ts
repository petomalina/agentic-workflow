import type { ComponentType } from "react"

export type MemoryCategory = "personas" | "intents" | "flows" | "surfaces"

export interface MemoryDoc {
  /** stable id: `${category}/${slug}` */
  id: string
  slug: string
  category: MemoryCategory
  title: string
  description?: string
  Component: ComponentType
  frontmatter: Record<string, unknown>
}

type MDXModule = {
  default: ComponentType
  frontmatter?: {
    title?: string
    description?: string
    [key: string]: unknown
  }
}

// Eagerly bundle every .mdx file living in the memory-bank category folders.
// Paths are resolved relative to this file (bank/src/lib), so `../../` points
// at the `bank/` root where personas / surfaces / flows live.
const modules = import.meta.glob<MDXModule>(
  "../../{personas,intents,flows,surfaces}/*.mdx",
  { eager: true }
)

function titleFromSlug(slug: string) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const docs: MemoryDoc[] = Object.entries(modules)
  .map(([path, mod]) => {
    const match = path.match(/\/(personas|intents|flows|surfaces)\/(.+)\.mdx$/)
    const category = (match?.[1] ?? "personas") as MemoryCategory
    const slug = match?.[2] ?? path
    const frontmatter = mod.frontmatter ?? {}

    return {
      id: `${category}/${slug}`,
      slug,
      category,
      title: frontmatter.title ?? titleFromSlug(slug),
      description: frontmatter.description,
      Component: mod.default,
      frontmatter,
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title))

export const categories: {
  key: MemoryCategory
  label: string
  description: string
}[] = [
  { key: "personas", label: "Personas", description: "Who we build for" },
  { key: "intents", label: "Intents", description: "What they want to do" },
  { key: "flows", label: "Flows", description: "How users move through it" },
  { key: "surfaces", label: "Surfaces", description: "Where the product lives" },
]

export function docsByCategory(category: MemoryCategory): MemoryDoc[] {
  return docs.filter((doc) => doc.category === category)
}

export function findDoc(id: string): MemoryDoc | undefined {
  return docs.find((doc) => doc.id === id)
}
