import { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { OPTIONS } from "@/auth.config";

export default async function Layout({children}:{children:ReactNode}){

    const session = await getServerSession(OPTIONS)
    if(!session){
        redirect('/api/auth/signin')
    }
    return (

    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
    )
}