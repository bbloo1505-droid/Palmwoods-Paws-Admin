import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";

function RootComponent() {
  const { loading, authDisabled } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/login";
  const isPublicCustomer =
    pathname.startsWith("/pawreport/") || pathname === "/my-paws";

  useEffect(() => {
    if (authDisabled && isLogin) {
      navigate({ to: "/" });
    }
  }, [authDisabled, isLogin, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream text-muted">
        Loading Palmwoods Paws Ops…
      </div>
    );
  }

  if (isPublicCustomer || (isLogin && !authDisabled)) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
