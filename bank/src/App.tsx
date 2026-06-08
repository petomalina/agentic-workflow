import { useState } from "react"
import { MDXProvider } from "@mdx-js/react"

import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { categories, docs, findDoc } from "@/lib/memory-bank"
import { mdxComponents } from "@/mdx-components"

export default function App() {
  const [activeId, setActiveId] = useState(() => docs[0]?.id ?? "")
  const doc = findDoc(activeId)
  const categoryLabel = doc
    ? categories.find((category) => category.key === doc.category)?.label
    : undefined

  return (
    <SidebarProvider>
      <AppSidebar activeId={activeId} onSelect={setActiveId} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center gap-2">
            {categoryLabel && (
              <Badge variant="secondary" className="capitalize">
                {categoryLabel}
              </Badge>
            )}
            <span className="text-sm font-medium">
              {doc?.title ?? "Memory Bank"}
            </span>
          </div>
          <ThemeToggle />
        </header>

        <ScrollArea key={activeId} className="h-[calc(100svh-3.5rem)]">
          <main className="mx-auto w-full max-w-3xl px-6 py-10">
            {doc ? (
              <MDXProvider components={mdxComponents}>
                <article>
                  <doc.Component />
                </article>
              </MDXProvider>
            ) : (
              <EmptyState />
            )}
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <h2 className="text-lg font-semibold">No documents found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Add <code className="font-mono">.mdx</code> files under{" "}
        <code className="font-mono">personas/</code>,{" "}
        <code className="font-mono">intents/</code>,{" "}
        <code className="font-mono">flows/</code>, or{" "}
        <code className="font-mono">surfaces/</code> to populate the memory bank.
      </p>
    </div>
  )
}
