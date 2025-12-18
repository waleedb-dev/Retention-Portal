import * as React from "react";

import { SettingsShell } from "@/components/settings/settings-shell";
import { SettingsMembersList } from "@/components/settings/settings-members-list";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { Member } from "@/types";

export default function SettingsMembersPage() {
  const [q, setQ] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("https://dashboard-template.nuxt.dev/api/members");
      const json = (await res.json()) as Member[];
      if (!cancelled) setMembers(json);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMembers = React.useMemo(() => {
    if (!q) return members;
    const re = new RegExp(q, "i");
    return members.filter((m) => re.test(m.name) || re.test(m.username));
  }, [members, q]);

  return (
    <SettingsShell>
      <div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold">Members</div>
            <div className="text-sm text-muted-foreground">
              Invite new members by email address.
            </div>
          </div>

          <Button variant="secondary" className="w-fit sm:ml-auto">
            Invite people
          </Button>
        </div>

        <Card>
          <CardHeader className="p-4 border-b">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members"
              autoFocus
            />
          </CardHeader>
          <CardContent className="p-0">
            <SettingsMembersList members={filteredMembers} />
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
