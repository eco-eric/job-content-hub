import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { INTENTS, INTENT_FOLLOWUPS, CHANNELS, ALL_CHANNELS, type IntentId, type ChannelId } from "@/lib/constants";
import { generateContent } from "@/lib/generation";

export const Route = createFileRoute("/_authenticated/projects/$projectId/generate")({
  component: Generate,
});

function Generate() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () =>
      (await supabase.from("companies").select("channels_enabled").eq("owner_user_id", user!.id).maybeSingle()).data,
  });
  const enabledChannels = ((companyQ.data?.channels_enabled?.length
    ? companyQ.data.channels_enabled
    : ALL_CHANNELS) as ChannelId[]);

  const [selected, setSelected] = useState<IntentId[]>([]);
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"intents" | "followups">("intents");
  const [error, setError] = useState<string | null>(null);

  const toggleIntent = (id: IntentId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setNote = (intent: IntentId, key: string, val: string) =>
    setNotes((prev) => ({ ...prev, [intent]: { ...(prev[intent] ?? {}), [key]: val } }));

  const generateAll = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      let firstAssetId: string | null = null;
      for (const intent of selected) {
        // Upsert content_intents row.
        const { data: existing } = await supabase
          .from("content_intents")
          .select("id")
          .eq("project_id", projectId)
          .eq("intent_type", intent)
          .maybeSingle();
        const intentNotes = notes[intent] ?? {};
        let intentId = existing?.id;
        if (intentId) {
          await supabase.from("content_intents").update({ notes: intentNotes }).eq("id", intentId);
        } else {
          const { data: created, error: ce } = await supabase
            .from("content_intents")
            .insert({ project_id: projectId, intent_type: intent, notes: intentNotes })
            .select("id")
            .single();
          if (ce || !created) throw ce ?? new Error("Could not create intent");
          intentId = created.id;
        }

        // Social-proof follow-up doubles as projects.customer_quote.
        if (intent === "social_proof" && intentNotes.customer_quote?.trim()) {
          await supabase.from("projects").update({ customer_quote: intentNotes.customer_quote.trim() }).eq("id", projectId);
        }

        // One asset per enabled channel.
        for (const channel of enabledChannels) {
          const result = await generateContent({ projectId, intent, channel });
          const { data: asset, error: ie } = await supabase
            .from("content_assets")
            .insert({
              project_id: projectId,
              intent_id: intentId,
              channel,
              status: "draft",
              headline: result.headline,
              body: result.body,
              hashtags: result.hashtags ?? [],
              flagged_unknowns: result.flagged_unknowns,
              generation_metadata: result.generation_metadata ?? { generated_at: new Date().toISOString(), prompt_version: "unknown", model: "unknown" },
            })
            .select("id")
            .single();
          if (ie || !asset) throw ie ?? new Error("Insert failed");
          if (!firstAssetId) firstAssetId = asset.id;
        }
      }
      if (firstAssetId) nav({ to: "/content/$contentId", params: { contentId: firstAssetId } });
      else nav({ to: "/projects/$projectId", params: { projectId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      <PageHeader
        title="Generate content"
        subtitle="Pick the angles. We'll draft one piece per angle for every channel you've enabled."
        right={
          <Link to="/projects/$projectId" params={{ projectId }}>
            <SecondaryButton>Back</SecondaryButton>
          </Link>
        }
      />

      {step === "intents" && (
        <Card>
          <h2 className="font-medium mb-4">1. What angles do you want?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTENTS.map((i) => (
              <button
                key={i.id}
                onClick={() => toggleIntent(i.id)}
                className={
                  "text-left rounded-md border p-4 transition-colors " +
                  (selected.includes(i.id) ? "border-primary bg-primary/5" : "border-input hover:border-foreground/40")
                }
              >
                <div className="font-medium">{i.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{i.blurb}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Channels: {enabledChannels.map((c) => CHANNELS.find((ch) => ch.id === c)?.label).join(", ")}.
          </p>
        </Card>
      )}

      {step === "followups" && (
        <div className="space-y-4">
          {selected.map((intent) => {
            const fus = INTENT_FOLLOWUPS[intent];
            return (
              <Card key={intent}>
                <h2 className="font-medium">{INTENTS.find((i) => i.id === intent)?.label} — a couple quick questions</h2>
                <div className="mt-4 space-y-4">
                  {fus.map((fu) => (
                    <div key={fu.key}>
                      <label className="block text-sm font-medium mb-2">{fu.prompt}</label>
                      <VoiceField
                        multiline
                        rows={3}
                        value={notes[intent]?.[fu.key] ?? ""}
                        onChange={(v) => setNote(intent, fu.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:static md:bg-transparent md:border-0 md:mt-6">
        <div className="mx-auto max-w-5xl px-4 py-3 flex gap-3 md:px-0">
          {step === "followups" && (
            <SecondaryButton onClick={() => setStep("intents")}>Back</SecondaryButton>
          )}
          {step === "intents" ? (
            <PrimaryButton onClick={() => setStep("followups")} disabled={selected.length === 0} className="ml-auto">
              Next
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={generateAll} disabled={busy} className="ml-auto">
              {busy ? "Generating…" : `Generate ${selected.length * enabledChannels.length} drafts`}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
