"use client";

import * as React from "react";
import { format, isToday } from "date-fns";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { Mail } from "@/types";

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function InboxList({
  mails,
  selectedMail,
  onSelect,
}: {
  mails: Mail[];
  selectedMail: Mail | null;
  onSelect: (mail: Mail | null) => void;
}) {
  const refs = React.useRef<Record<number, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (!selectedMail) return;

    const el = refs.current[selectedMail.id];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedMail]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isEditableElement(e.target)) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const index = mails.findIndex((m) => m.id === selectedMail?.id);
        if (index === -1) {
          if (mails[0]) onSelect(mails[0]);
        } else if (index < mails.length - 1) {
          onSelect(mails[index + 1] ?? null);
        }
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const index = mails.findIndex((m) => m.id === selectedMail?.id);
        if (index === -1) {
          if (mails[mails.length - 1]) onSelect(mails[mails.length - 1]);
        } else if (index > 0) {
          onSelect(mails[index - 1] ?? null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mails, selectedMail, onSelect]);

  return (
    <ScrollArea className="h-[calc(100svh-3.5rem)]">
      <div className="divide-y">
        {mails.map((mail) => {
          const isSelected = selectedMail?.id === mail.id;

          return (
            <div key={mail.id} ref={(el) => {
              refs.current[mail.id] = el;
            }}>
              <div
                className={
                  "cursor-pointer border-l-2 p-4 text-sm transition-colors sm:px-6 " +
                  (mail.unread ? "text-foreground" : "text-muted-foreground") +
                  " " +
                  (isSelected
                    ? "border-primary bg-primary/10"
                    : "border-background hover:border-primary hover:bg-primary/5")
                }
                onClick={() => onSelect(mail)}
              >
                <div className={"flex items-center justify-between " + (mail.unread ? "font-semibold" : "")}
                >
                  <div className="flex items-center gap-3">
                    {mail.from.name}
                    {mail.unread ? (
                      <span className="inline-block size-2 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <span>
                    {isToday(new Date(mail.date))
                      ? format(new Date(mail.date), "HH:mm")
                      : format(new Date(mail.date), "dd MMM")}
                  </span>
                </div>
                <p className={"truncate " + (mail.unread ? "font-semibold" : "")}>{mail.subject}</p>
                <p className="line-clamp-1 text-muted-foreground">{mail.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
