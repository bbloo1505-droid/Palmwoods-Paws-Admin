import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { walksFeatureAvailable } from "@/lib/api";
import { LOCAL_OWNER_ID } from "@/lib/config";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

async function copySetupSql(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Could not load SQL file");
  const sql = await res.text();
  await navigator.clipboard.writeText(sql);
  return sql.length;
}

function SettingsPage() {
  const { profile, user, authDisabled, ownerId, signOut } = useAuth();
  const [seedBusy, setSeedBusy] = useState<"load" | "clear" | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [walksOk, setWalksOk] = useState<boolean | null>(null);
  const [sqlMsg, setSqlMsg] = useState<string | null>(null);
  const [sqlErr, setSqlErr] = useState<string | null>(null);

  useEffect(() => {
    walksFeatureAvailable()
      .then(setWalksOk)
      .catch(() => setWalksOk(false));
  }, []);

  const runDemo = async (action: "load" | "clear") => {
    setSeedBusy(action);
    setSeedMsg(null);
    setSeedErr(null);
    try {
      const res = await fetch("/api/seed-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ownerId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        samplePawReport?: string;
        clients?: number;
        pets?: number;
        bookings?: number;
      };
      if (!res.ok) throw new Error(data.error || "Could not update demo data");

      if (action === "clear") {
        setSeedMsg(data.message || "Demo data turned off.");
      } else {
        setSeedMsg(
          `${data.message || "Demo loaded."} ${data.clients ?? 0} clients, ${data.pets ?? 0} pets, ${
            data.bookings ?? 0
          } bookings. Refresh Dashboard / Calendar / Pets to see it.`,
        );
      }
    } catch (e) {
      setSeedErr(e instanceof Error ? e.message : "Demo update failed");
    } finally {
      setSeedBusy(null);
    }
  };

  const copyWalksSql = async () => {
    setSqlMsg(null);
    setSqlErr(null);
    try {
      await copySetupSql("/setup/paw-reports.sql");
      setSqlMsg(
        "SQL copied. Paste it into Supabase → SQL Editor → Run, then refresh this page.",
      );
    } catch (e) {
      setSqlErr(e instanceof Error ? e.message : "Could not copy SQL");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings" subtitle="Anna's account, demo data, and setup." />

      <Card className="space-y-2 text-sm">
        <p>
          <span className="font-semibold">Name: </span>
          {profile?.full_name || "Anna"}
        </p>
        <p>
          <span className="font-semibold">Email: </span>
          {authDisabled ? "Auth disabled (dev bypass)" : user?.email || "—"}
        </p>
        <p>
          <span className="font-semibold">Owner id: </span>
          <code className="text-xs">{ownerId || "—"}</code>
        </p>
        {!authDisabled ? (
          <Button type="button" variant="secondary" className="mt-2" onClick={() => void signOut()}>
            Sign out
          </Button>
        ) : null}
      </Card>

      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-xl text-olive-950">Walks &amp; Paw Reports</h2>
        <p className="text-muted">
          Status:{" "}
          {walksOk === null
            ? "Checking…"
            : walksOk
              ? "Enabled"
              : "Not enabled yet (Start Walk will use a visit checklist until this is on)"}
        </p>
        {!walksOk ? (
          <>
            <p className="text-muted">
              One paste in Supabase unlocks GPS walks, Finish Walk, and owner Paw Reports.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-olive-950">
              <li>
                Open{" "}
                <a
                  className="font-semibold text-olive-800 underline-offset-2 hover:underline"
                  href="https://supabase.com/dashboard/project/wuwpvmixdrruonrvryfu/sql/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  Supabase SQL Editor
                </a>
              </li>
              <li>Tap the button below to copy the SQL</li>
              <li>Paste → Run → come back and refresh</li>
            </ol>
            <Button type="button" variant="gold" onClick={() => void copyWalksSql()}>
              Copy Walks &amp; Paw Reports SQL
            </Button>
          </>
        ) : (
          <p className="text-success">Walk tracking and Paw Reports are ready.</p>
        )}
        {sqlMsg ? <p className="text-success">{sqlMsg}</p> : null}
        {sqlErr ? <p className="text-danger">{sqlErr}</p> : null}
      </Card>

      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-xl text-olive-950">Demo data</h2>
        <p className="text-muted">
          Fill the app with a fake Sunshine Coast diary, or remove it when you&apos;re ready for real
          clients only.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="gold"
            className="flex-1"
            disabled={Boolean(seedBusy)}
            onClick={() => void runDemo("load")}
          >
            {seedBusy === "load" ? "Loading demo…" : "Turn demo data on"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={Boolean(seedBusy)}
            onClick={() => {
              if (!window.confirm("Remove all demo clients, pets, bookings, and invoices?")) return;
              void runDemo("clear");
            }}
          >
            {seedBusy === "clear" ? "Removing…" : "Turn demo data off"}
          </Button>
        </div>
        {seedMsg ? <p className="text-success">{seedMsg}</p> : null}
        {seedErr ? <p className="text-danger">{seedErr}</p> : null}
      </Card>

      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-xl text-olive-950">Notes</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            Sign in as <code>contact@palmwoodspaws.com</code>.
          </li>
          <li>
            Legacy local owner id was <code className="text-xs">{LOCAL_OWNER_ID}</code>.
          </li>
          <li>Website gallery and enquiries work without the Walks SQL.</li>
        </ul>
      </Card>
    </div>
  );
}
