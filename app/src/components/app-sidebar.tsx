import * as React from "react"
import {
  BookUser,
  Brain,
  CalendarClock,
  ListChecks,
  MessageSquarePlus,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export type Surface = "chat" | "dictionary" | "timeline" | "follow-ups"

const SURFACES: {
  key: Surface
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "chat", label: "Chat", icon: MessageSquarePlus },
  { key: "dictionary", label: "Dictionary", icon: BookUser },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "follow-ups", label: "Follow-ups", icon: ListChecks },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  surface: Surface
  onNavigate: (surface: Surface) => void
  peopleCount: number
  openFollowUpCount: number
}

export function AppSidebar({
  surface,
  onNavigate,
  peopleCount,
  openFollowUpCount,
  ...props
}: AppSidebarProps) {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Braindump</span>
            <span className="truncate text-xs text-muted-foreground">
              People &amp; meetings
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {SURFACES.map(({ key, label, icon: Icon }) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  isActive={surface === key}
                  aria-current={surface === key ? "page" : undefined}
                  onClick={() => {
                    onNavigate(key)
                    setOpenMobile(false)
                  }}
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
                {key === "follow-ups" && openFollowUpCount > 0 && (
                  <SidebarMenuBadge>{openFollowUpCount}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 py-1 text-xs text-muted-foreground">
          {peopleCount} {peopleCount === 1 ? "person" : "people"} in your
          dictionary
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
