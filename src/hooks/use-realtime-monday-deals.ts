import * as React from "react";

import type { MondayComDeal } from "@/types";
import { supabase } from "@/lib/supabase";

export function useRealtimeMondayDeals() {
  const [data, setData] = React.useState<MondayComDeal[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("monday_com_deals")
        .select("*")
        .order("last_updated", { ascending: false, nullsFirst: false })
        .limit(200);

      if (!error && rows) {
        setData(rows as MondayComDeal[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      await refresh();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Realtime subscription
  React.useEffect(() => {
    const channel = supabase
      .channel("monday_com_deals_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monday_com_deals",
        },
        () => {
          console.log("[realtime] monday_com_deals change received");
          void refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { data, loading, refresh };
}
