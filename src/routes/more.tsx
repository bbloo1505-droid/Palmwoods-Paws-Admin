import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, FileText, Images, MessageSquare, Settings, PawPrint } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

const links = [
  { to: "/visits", label: "Visits", icon: ClipboardList },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/gallery", label: "Website gallery", icon: Images },
  { to: "/my-paws", label: "My Paws", icon: PawPrint },
  { to: "/messages", label: "Enquiries", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function MorePage() {
  return (
    <div>
      <PageHeader title="More" subtitle="Quick links for the rest of the day." />
      <div className="grid grid-cols-2 gap-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}>
              <Card className="flex min-h-24 flex-col items-start justify-between gap-3 transition hover:border-olive-700/30">
                <Icon className="h-5 w-5 text-gold-dark" />
                <span className="font-semibold text-olive-950">{item.label}</span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
