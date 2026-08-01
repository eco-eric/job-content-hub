import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton, StatusBadge, Chip } from "@/components/AppShell";
import {
  INTENTS,
  CHANNELS,
  AUDIENCES,
  AUDIENCE_CHANNELS,
  AUDIENCE_CHIP,
  type ChannelId,
  type IntentId,
  type AudienceId,
} from "@/lib/constants";
import { generateContent, type LengthVariant, type ToneOverride } from "@/lib/generation";
import { Copy, Download, AlertCircle, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/content/$contentId")({
  component: ContentEditor,
});

type Confirm = { key: string; prompt: string };

function ContentEditor() {
  const { contentId } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["content-asset", contentId],
    queryFn: async () =>
      (await supabase
        .from("content_assets")
        .select("*, content_intents(intent_type)")
        .eq("id", contentId)
        .single()).data,
  });

  const [body, setBody] = useState("");
  const [headline, setHeadline] = useState("");
  const [length, setLength] = useState<LengthVariant>("medium");
  const [tone, setTone] = useState<ToneOverride | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audienceSwitch, setAudienceSwitch] = useState<{ to: AudienceId; pickChannel: ChannelId | null } | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setBody(q.data.body ?? "");
    setHeadline(q.data.headline ?? "");
    setLength((q.data.length_variant as LengthVariant) ?? "medium");
    setTone((q.data.tone_overrides as ToneOverride | null) ?? null);
  }, [q.data]);

  const c = q.data;
  const intentType = (c as { content_intents?: { intent_type?: string } | null } | undefined)?.content_intents?.intent_type ?? "";
  const intentLabel = INTENTS.find((i) => i.id === intentType)?.label ?? intentType;
  const channelLabel = CHANNELS.find((ch) => ch.id === c?.channel)?.label ?? c?.channel ?? "";
  const audience = ((c as { audience?: AudienceId } | undefined)?.audience ?? "homeowner") as AudienceId;
  const audienceLabel = AUDIENCES.find((a) => a.id === audience)?.label ?? audience;

  const confirms = useMemo(
    () => (Array.isArray(c?.flagged_unknowns) ? (c!.flagged_unknowns as Confirm[]) : []),
    [c?.flagged_unknowns],
  );
  // Unresolved = still present in current body text. The body contains the PROMPT text, not the slug key.
  const remaining = confirms.filter(
    (cf) => body.includes(`[confirm: ${cf.prompt}]`) || body.includes(`[confirm:${cf.prompt}]`),
  );
  // Safety net: any surviving confirm marker at all, even if flagged_unknowns drifted.
  const hasAnyMarker = /\[confirm:/i.test(body);
  const canFinalize = remaining.length === 0 && !hasAnyMarker;

  // Click-to-resolve inline chips for [confirm: …] tokens.
  const resolveInline = async (key: string, replacement: string) => {
    if (!replacement.trim()) return;
    const next = body
      .replaceAll(`[confirm: ${key}]`, replacement.trim())
      .replaceAll(`[confirm:${key}]`, replacement.trim());
    setBody(next);
    const newFlagged = confirms.filter((cf) => cf.key !== key);
    await supabase.from("content_assets").update({ body: next, flagged_unknowns: newFlagged }).eq("id", contentId);
    qc.invalidateQueries({ queryKey: ["content-asset", contentId] });
  };

  const pushVersion = async () => {
    if (!c) return;
    const prior = (Array.isArray(c.version_history) ? c.version_history : []) as unknown[];
    const next = [...prior, { body: c.body, headline: c.headline, at: new Date().toISOString() }].slice(-20);
    return next;
  };

  const saveDraft = async () => {
    if (!c) return;
    setBusy("save");
    await supabase
      .from("content_assets")
      .update({ body, headline, length_variant: length, tone_overrides: tone })
      .eq("id", contentId);
    qc.invalidateQueries({ queryKey: ["content-asset", contentId] });
    setBusy(null);
  };

  const regenerate = async (overrideLength?: LengthVariant, overrideTone?: ToneOverride | null) => {
    if (!c) return;
    setBusy("regen");
    setError(null);
    try {
      const version_history = await pushVersion();
      const result = await generateContent({
        projectId: c.project_id,
        intent: intentType as IntentId,
        channel: c.channel as ChannelId,
        audience,
        length: overrideLength ?? length,
        tone: overrideTone === undefined ? tone : overrideTone,
      });
      await supabase
        .from("content_assets")
        .update({
          body: result.body,
          headline: result.headline,
          flagged_unknowns: result.flagged_unknowns,
          hashtags: result.hashtags ?? [],
          length_variant: overrideLength ?? length,
          tone_overrides: overrideTone === undefined ? tone : overrideTone,
          version_history: version_history as never,
              generation_metadata: result.generation_metadata ?? { generated_at: new Date().toISOString(), prompt_version: "unknown", model: "unknown" },
        })
        .eq("id", contentId);
      qc.invalidateQueries({ queryKey: ["content-asset", contentId] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const switchAudience = async (newAudience: AudienceId, newChannel?: ChannelId) => {
    if (!c) return;
    setBusy("regen");
    setError(null);
    try {
      const channel = (newChannel ?? c.channel) as ChannelId;
      const version_history = await pushVersion();
      const result = await generateContent({
        projectId: c.project_id,
        intent: intentType as IntentId,
        channel,
        audience: newAudience,
        length,
        tone,
      });
      await supabase
        .from("content_assets")
        .update({
          body: result.body,
          headline: result.headline,
          channel,
          audience: newAudience,
          flagged_unknowns: result.flagged_unknowns,
          hashtags: result.hashtags ?? [],
          version_history: version_history as never,
          generation_metadata: result.generation_metadata ?? { generated_at: new Date().toISOString(), prompt_version: "unknown", model: "unknown" },
        })
        .eq("id", contentId);
      qc.invalidateQueries({ queryKey: ["content-asset", contentId] });
      setAudienceSwitch(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const requestAudienceChange = (next: AudienceId) => {
    if (!c) return;
    if (next === audience) return;
    const allowed = AUDIENCE_CHANNELS[next];
    if (allowed.includes(c.channel as ChannelId)) {
      void switchAudience(next);
    } else {
      setAudienceSwitch({ to: next, pickChannel: allowed[0] ?? null });
    }
  };

  const setStatus = async (status: "draft" | "approved" | "exported") => {
    await supabase.from("content_assets").update({ status }).eq("id", contentId);
    qc.invalidateQueries({ queryKey: ["content-asset", contentId] });
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(`${headline}\n\n${body}`);
  };
  const download = async (ext: "md" | "txt") => {
    await setStatus("exported");
    const blob = new Blob([ext === "md" ? `# ${headline}\n\n${body}` : `${headline}\n\n${body}`], {
      type: ext === "md" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(headline || "content").replace(/\W+/g, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (q.isLoading || !c) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="pb-32">
      <PageHeader
        title={`${intentLabel} · ${audienceLabel} · ${channelLabel}`}
        subtitle="Edit freely. Resolve any [confirm: …] markers before approving."
        right={
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <Link to="/projects/$projectId" params={{ projectId: c.project_id }}>
              <SecondaryButton>Project</SecondaryButton>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Audience</span>
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => requestAudienceChange(a.id)}
              disabled={busy !== null}
              className={
                "min-h-9 px-3 rounded-full text-xs font-medium border transition-colors " +
                (a.id === audience ? AUDIENCE_CHIP[a.id] : "bg-card border-input text-muted-foreground hover:border-foreground/40")
              }
              aria-pressed={a.id === audience}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Card>

      {audienceSwitch && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <div className="space-y-3">
            <div>
              <div className="font-medium">Switching audience changes the channel</div>
              <p className="text-sm text-muted-foreground mt-1">
                {AUDIENCES.find((a) => a.id === audienceSwitch.to)?.label} content doesn't fit the current <strong>{channelLabel}</strong> channel. Pick a new channel to regenerate on.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_CHANNELS[audienceSwitch.to].map((ch) => (
                <Chip
                  key={ch}
                  active={audienceSwitch.pickChannel === ch}
                  onClick={() => setAudienceSwitch({ ...audienceSwitch, pickChannel: ch })}
                >
                  {CHANNELS.find((cc) => cc.id === ch)?.label ?? ch}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <PrimaryButton
                onClick={() => audienceSwitch.pickChannel && switchAudience(audienceSwitch.to, audienceSwitch.pickChannel)}
                disabled={!audienceSwitch.pickChannel || busy !== null}
              >
                {busy === "regen" ? "Regenerating…" : "Switch and regenerate"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setAudienceSwitch(null)} disabled={busy !== null}>Cancel</SecondaryButton>
            </div>
          </div>
        </Card>
      )}

      {remaining.length > 0 && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Unresolved facts ({remaining.length})</div>
              <p className="text-sm text-muted-foreground mt-1">
                The generator didn't have these. Fill them in inline — clicking saves and removes the marker.
              </p>
              <ul className="mt-3 space-y-2">
                {remaining.map((cf) => (
                  <InlineConfirm key={cf.key} cf={cf} onResolve={(val) => resolveInline(cf.key, val)} />
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full text-lg font-medium rounded-md border border-input bg-card px-3 py-3 mb-3"
          placeholder="Headline"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={20}
          className="w-full rounded-md border border-input bg-card px-3 py-3 text-base font-mono leading-relaxed"
        />
      </Card>

      <Card className="mt-4">
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Length</div>
            <div className="flex flex-wrap gap-2">
              {(["short", "medium", "long"] as LengthVariant[]).map((l) => (
                <Chip key={l} active={length === l} onClick={() => { setLength(l); regenerate(l, undefined); }}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tone</div>
            <div className="flex flex-wrap gap-2">
              <Chip active={tone === null} onClick={() => { setTone(null); regenerate(undefined, null); }}>Default voice</Chip>
              <Chip active={tone === "more_technical"} onClick={() => { setTone("more_technical"); regenerate(undefined, "more_technical"); }}>More technical</Chip>
              <Chip active={tone === "more_homeowner"} onClick={() => { setTone("more_homeowner"); regenerate(undefined, "more_homeowner"); }}>More homeowner-friendly</Chip>
            </div>
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:static md:bg-transparent md:border-0 md:mt-6">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap gap-2 md:px-0">
          <PrimaryButton onClick={saveDraft} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </PrimaryButton>
          <SecondaryButton onClick={() => regenerate()} disabled={busy !== null}>
            <RefreshCw className={"h-4 w-4" + (busy === "regen" ? " animate-spin" : "")} /> Regenerate
          </SecondaryButton>
          <SecondaryButton onClick={() => setStatus("approved")} disabled={!canFinalize || c.status === "approved"}>
            Approve
          </SecondaryButton>
          {hasAnyMarker && remaining.length === 0 && (
            <p className="w-full md:w-auto self-center text-xs text-destructive">
              Unresolved [confirm: …] markers are still in the body. Remove them before approving.
            </p>
          )}
          <div className="ml-auto flex gap-2">
            <SecondaryButton onClick={copyText}><Copy className="h-4 w-4" /> Copy</SecondaryButton>
            <SecondaryButton onClick={() => download("md")} disabled={!canFinalize}><Download className="h-4 w-4" /> .md</SecondaryButton>
            <SecondaryButton onClick={() => download("txt")} disabled={!canFinalize}><Download className="h-4 w-4" /> .txt</SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineConfirm({ cf, onResolve }: { cf: Confirm; onResolve: (val: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <li className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-background border border-border px-2 py-1 text-xs">[confirm: {cf.key}]</code>
      <span className="text-sm text-muted-foreground">{cf.prompt}</span>
      <div className="flex w-full sm:w-auto gap-2 mt-1 sm:mt-0">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Type the answer"
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          onClick={() => onResolve(val)}
          disabled={!val.trim()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Resolve
        </button>
      </div>
    </li>
  );
}
