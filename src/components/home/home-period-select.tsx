"use client";

import * as React from "react";
import { eachDayOfInterval } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Period } from "@/types";

export function HomePeriodSelect({
  value,
  onChange,
  range,
}: {
  value: Period;
  onChange: (value: Period) => void;
  range: DateRange;
}) {
  const periods = React.useMemo<Period[]>(() => {
    const start = range.from ?? new Date();
    const end = range.to ?? new Date();
    const days = eachDayOfInterval({ start, end });

    if (days.length <= 8) return ["daily"];
    if (days.length <= 31) return ["daily", "weekly"];
    return ["weekly", "monthly"];
  }, [range.from, range.to]);

  React.useEffect(() => {
    if (!periods.includes(value)) {
      onChange(periods[0]);
    }
  }, [periods, value, onChange]);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Period)}>
      <SelectTrigger className="h-9 w-[140px] border-none bg-transparent data-[state=open]:bg-muted">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {periods.map((p) => (
          <SelectItem key={p} value={p} className="capitalize">
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
