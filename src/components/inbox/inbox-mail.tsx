"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
  InboxIcon,
  PaperclipIcon,
  ReplyIcon,
  StarIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import type { Mail } from "@/types";

export function InboxMail({ mail, onClose }: { mail: Mail; onClose: () => void }) {
  const [reply, setReply] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = () => {
    setLoading(true);

    window.setTimeout(() => {
      setReply("");
      toast.success("Email sent", {
        description: "Your email has been sent successfully",
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="-ml-1" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
          <div className="truncate font-medium">{mail.subject}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <InboxIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <ReplyIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <CheckCircleIcon className="mr-2 size-4" />
                Mark as unread
              </DropdownMenuItem>
              <DropdownMenuItem>
                <TriangleAlertIcon className="mr-2 size-4" />
                Mark as important
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <StarIcon className="mr-2 size-4" />
                Star thread
              </DropdownMenuItem>
              <DropdownMenuItem>
                <InboxIcon className="mr-2 size-4" />
                Mute thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-14">
            <AvatarImage src={mail.from.avatar?.src} alt={mail.from.avatar?.alt ?? mail.from.name} />
            <AvatarFallback>{mail.from.name.slice(0, 1)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="font-semibold text-foreground">{mail.from.name}</div>
            <div className="text-sm text-muted-foreground">{mail.from.email}</div>
          </div>
        </div>

        <div className="pl-18 text-sm text-muted-foreground sm:pl-0">
          {format(new Date(mail.date), "dd MMM HH:mm")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <p className="whitespace-pre-wrap text-sm">{mail.body}</p>
      </div>

      <div className="shrink-0 px-4 pb-4 sm:px-6">
        <Card className="bg-muted/30">
          <CardHeader className="flex flex-row items-center gap-2 text-muted-foreground">
            <ReplyIcon className="size-4" />
            <div className="truncate text-sm">
              Reply to {mail.from.name} ({mail.from.email})
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="space-y-3"
            >
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply..."
                rows={4}
                disabled={loading}
                required
                className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
              />

              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <PaperclipIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost">
                    Save draft
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
