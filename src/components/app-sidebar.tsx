"use client"

import * as React from "react"
import {
  IconChartBar,
  IconDashboard,
  IconInnerShadowTop,
  IconListDetails,
  IconBrandYoutube
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSession } from "next-auth/react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Upload",
      url: "/dashboard/upload",
      icon: IconListDetails,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: IconChartBar,
    },
    {
      title: "Youtube Integration",
      url: "/dashboard/youtube",
      icon: IconBrandYoutube,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {data:session} = useSession()
  
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Fazri Stream</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          avatar: session?.user?.image || "",
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}
