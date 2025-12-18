"use client";

import * as React from "react";
import { eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Period } from "@/types";
import { randomInt } from "@/lib/random";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RecordPoint = {
  date: Date;
  amount: number;
};

const formatMoney = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format;

export function HomeChart({ period, range }: { period: Period; range: DateRange }) {
  const [data, setData] = React.useState<RecordPoint[]>([]);

  React.useEffect(() => {
    const start = range.from ?? new Date();
    const end = range.to ?? new Date();

    const dates = (period === "daily"
      ? eachDayOfInterval({ start, end })
      : period === "weekly"
        ? eachWeekOfInterval({ start, end })
        : eachMonthOfInterval({ start, end })) as Date[];

    const min = 1000;
    const max = 10000;

    setData(dates.map((d) => ({ date: d, amount: randomInt(min, max) })));
  }, [period, range.from, range.to]);

  const total = React.useMemo(() => data.reduce((acc, d) => acc + d.amount, 0), [data]);

  const labelForDate = (d: Date) => {
    if (period === "monthly") return format(d, "MMM yyy");
    return format(d, "d MMM");
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Revenue</div>
          <div className="mt-1 text-3xl font-semibold text-foreground">{formatMoney(total)}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(_, index) => {
                  if (index === 0 || index === data.length - 1) return "";
                  const point = data[index];
                  if (!point) return "";
                  return labelForDate(point.date);
                }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload as RecordPoint | undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
                      {labelForDate(p.date)}: {formatMoney(p.amount)}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
