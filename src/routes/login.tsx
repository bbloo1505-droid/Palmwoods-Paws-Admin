import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { PawPrint } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, Field, inputClassName } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Anna");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await signIn(email, password);
        if (res.error) setError(res.error);
      } else {
        const res = await signUp(email, password, fullName);
        if (res.error) setError(res.error);
        else setInfo("Account created. If email confirmation is enabled, check your inbox, then sign in.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-olive-800 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-warm-white p-6 shadow-xl md:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-olive-800 text-gold">
            <PawPrint className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl text-olive-950">Palmwoods Paws Ops</h1>
          <p className="mt-1 text-muted">Anna&apos;s daily operating system</p>
        </div>

        {!configured ? (
          <div className="mb-4 rounded-xl border border-gold/40 bg-cream p-3 text-sm text-olive-900">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env.local</code>, then restart the app. See README for setup.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {mode === "signup" ? (
            <Field label="Your name">
              <input
                className={inputClassName()}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Field>
          ) : null}
          <Field label="Email">
            <input
              className={inputClassName()}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClassName()}
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {info ? <p className="text-sm text-success">{info}</p> : null}

          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy || !configured}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-sm text-olive-800"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
