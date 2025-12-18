import type { GetServerSideProps } from "next";
import { format } from "date-fns";

import { getSupabaseAdmin } from "@/lib/supabase";

type LeadRow = {
  id: string;
  submission_id: string | null;
  customer_full_name: string | null;
  state: string | null;
  updated_at: string | null;
};

type Props = {
  leads: LeadRow[];
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, submission_id, customer_full_name, state, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      props: {
        leads: [],
      },
    };
  }

  return {
    props: {
      leads: (data ?? []) as LeadRow[],
    },
  };
};

export default function LeadsPage({ leads }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only view from Supabase.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Updated</th>
                <th className="px-4 py-3 font-medium">Monday Item ID</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    No leads found.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-t">
                    <td className="px-4 py-3">
                      {lead.customer_full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">{lead.state ?? "—"}</td>
                    <td className="px-4 py-3">
                      {lead.updated_at
                        ? format(new Date(lead.updated_at), "yyyy-MM-dd HH:mm")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {lead.submission_id ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
