import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ANNA_LOGIN_EMAIL, AUTH_DISABLED } from "@/lib/config";
import { LOGO_SRC } from "@/lib/brand";
import { Button, Field, inputClassName } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "setup" | "reset";

function LoginPage() {
  const { signIn, resetPassword, user, configured, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(ANNA_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !AUTH_DISABLED) {
      void navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "reset") {
        const res = await resetPassword(email);
        if (res.error) setError(res.error);
        else setInfo("Password reset email sent. Check your inbox.");
        return;
      }

      if (mode === "setup") {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
        }
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        const setupEmail = ANNA_LOGIN_EMAIL;
        const res = await fetch("/api/bootstrap-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: setupEmail,
            password,
            fullName: "Anna",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
          message?: string;
          hint?: string;
        };
        if (!res.ok) {
          const msg =
            typeof data.error === "string" && data.error.trim() && data.error !== "{}"
              ? data.error
              : "Could not set up login.";
          setError(data.hint ? `${msg} ${data.hint}` : msg);
          return;
        }
        const sign = await signIn(setupEmail, password);
        if (sign.error) {
          setInfo(data.message || "Login created. Sign in now.");
          setMode("signin");
          setEmail(setupEmail);
        } else {
          void navigate({ to: "/" });
        }
        return;
      }

      const res = await signIn(email, password);
      if (res.error) setError(res.error);
      else void navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-olive-800 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-warm-white p-6 shadow-xl md:p-8">
        <div className="mb-6 text-center">
          <img
            src={LOGO_SRC}
            alt="Palmwoods Paws"
            className="mx-auto mb-3 h-16 w-auto object-contain"
          />
          <h1 className="font-display text-3xl text-olive-950">
            {mode === "setup" ? "Create login" : mode === "reset" ? "Reset password" : "Sign in"}
          </h1>
          <p className="mt-1 text-muted">Anna&apos;s Palmwoods Paws Ops</p>
        </div>

        {!configured ? (
          <div className="mb-4 rounded-xl border border-gold/40 bg-cream p-3 text-sm text-olive-900">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <Field label="Email">
            <input
              className={inputClassName()}
              type="email"
              autoComplete="email"
              value={mode === "setup" ? ANNA_LOGIN_EMAIL : email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={mode === "setup"}
            />
          </Field>
          {mode === "setup" ? (
            <p className="text-xs text-muted">
              Must be <strong>contact@palmwoodspaws.com</strong> (one &quot;s&quot; in paws).
            </p>
          ) : null}

          {mode !== "reset" ? (
            <Field label="Password">
              <input
                className={inputClassName()}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "setup" ? 8 : 6}
              />
            </Field>
          ) : null}

          {mode === "setup" ? (
            <Field label="Confirm password">
              <input
                className={inputClassName()}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </Field>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {info ? <p className="text-sm text-success">{info}</p> : null}

          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy || !configured}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "setup"
                  ? "Create Anna's login"
                  : "Send reset email"}
          </Button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm">
          {mode === "signin" ? (
            <>
              <button
                type="button"
                className="block w-full text-olive-800"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setInfo(null);
                }}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="block w-full text-muted"
                onClick={() => {
                  setMode("setup");
                  setError(null);
                  setInfo(null);
                  setEmail(ANNA_LOGIN_EMAIL);
                }}
              >
                First time? Set up Anna&apos;s login
              </button>
            </>
          ) : (
            <button
              type="button"
              className="w-full text-olive-800"
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
                setEmail(ANNA_LOGIN_EMAIL);
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
