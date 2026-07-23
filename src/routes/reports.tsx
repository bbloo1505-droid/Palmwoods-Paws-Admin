import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/ui";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Coming in Version 2." />
      <Card className="text-muted">
        Revenue analytics, CSV export, and tax estimates will be added after the daily workflow
        is solid.
      </Card>
    </div>
  );
}
