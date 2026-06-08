import * as React from "react"
import { BookMarked, Layers, Target, Users, Workflow } from "lucide-react"

import {
  categories,
  docsByCategory,
  type MemoryCategory,
} from "@/lib/memory-bank"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

const categoryIcons: Record<
  MemoryCategory,
  React.ComponentType<{ className?: string }>
> = {
  personas: Users,
  intents: Target,
  flows: Workflow,
  surfaces: Layers,
}

interface AppSidebarProps
  extends Omit<React.ComponentProps<typeof Sidebar>, "onSelect"> {
  activeId: string
  onSelect: (id: string) => void
}

export function AppSidebar({ activeId, onSelect, ...props }: AppSidebarProps) {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookMarked className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Memory Bank</span>
            <span className="truncate text-xs text-muted-foreground">
              Product knowledge
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {categories.map((category) => {
          const Icon = categoryIcons[category.key]
          const items = docsByCategory(category.key)

          return (
            <SidebarGroup key={category.key}>
              <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.length === 0 ? (
                    <SidebarMenuItem>
                      <span className="px-2 py-1.5 text-xs text-muted-foreground">
                        No documents yet
                      </span>
                    </SidebarMenuItem>
                  ) : (
                    items.map((doc) => (
                      <SidebarMenuItem key={doc.id}>
                        <SidebarMenuButton
                          isActive={activeId === doc.id}
                          aria-current={activeId === doc.id ? "page" : undefined}
                          onClick={() => {
                            onSelect(doc.id)
                            setOpenMobile(false)
                          }}
                        >
                          <Icon />
                          <span>{doc.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 py-1 text-xs text-muted-foreground">
          Drop new <code className="font-mono">.mdx</code> files into the
          category folders to expand the bank.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

