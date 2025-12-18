"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import { HomeIcon, InboxIcon, SearchIcon, SettingsIcon, UsersIcon } from "lucide-react";

import { TeamsMenu } from "@/components/teams-menu";
import { UserMenu } from "@/components/user-menu";
import { useDashboard } from "@/components/dashboard-context";

export function AppSidebar() {
  const router = useRouter();
  const { setIsCommandOpen } = useDashboard();

  const path = router.asPath;

  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    return path === href || path.startsWith(`${href}/`);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="bg-sidebar/70">
      <SidebarHeader>
        <TeamsMenu />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search"
              onClick={() => setIsCommandOpen(true)}
            >
              <SearchIcon />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Home">
              <Link href="/">
                <HomeIcon />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/inbox")} tooltip="Inbox">
              <Link href="/inbox">
                <InboxIcon />
                <span>Inbox</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/customers")} tooltip="Customers">
              <Link href="/customers">
                <UsersIcon />
                <span>Customers</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings">
              <Link href="/settings">
                <SettingsIcon />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>

            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={path === "/settings"}>
                  <Link href="/settings">
                    <span>General</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive("/settings/members")}>
                  <Link href="/settings/members">
                    <span>Members</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive("/settings/notifications")}>
                  <Link href="/settings/notifications">
                    <span>Notifications</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive("/settings/security")}>
                  <Link href="/settings/security">
                    <span>Security</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
