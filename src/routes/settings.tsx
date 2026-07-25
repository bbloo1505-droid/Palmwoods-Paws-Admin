import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { LOCAL_OWNER_ID } from "@/lib/config";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, authDisabled, ownerId } = useAuth();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings" subtitle="Anna's account and go-live checklist." />

      <Card className="space-y-2 text-sm">
        <p>
          <span className="font-semibold">Name: </span>
          {profile?.full_name || "Anna"}
        </p>
        <p>
          <span className="font-semibold">Email: </span>
          {authDisabled ? "Auth disabled (dev)" : user?.email || "—"}
        </p>
        <p>
          <span className="font-semibold">Owner id: </span>
          <code className="text-xs">{ownerId}</code>
        </p>
        <p className="text-muted">
          {authDisabled
            ? "Login is off. The app uses a fixed local owner id so you can keep building."
            : "Auth is on. Only Anna's signed-in account can use the admin app."}
        </p>
      </Card>

      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-xl text-olive-950">Go-live checklist</h2>
        <ol className="list-decimal space-y-2 pl-5 text-olive-950">
          <li>
            Supabase SQL already run: enquiries, Paw Reports, enquiry workflow, Anna profile seed (
            <code className="text-xs">{LOCAL_OWNER_ID}</code>).
          </li>
          <li>
            Website Vercel has <code>RESEND_API_KEY</code>, <code>SUPABASE_URL</code>,{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>.
          </li>
          <li>
            Admin Vercel has <code>VITE_SUPABASE_*</code>, <code>SUPABASE_URL</code>,{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>, and <strong>RESEND_API_KEY</strong> (same as
            website) for Paw Report emails.
          </li>
          <li>
            Before real customer addresses/keys: create Anna in Supabase Auth → set{" "}
            <code>VITE_AUTH_DISABLED=false</code> → run{" "}
            <code>20260725030000_close_dev_open_access.sql</code>.
          </li>
        </ol>
      </Card>
    </div>
  );
}
