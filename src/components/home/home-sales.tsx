"use client";

import * as React from "react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Period } from "@/types";
import type { DateRange } from "react-day-picker";
import type { Sale, SaleStatus } from "@/types";
import { randomFrom, randomInt } from "@/lib/random";

const sampleEmails = [
  "james.anderson@example.com",
  "mia.white@example.com",
  "william.brown@example.com",
  "emma.davis@example.com",
  "ethan.harris@example.com",
];

function statusBadge(status: SaleStatus) {
  const className =
    status === "paid"
      ? "bg-green-500/10 text-green-700 dark:text-green-300"
      : status === "failed"
        ? "bg-red-500/10 text-red-700 dark:text-red-300"
        : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";

  return (
    <Badge variant="secondary" className={`capitalize ${className}`}>
      {status}
    </Badge>
  );
}

export function HomeSales({ period, range }: { period: Period; range: DateRange }) {
  const [rows, setRows] = React.useState<Sale[]>([]);

  React.useEffect(() => {
    const now = new Date();
    const next: Sale[] = [];

    for (let i = 0; i < 5; i++) {
      const hoursAgo = randomInt(0, 48);
      const date = new Date(now.getTime() - hoursAgo * 3600000);

      next.push({
        id: (4600 - i).toString(),
        date: date.toISOString(),
        status: randomFrom(["paid", "failed", "refunded"]),
        email: randomFrom(sampleEmails),
        amount: randomInt(100, 1000),
      });
    }

    next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRows(next);
  }, [period, range.from, range.to]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  return (
    <div className="mt-6 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[80px]">ID</TableHead>
            <TableHead className="w-[160px]">Date</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right w-[120px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">#{r.id}</TableCell>
              <TableCell>
                {format(new Date(r.date), "d MMM HH:mm")}
              </TableCell>
              <TableCell>{statusBadge(r.status)}</TableCell>
              <TableCell>{r.email}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(r.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
