"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ChevronsUpDownIcon, CirclePlusIcon, CogIcon } from "lucide-react";

const teams = [
  {
    label: "Vue",
    avatarUrl: "https://github.com/vuejs.png",
  },
  {
    label: "Vite",
    avatarUrl: "https://github.com/vitejs.png",
  },
  {
    label: "Vitest",
    avatarUrl: "https://github.com/vitest-dev.png",
  },
];

export function TeamsMenu() {
  const [selectedTeam, setSelectedTeam] = React.useState(teams[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between data-[state=open]:bg-sidebar-accent"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={selectedTeam.avatarUrl} alt={selectedTeam.label} />
              <AvatarFallback>{selectedTeam.label.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedTeam.label}</span>
          </span>

          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" sideOffset={8} className="w-56">
        {teams.map((team) => (
          <DropdownMenuItem key={team.label} onClick={() => setSelectedTeam(team)}>
            <span className="flex items-center gap-2">
              <Avatar className="size-5">
                <AvatarImage src={team.avatarUrl} alt={team.label} />
                <AvatarFallback>{team.label.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span>{team.label}</span>
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <CirclePlusIcon className="mr-2 size-4" />
          Create team
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CogIcon className="mr-2 size-4" />
          Manage teams
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
