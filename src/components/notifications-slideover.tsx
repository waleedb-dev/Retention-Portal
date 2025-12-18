"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useDashboard } from "@/components/dashboard-context";

type Notification = {
  id: number;
  unread?: boolean;
  sender: {
    name: string;
    avatar?: {
      src?: string;
      alt?: string;
    };
  };
  body: string;
  date: string;
};

export function NotificationsSlideover() {
  const { isNotificationsOpen, setIsNotificationsOpen } = useDashboard();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  React.useEffect(() => {
    if (!isNotificationsOpen) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("https://dashboard-template.nuxt.dev/api/notifications");
      const json = (await res.json()) as Notification[];
      if (!cancelled) setNotifications(json);
    })();

    return () => {
      cancelled = true;
    };
  }, [isNotificationsOpen]);

  return (
    <Sheet open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-1">
          {notifications.map((n) => {
            const src = n.sender.avatar?.src;
            const alt = n.sender.avatar?.alt ?? n.sender.name;

            return (
              <Link
                key={n.id}
                href={`/inbox?id=${n.id}`}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
                onClick={() => setIsNotificationsOpen(false)}
              >
                <div className="relative">
                  <Avatar className="size-9">
                    <AvatarImage src={src} alt={alt} />
                    <AvatarFallback>{n.sender.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  {n.unread ? (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-foreground">
                      {n.sender.name}
                    </span>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={n.date}
                    >
                      {formatDistanceToNow(new Date(n.date), { addSuffix: true })}
                    </time>
                  </div>
                  <div className="line-clamp-1 text-muted-foreground">{n.body}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
