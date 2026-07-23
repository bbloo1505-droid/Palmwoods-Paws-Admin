import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Phone, Mail, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { listClients } from "@/lib/api";
import type { Client } from "@/lib/types";

export const Route = createFileRoute("/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load clients"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="People, homes, and payment preferences."
        action={
          <Link to="/clients/new">
            <Button variant="gold">
              <Plus className="h-4 w-4" />
              New client
            </Button>
          </Link>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Add Anna's first client and their pets."
          action={
            <Link to="/clients/new">
              <Button>Add client</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clients.map((c) => (
            <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}>
              <Card className="h-full transition hover:border-olive-700/30">
                <h3 className="font-display text-xl text-olive-950">{c.name}</h3>
                <div className="mt-3 space-y-1.5 text-sm text-muted">
                  {c.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {c.phone}
                    </p>
                  ) : null}
                  {c.email ? (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {c.email}
                    </p>
                  ) : null}
                  {c.suburb || c.address ? (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {c.suburb || c.address}
                    </p>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
