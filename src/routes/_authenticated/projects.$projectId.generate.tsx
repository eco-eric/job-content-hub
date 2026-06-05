import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import {
  INTENTS,
  INTENT_FOLLOWUPS,
  CHANNELS,
  ALL_CHANNELS,
  AUDIENCES,
  AUDIENCE_CHANNELS,
  INTENT_DEFAULT_AUDIENCE,
  type IntentId,
  type ChannelId,
  type AudienceId,
} from "@/lib/constants";
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
  const [audienceByIntent, setAudienceByIntent] = useState<Record<string, AudienceId>>({});
  const [channelsByIntent, setChannelsByIntent] = useState<Record<string, ChannelId[]>>({});
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"intents" | "followups">("intents");
  const [error, setError] = useState<string | null>(null);

  const allowedChannelsFor = (a: AudienceId): ChannelId[] =>
    AUDIENCE_CHANNELS[a].filter((c) => enabledChannels.includes(c));

  const toggleIntent = (id: IntentId) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Seed audience + channels on first selection.
      const defaultAud = INTENT_DEFAULT_AUDIENCE[id];
      setAudienceByIntent((m) => ({ ...m, [id]: m[id] ?? defaultAud }));
      setChannelsByIntent((m) => ({ ...m, [id]: m[id] ?? allowedChannelsFor(defaultAud) }));
      return [...prev, id];
    });

  const changeAudience = (intent: IntentId, audience: AudienceId) => {
    setAudienceByIntent((m) => ({ ...m, [intent]: audience }));
    const allowed = allowedChannelsFor(audience);
    setChannelsByIntent((m) => {
      const current = m[intent] ?? [];
      const kept = current.filter((c) => allowed.includes(c));
      // If nothing kept, default to all allowed.
      return { ...m, [intent]: kept.length ? kept : allowed };
    });
  };

  const toggleChannelFor = (intent: IntentId, channel: ChannelId) => {
    setChannelsByIntent((m) => {
      const cur = m[intent] ?? [];
      return { ...m, [intent]: cur.includes(channel) ? cur.filter((c) => c !== channel) : [...cur, channel] };
    });
  };

  const setNote = (intent: IntentId, key: string, val: string) =>
    setNotes((prev) => ({ ...prev, [intent]: { ...(prev[intent] ?? {}), [key]: val } }));

  const totalAssets = selected.reduce((sum, i) => sum + (channelsByIntent[i]?.length ?? 0), 0);

  const generateAll = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      let firstAssetId: string | null = null;
      for (const intent of selected) {
        const audience = audienceByIntent[intent] ?? INTENT_DEFAULT_AUDIENCE[intent];
        const intentChannels = channelsByIntent[intent] ?? [];
        if (!intentChannels.length) continue;
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
          await supabase.from("content_intents").update({ notes: intentNotes, audience }).eq("id", intentId);
        } else {
          const { data: created, error: ce } = await supabase
            .from("content_intents")
            .insert({ project_id: projectId, intent_type: intent, notes: intentNotes, audience })
            .select("id")
            .single();
          if (ce || !created) throw ce ?? new Error("Could not create intent");
          intentId = created.id;
        }

        // Social-proof follow-up doubles as projects.customer_quote.
        if (intent === "social_proof" && intentNotes.customer_quote?.trim()) {
          await supabase.from("projects").update({ customer_quote: intentNotes.customer_quote.trim() }).eq("id", projectId);
        }

        for (const channel of intentChannels) {
          const result = await generateContent({ projectId, intent, channel, audience });
          const { data: asset, error: ie } = await supabase
            .from("content_assets")
            .insert({
              project_id: projectId,
              intent_id: intentId,
              channel,
              audience,
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
        subtitle="Pick the angles, then choose who each one is for and which channels to fan out to."
        right={
          <Link to="/projects/$projectId" params={{ projectId }}>
            <SecondaryButton>Back</SecondaryButton>
          </Link>
        }
      />

      {step === "intents" && (
        <div className="space-y-3">
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
          </Card>

          {selected.map((intentId) => {
            const intent = INTENTS.find((i) => i.id === intentId)!;
            const audience = audienceByIntent[intentId] ?? INTENT_DEFAULT_AUDIENCE[intentId];
            const allowed = allowedChannelsFor(audience);
            const picked = channelsByIntent[intentId] ?? [];
            return (
              <Card key={intentId}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-medium">{intent.label}</div>
                    <div className="text-xs text-muted-foreground">{intent.blurb}</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">Audience</label>
                    <select
                      value={audience}
                      onChange={(e) => changeAudience(intentId, e.target.value as AudienceId)}
                      className="w-full h-11 rounded-md border border-input bg-card px-3 text-sm"
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">Channels</label>
                    <div className="flex flex-wrap gap-2">
                      {allowed.length === 0 && (
                        <p className="text-sm text-muted-foreground">No enabled channels match this audience. Enable channels in Settings.</p>
                      )}
                      {allowed.map((c) => {
                        const on = picked.includes(c);
                        return (
                          <button
                            key={c}
                            onClick={() => toggleChannelFor(intentId, c)}
                            className={
                              "min-h-11 px-3 rounded-full border text-sm transition-colors " +
                              (on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-input hover:border-foreground/40")
                            }
                          >
                            {CHANNELS.find((ch) => ch.id === c)?.label ?? c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground px-1">Will generate {totalAssets} {totalAssets === 1 ? "asset" : "assets"}.</p>
          )}
        </div>
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
            <PrimaryButton onClick={() => setStep("followups")} disabled={selected.length === 0 || totalAssets === 0} className="ml-auto">
              Next
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={generateAll} disabled={busy} className="ml-auto">
              {busy ? "Generating…" : `Generate ${totalAssets} ${totalAssets === 1 ? "draft" : "drafts"}`}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
