import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50",
        size === "sm" && "px-3 py-2 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "min-h-12 px-5 py-3 text-base",
        variant === "primary" && "bg-olive-800 text-warm-white hover:bg-olive-900",
        variant === "gold" && "bg-gold text-olive-950 hover:bg-gold-dark",
        variant === "secondary" && "border border-olive-100 bg-warm-white text-olive-900 hover:bg-olive-100",
        variant === "ghost" && "text-olive-800 hover:bg-olive-100",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-olive-100 bg-warm-white p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-olive-950 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted md:text-base">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-olive-900">{label}</span>
      {children}
    </label>
  );
}

export function inputClassName(extra?: string) {
  return cn(
    "w-full rounded-xl border border-olive-100 bg-cream px-3 py-2.5 text-ink outline-none focus:border-olive-700",
    extra,
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <h3 className="font-display text-xl text-olive-950">{title}</h3>
      <p className="mt-2 text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "info" | "success";
  icon?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "min-w-0",
        tone === "danger" && "border-danger/20",
        tone === "info" && "border-info/20",
        tone === "success" && "border-success/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1 font-display text-2xl text-olive-950">{value}</p>
          {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
        </div>
        {icon}
      </div>
    </Card>
  );
}

export function SoftLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={cn("font-semibold text-olive-800 hover:text-gold-dark", className)}>
      {children}
    </Link>
  );
}
