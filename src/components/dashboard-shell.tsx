"use client";

import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BellIcon } from "lucide-react";

import { useDashboard } from "@/components/dashboard-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { setIsNotificationsOpen } = useDashboard();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">Dashboard</div>

            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsNotificationsOpen(true)}
                    className="relative"
                  >
                    <BellIcon className="size-4" />
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
                    >
                      4
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications (N)</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
