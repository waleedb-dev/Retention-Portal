"use client";

import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AgentDialerDashboard from "../dialer";

export default function AgentSessionPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* Top row: Dialer (left) + Verification panel (right) */}
      <div className="flex flex-1 min-h-0 gap-4">
        {/* Left: dialer implementation (queue, VICIdial, hopper) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgentDialerDashboard embedded />
        </div>

        {/* Right: Verification panel – populated after call from deal id */}
        <div className="w-[380px] flex-shrink-0 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Verification</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 text-sm text-muted-foreground overflow-auto">
              {/* Details placed after call is triggered, fetched by deal id */}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom: Policies box – no details until after call / deal id */}
      <Card className="flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle>Policies</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No details yet. Will be filled after call using deal data.
        </CardContent>
      </Card>
    </div>
  );
}
