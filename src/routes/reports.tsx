import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, SoftLink } from "@/components/ui";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Paw Reports"
        subtitle="Customer adventure updates after each walk."
      />
      <Card className="space-y-3">
        <p className="text-muted">
          Start a walk from a pet profile, finish it, then send a Paw Report. Owners get a private
          link to a branded page with route, stats, photos and video.
        </p>
        <p>
          <SoftLink to="/pets">Open pets →</SoftLink>
        </p>
        <p>
          <Link to="/my-paws" className="font-semibold text-olive-800">
            Preview customer portal →
          </Link>
        </p>
      </Card>
    </div>
  );
}
