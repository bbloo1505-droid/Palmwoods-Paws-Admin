import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/ui";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  return (
    <div>
      <PageHeader title="Messages" subtitle="Coming in Version 2." />
      <Card className="text-muted">
        Owner updates and SMS reminders will land here once Anna has used the core visit
        workflow for a while.
      </Card>
    </div>
  );
}
