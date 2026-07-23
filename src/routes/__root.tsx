import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";

function RootComponent() {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!configured && !isLogin) {
      // Allow browsing login screen even without env; show setup message there
      navigate({ to: "/login" });
      return;
    }
    if (!user && !isLogin) {
      navigate({ to: "/login" });
    }
    if (user && isLogin) {
      navigate({ to: "/" });
    }
  }, [user, loading, configured, isLogin, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream text-muted">
        Loading Palmwoods Paws Ops…
      </div>
    );
  }

  if (isLogin) {
    return <Outlet />;
  }

  if (!user) {
    return null;
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
