import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Dog,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Users,
  ClipboardList,
  Bell,
  LogOut,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

const desktopNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/pets", label: "Pets", icon: Dog },
  { to: "/visits", label: "Visits", icon: ClipboardList },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/messages", label: "Enquiries", icon: MessageSquare },
  { to: "/my-paws", label: "My Paws", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileNav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/pets", label: "Pets", icon: Dog },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/more", label: "More", icon: MoreHorizontal },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  soon,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-olive-700 text-warm-white"
          : "text-olive-100/85 hover:bg-olive-900 hover:text-warm-white",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {soon ? <span className="text-[10px] uppercase tracking-wide opacity-70">Soon</span> : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut, authDisabled } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <div className="min-h-dvh bg-cream md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-olive-800 text-warm-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link to="/" className="block">
            <img
              src={LOGO_SRC}
              alt="Palmwoods Paws"
              className="h-14 w-auto max-w-full object-contain object-left"
            />
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-gold">
            Dog walking &amp; pet minding
          </p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {desktopNav.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={isActive(item.to)}
              soon={"soon" in item && item.soon}
            />
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3">
            <p className="font-semibold">{profile?.full_name || "Anna"}</p>
            <p className="text-xs text-olive-100/70">Palmwoods, QLD</p>
            {authDisabled ? (
              <p className="text-xs text-gold/80">Auth off (dev)</p>
            ) : (
              <p className="truncate text-xs text-olive-100/60">{user?.email}</p>
            )}
          </div>
          {!authDisabled ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 text-sm text-olive-100/80 hover:text-gold"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-olive-950/50"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-olive-800 text-warm-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <p className="font-display text-lg">Menu</p>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {desktopNav.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.to)}
                  soon={"soon" in item && item.soon}
                  onClick={() => setDrawerOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-olive-100 bg-warm-white/95 px-4 py-3 backdrop-blur md:hidden">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-olive-900" />
          </button>
          <Link to="/" className="flex items-center justify-center">
            <img
              src={LOGO_SRC}
              alt="Palmwoods Paws"
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          </Link>
          <Link to="/invoices" aria-label="Invoices">
            <Bell className="h-5 w-5 text-olive-800" />
          </Link>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-olive-100 bg-warm-white px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="grid grid-cols-5 gap-1 py-2">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium",
                    active ? "text-olive-800" : "text-muted",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-gold-dark")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
