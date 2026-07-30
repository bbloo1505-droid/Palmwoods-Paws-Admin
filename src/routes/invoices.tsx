import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Layout so /invoices and /invoices/new both render through an Outlet. */
export const Route = createFileRoute("/invoices")({
  component: InvoicesLayout,
});

function InvoicesLayout() {
  return <Outlet />;
}