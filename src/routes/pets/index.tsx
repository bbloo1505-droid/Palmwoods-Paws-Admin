import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { listPets } from "@/lib/api";
import type { Pet } from "@/lib/types";

export const Route = createFileRoute("/pets/")({
  component: PetsPage,
});

function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPets()
      .then(setPets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pets"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Pets"
        subtitle="Profiles, medication, house access, and history."
        action={
          <Link to="/pets/new">
            <Button variant="gold">
              <Plus className="h-4 w-4" />
              New pet
            </Button>
          </Link>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {pets.length === 0 ? (
        <EmptyState
          title="No pets yet"
          body="Add a pet under a client to build their profile."
          action={
            <Link to="/pets/new">
              <Button>Add pet</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Link key={pet.id} to="/pets/$petId" params={{ petId: pet.id }}>
              <Card className="h-full transition hover:border-olive-700/30">
                <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-olive-100">
                  {pet.photo_url ? (
                    <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-4xl">🐾</div>
                  )}
                </div>
                <h3 className="font-display text-xl text-olive-950">{pet.name}</h3>
                <p className="text-sm text-muted">{pet.breed || pet.species}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
