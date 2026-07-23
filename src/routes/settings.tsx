import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings" subtitle="Anna's account for Palmwoods Paws Ops." />
      <Card className="space-y-2 text-sm">
        <p>
          <span className="font-semibold">Name: </span>
          {profile?.full_name || "Anna"}
        </p>
        <p>
          <span className="font-semibold">Email: </span>
          {user?.email}
        </p>
        <p className="text-muted">
          This app is single-operator for Version 1. Team access comes later.
        </p>
      </Card>
      <Button variant="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>
      <Link to="/more" className="block text-sm font-semibold text-olive-800">
        More shortcuts
      </Link>
    </div>
  );
}
