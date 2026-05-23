import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, Chip, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { INTENTS, CHANNELS } from "@/lib/constants";
import { generateContent } from "@/lib/generation";
import type { Database } from "@/integrations/supabase/types";

type Intent = Database["public"]["Enums"]["content_intent"];
type Channel = Database["public"]["Enums"]["content_channel"];

export const Route = createFileRoute("/_authenticated/projects/$projectId/generate")({
  component: Generate,
});

function Generate() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!user || !intent || !channel) return;
    setBusy(true); setError(null);
    try {
      const result = await generateContent({ projectId, intent, channel });
      const { data, error } = await supabase.from("content_items").insert({
        user_id: user.id, project_id: projectId, intent, channel,
        title: result.title, body_md: result.body_md,
        unresolved_confirms: result.unresolved_confirms,
      }).select("id").single();
      if (error || !data) throw error ?? new Error("Insert failed");
      nav({ to: "/content/$contentId", params: { contentId: data.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Generate content" subtitle="Pick the angle, then the format."
        right={<Link to="/projects/$projectId" params={{ projectId }}><SecondaryButton>Back</SecondaryButton></Link>} />
      <Card className="space-y-6">
        <div>
          <h2 className="font-medium mb-3">1. Why does this piece exist?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTENTS.map(i => (
              <button key={i.id} onClick={() => setIntent(i.id as Intent)}
                className={"text-left rounded-md border p-4 transition-colors " + (intent === i.id ? "border-primary bg-primary/5" : "border-input hover:border-foreground/40")}>
                <div className="font-medium">{i.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{i.blurb}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-medium mb-3">2. Where is it going?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.map(c => (
              <button key={c.id} onClick={() => setChannel(c.id as Channel)}
                className={"text-left rounded-md border p-4 transition-colors " + (channel === c.id ? "border-primary bg-primary/5" : "border-input hover:border-foreground/40")}>
                <div className="font-medium">{c.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.blurb}</div>
              </button>
            ))}
          </div>
        </div>
      </Card>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
      <div className="mt-6">
        <PrimaryButton onClick={go} disabled={busy || !intent || !channel}>{busy ? "Generating…" : "Generate draft"}</PrimaryButton>
      </div>
    </div>
  );
}