"use client";

import * as React from "react";
import { format } from "date-fns";
import { addDays, subDays, subMonths, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = {
  label: string;
  getRange: () => DateRange;
};

const presets: Preset[] = [
  {
    label: "Last 7 days",
    getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: "Last 14 days",
    getRange: () => ({ from: subDays(new Date(), 14), to: new Date() }),
  },
  {
    label: "Last 30 days",
    getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }),
  },
  {
    label: "Last 3 months",
    getRange: () => ({ from: subMonths(new Date(), 3), to: new Date() }),
  },
  {
    label: "Last 6 months",
    getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }),
  },
  {
    label: "Last year",
    getRange: () => ({ from: subYears(new Date(), 1), to: new Date() }),
  },
];

export function HomeDateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const label = (() => {
    if (!value?.from) return "Pick a date";
    if (!value.to) return format(value.from, "MMM d, yyyy");
    return `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="justify-start gap-2 data-[state=open]:bg-muted">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex items-stretch">
          <div className="hidden sm:flex flex-col border-r">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                className="rounded-none justify-start px-4"
                onClick={() => {
                  onChange(p.getRange());
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <Calendar
            mode="range"
            selected={value}
            defaultMonth={value?.from ?? new Date()}
            numberOfMonths={2}
            onSelect={(range) => {
              if (!range) return;
              const from = range.from ?? new Date();
              const to = range.to ?? addDays(from, 0);
              onChange({ from, to });
            }}
            className="p-2"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
