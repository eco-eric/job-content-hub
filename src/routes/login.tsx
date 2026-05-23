import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signInWithMagicLink, user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signInWithMagicLink(email);
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="font-semibold tracking-tight mb-8 text-center">
          <span className="text-primary">●</span> Content Studio
        </div>
        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h2 className="font-medium">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight text-center">Sign in</h1>
            <p className="text-sm text-muted-foreground text-center">No password. We email you a link.</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}