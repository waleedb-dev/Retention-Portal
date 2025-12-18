"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { EllipsisVerticalIcon } from "lucide-react";

import type { Member } from "@/types";

export function SettingsMembersList({ members }: { members: Member[] }) {
  return (
    <ul role="list" className="divide-y">
      {members.map((m, idx) => (
        <li
          key={idx}
          className="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8">
              <AvatarImage src={m.avatar?.src} alt={m.avatar?.alt ?? m.name} />
              <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-foreground">{m.name}</p>
              <p className="truncate text-muted-foreground">{m.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select defaultValue={m.role}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <EllipsisVerticalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => console.log("Edit member")}>Edit member</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => console.log("Remove member")}
                >
                  Remove member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
      ))}
    </ul>
  );
}
