"use client";

import * as React from "react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { randomInt } from "@/lib/random";
import type { Period } from "@/types";
import type { DateRange } from "react-day-picker";

import {
  UsersIcon,
  PieChartIcon,
  DollarSignIcon,
  ShoppingCartIcon,
} from "lucide-react";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type BaseStat = {
  title: string;
  icon: React.ReactNode;
  minValue: number;
  maxValue: number;
  minVariation: number;
  maxVariation: number;
  formatter?: (value: number) => string;
};

const baseStats: BaseStat[] = [
  {
    title: "Customers",
    icon: <UsersIcon className="size-4" />,
    minValue: 400,
    maxValue: 1000,
    minVariation: -15,
    maxVariation: 25,
  },
  {
    title: "Conversions",
    icon: <PieChartIcon className="size-4" />,
    minValue: 1000,
    maxValue: 2000,
    minVariation: -10,
    maxVariation: 20,
  },
  {
    title: "Revenue",
    icon: <DollarSignIcon className="size-4" />,
    minValue: 200000,
    maxValue: 500000,
    minVariation: -20,
    maxVariation: 30,
    formatter: formatCurrency,
  },
  {
    title: "Orders",
    icon: <ShoppingCartIcon className="size-4" />,
    minValue: 100,
    maxValue: 300,
    minVariation: -5,
    maxVariation: 15,
  },
];

type StatView = {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  variation: number;
};

export function HomeStats({ period, range }: { period: Period; range: DateRange }) {
  const [stats, setStats] = React.useState<StatView[]>([]);

  const startMs = range.from?.getTime() ?? 0;
  const endMs = range.to?.getTime() ?? 0;

  React.useEffect(() => {
    setStats(
      baseStats.map((s) => {
        const value = randomInt(s.minValue, s.maxValue);
        const variation = randomInt(s.minVariation, s.maxVariation);
        return {
          title: s.title,
          icon: s.icon,
          value: s.formatter ? s.formatter(value) : value,
          variation,
        };
      })
    );
  }, [period, startMs, endMs]);

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-px">
      {stats.map((s) => (
        <Link key={s.title} href="/customers" className="group">
          <Card className="rounded-lg lg:rounded-none lg:first:rounded-l-lg lg:last:rounded-r-lg hover:z-10">
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">{s.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="text-2xl font-semibold text-foreground">{s.value}</div>
                  <Badge variant="secondary" className={s.variation > 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                    {s.variation > 0 ? "+" : ""}
                    {s.variation}%
                  </Badge>
                </div>
              </div>

              <div className="rounded-full bg-primary/10 p-2 text-primary ring-1 ring-inset ring-primary/25">
                {s.icon}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
