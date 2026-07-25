import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { AlertCircle, FileText, MessageSquare, Plus } from "lucide-react";
import { TodayJobCard } from "@/components/TodayJobCard";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import {
  countNewWebsiteEnquiries,
  getDashboardStats,
  listActiveWalksByBookingIds,
  listTodaysBookings,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BookingWithRelations } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<BookingWithRelations[]>([]);
  const [activeWalks, setActiveWalks] = useState<Record<string, string>>({});
  const [newEnquiries, setNewEnquiries] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [j, s, enquiryCount] = await Promise.all([
          listTodaysBookings(),
          getDashboardStats(),
          countNewWebsiteEnquiries().catch(() => 0),
        ]);
        if (!alive) return;
        setJobs(j);
        setUnpaidCount(s.unpaidCount);
        setNewEnquiries(enquiryCount);

        const walks = await listActiveWalksByBookingIds(
          j.map((b) => b.id).filter(Boolean),
        ).catch(() => []);
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const w of walks) {
          if (w.booking_id) map[w.booking_id] = w.id;
        }
        setActiveWalks(map);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not load today");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const name = profile?.full_name?.split(" ")[0] || "Anna";
  const todayLabel = format(new Date(), "EEEE d MMMM");
  const attentionItems = [
    newEnquiries > 0
      ? {
          key: "enquiries",
          label: `${newEnquiries} new enquir${newEnquiries === 1 ? "y" : "ies"}`,
          to: "/messages" as const,
          icon: MessageSquare,
        }
      : null,
    unpaidCount > 0
      ? {
          key: "invoices",
          label: `${unpaidCount} unpaid invoice${unpaidCount === 1 ? "" : "s"}`,
          to: "/invoices" as const,
          icon: FileText,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    to: "/messages" | "/invoices";
    icon: typeof MessageSquare;
  }[];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={`Today`}
        subtitle={`${todayLabel} · Hi ${name}`}
        action={
          <Link to="/calendar">
            <Button variant="secondary" size="sm">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </Link>
        }
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading today…</p> : null}

      <section className="space-y-3">
        {jobs.length === 0 && !loading ? (
          <EmptyState
            title="No jobs today"
            body="Quiet day, or add a booking in Calendar."
            action={
              <Link to="/calendar">
                <Button variant="gold">Open calendar</Button>
              </Link>
            }
          />
        ) : (
          jobs.map((job) => (
            <TodayJobCard key={job.id} booking={job} activeWalkId={activeWalks[job.id] ?? null} />
          ))
        )}
      </section>

      {attentionItems.length > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-olive-950">
            <AlertCircle className="h-5 w-5 text-gold-dark" />
            Needs attention
          </h2>
          <div className="space-y-2">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.key} to={item.to}>
                  <Card className="flex items-center gap-3 transition hover:border-olive-700/30">
                    <Icon className="h-5 w-5 text-gold-dark" />
                    <span className="font-semibold text-olive-950">{item.label}</span>
                    <span className="ml-auto text-sm font-semibold text-olive-800">Open →</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
