import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { listRecentVisits } from "@/lib/api";

export const Route = createFileRoute("/visits/")({
  component: VisitsPage,
});

function VisitsPage() {
  const [visits, setVisits] = useState<Awaited<ReturnType<typeof listRecentVisits>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecentVisits(30)
      .then(setVisits)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load visits"));
  }, []);

  return (
    <div>
      <PageHeader title="Visits" subtitle="Completed check-ins, notes, and photos." />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {visits.length === 0 ? (
        <EmptyState title="No visits yet" body="Start a visit from today's schedule or the calendar." />
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const booking = v.booking as {
              pet?: { name?: string };
              client?: { name?: string };
              service_type?: string;
            } | null;
            return (
              <Link key={v.id} to="/visits/$visitId" params={{ visitId: v.id }}>
                <Card className="flex items-center justify-between gap-3 transition hover:border-olive-700/30">
                  <div>
                    <p className="font-semibold text-olive-950">
                      {booking?.pet?.name ?? "Pet"} · {booking?.client?.name ?? "Client"}
                    </p>
                    <p className="text-sm text-muted">
                      {v.finished_at
                        ? format(new Date(v.finished_at), "d MMM yyyy · h:mmaaa")
                        : "In progress"}
                    </p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                    {v.status}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
