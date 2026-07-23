import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cake, CalendarDays, MessageSquare, Pill, Plus, Syringe } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { Button, Card, EmptyState, PageHeader, SoftLink, StatCard } from "@/components/ui";
import {
  getDashboardStats,
  listRecentVisits,
  listReminders,
  listTodaysBookings,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BookingWithRelations } from "@/lib/types";
import { formatMoney, greetingForNow } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<BookingWithRelations[]>([]);
  const [stats, setStats] = useState({
    todayCount: 0,
    weekRevenue: 0,
    outstanding: 0,
    unpaidCount: 0,
  });
  const [reminders, setReminders] = useState<
    Awaited<ReturnType<typeof listReminders>>
  >([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof listRecentVisits>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [j, s, r, v] = await Promise.all([
          listTodaysBookings(),
          getDashboardStats(),
          listReminders(),
          listRecentVisits(),
        ]);
        if (!alive) return;
        setJobs(j);
        setStats(s);
        setReminders(r);
        setRecent(v);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const name = profile?.full_name?.split(" ")[0] || "Anna";

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${name}!`}
        subtitle="Here's what's happening today."
        action={
          <Link to="/calendar">
            <Button variant="primary" size="lg">
              <Plus className="h-4 w-4" />
              New Visit
            </Button>
          </Link>
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading today…</p> : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-olive-950">Today&apos;s Schedule</h2>
            <SoftLink to="/calendar">View full calendar →</SoftLink>
          </div>
          {jobs.length === 0 && !loading ? (
            <EmptyState
              title="No jobs today"
              body="Add a booking in Calendar, or enjoy a quiet day."
              action={
                <Link to="/calendar">
                  <Button>Open calendar</Button>
                </Link>
              }
            />
          ) : (
            jobs.map((job) => <ScheduleCard key={job.id} booking={job} />)
          )}
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Today's visits"
              value={String(stats.todayCount)}
              hint="Scheduled"
              icon={<CalendarDays className="h-5 w-5 text-olive-700" />}
            />
            <StatCard
              label="Weekly revenue"
              value={formatMoney(stats.weekRevenue)}
              hint="Paid this week"
              tone="success"
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(stats.outstanding)}
              hint={`${stats.unpaidCount} unpaid`}
              tone="danger"
            />
            <StatCard
              label="Messages"
              value="0"
              hint="Coming in V2"
              tone="info"
              icon={<MessageSquare className="h-5 w-5 text-info" />}
            />
          </div>

          <Card>
            <h3 className="font-display text-lg text-olive-950">Upcoming reminders</h3>
            <ul className="mt-3 space-y-3">
              {reminders.length === 0 ? (
                <li className="text-sm text-muted">No reminders yet. Add them on a pet profile.</li>
              ) : (
                reminders.map((r) => {
                  const Icon =
                    r.kind === "vaccination" ? Syringe : r.kind === "medication" ? Pill : Cake;
                  return (
                    <li key={r.id} className="flex items-start gap-3 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 text-gold-dark" />
                      <div>
                        <p className="font-medium text-olive-950">{r.title}</p>
                        <p className="text-muted">
                          {r.pet?.name ? `${r.pet.name} · ` : ""}
                          {format(new Date(r.due_on), "d MMM yyyy")}
                        </p>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </Card>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl text-olive-950">Recent visits</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {recent.length === 0 ? (
            <Card className="text-sm text-muted">Completed visits will show here.</Card>
          ) : (
            recent.map((v) => {
              const booking = v.booking as {
                service_type?: string;
                pet?: { name?: string };
                client?: { name?: string };
              } | null;
              return (
                <Card key={v.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-olive-950">
                      {booking?.pet?.name ?? "Pet"} · {booking?.client?.name ?? "Client"}
                    </p>
                    <p className="text-sm text-muted">
                      {v.finished_at
                        ? format(new Date(v.finished_at), "d MMM · h:mmaaa")
                        : "Completed"}
                    </p>
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                    Completed
                  </span>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
