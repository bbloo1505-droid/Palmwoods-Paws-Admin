import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, PageHeader, inputClassName } from "@/components/ui";
import { listClientSentReports, listClients } from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";
import type { Client } from "@/lib/types";
import { formatDistanceKm, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/my-paws")({
  component: MyPawsPortalPage,
});

/**
 * Customer portal stub (V1): pick a household to browse sent Paw Reports.
 * Later: magic-link login so owners only see their own dogs.
 */
function MyPawsPortalPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [reports, setReports] = useState<
    {
      id: string;
      public_token: string;
      sent_at: string | null;
      distance_m: number;
      duration_sec: number;
      pet?: { id: string; name: string; photo_url: string | null } | null;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClients()
      .then((c) => {
        setClients(c);
        if (c[0]) setClientId(c[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    listClientSentReports(clientId)
      .then((rows) => setReports(rows as typeof reports))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reports"));
  }, [clientId]);

  const client = clients.find((c) => c.id === clientId);

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-olive-100 bg-warm-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <img src={LOGO_SRC} alt="Palmwoods Paws" className="h-12 w-auto object-contain" />
          <Link to="/" className="text-sm font-semibold text-olive-800">
            Anna&apos;s app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <PageHeader
          title={client ? `Hi ${client.name.split(" ")[0]}` : "My Paws"}
          subtitle="Adventure history for your pets. Magic-link login coming next."
        />

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        <Card className="mb-5">
          <Field label="Household (dev preview)">
            <select
              className={inputClassName()}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-2 text-xs text-muted">
            Owners will later open this via a private email magic link — no password.
          </p>
        </Card>

        {reports.length === 0 ? (
          <EmptyState
            title="No adventures yet"
            body="When Anna sends a Paw Report, it will show up here."
          />
        ) : (
          <div className="space-y-3">
            <h2 className="font-display text-xl text-olive-950">Adventure history</h2>
            {reports.map((r) => (
              <Link key={r.id} to="/pawreport/$token" params={{ token: r.public_token }}>
                <Card className="flex items-center gap-3 transition hover:border-olive-700/30">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-olive-100">
                    {r.pet?.photo_url ? (
                      <img src={r.pet.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>🐾</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-olive-950">{r.pet?.name ?? "Pet"}</p>
                    <p className="text-sm text-muted">
                      {r.sent_at ? format(new Date(r.sent_at), "d MMM yyyy") : "Sent"} ·{" "}
                      {formatDuration(r.duration_sec)} · {formatDistanceKm(r.distance_m)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-olive-800">View</span>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top
          </Button>
        </div>
      </main>
    </div>
  );
}
