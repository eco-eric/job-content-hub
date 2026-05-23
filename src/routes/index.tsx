import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <div className="font-semibold tracking-tight"><span className="text-primary">●</span> Content Studio</div>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-3xl px-4 py-16 md:py-24">
        <p className="text-sm font-medium text-primary uppercase tracking-wider">For HVAC pros</p>
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          One job. Done right.<br />Now turn it into content.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          Project Content Studio takes a finished job and walks you through a short, voice-friendly
          interview — then drafts blog posts, social posts, and case studies you can actually use.
          Nothing made up. Nothing you didn't say.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/login" className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Get started
          </Link>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3 text-sm">
          {[
            { h: "Field-friendly", b: "Tap chips. Talk to your phone. Pick up where you left off." },
            { h: "No invented facts", b: "If you didn't say it, the draft asks you to confirm it." },
            { h: "Four channels", b: "Blog, Facebook, Instagram, case study — from one interview." },
          ].map((c) => (
            <div key={c.h} className="rounded-lg border border-border bg-card p-5">
              <div className="font-medium">{c.h}</div>
              <div className="mt-1 text-muted-foreground">{c.b}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
