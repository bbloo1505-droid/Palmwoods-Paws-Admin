import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, authDisabled } = useAuth();

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
          {authDisabled ? "Auth disabled for now" : user?.email}
        </p>
        <p className="text-muted">
          {authDisabled
            ? "Login is turned off temporarily so you can use the app without signing in."
            : "This app is single-operator for Version 1. Team access comes later."}
        </p>
      </Card>
    </div>
  );
}
