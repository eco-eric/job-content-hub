import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Card, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { analyzeWalkthrough } from "@/lib/video.functions";
import { errorMessage } from "@/lib/utils";
import { canSegment, segmentVideo, SEGMENT_SECONDS, MAX_SOURCE_SECONDS, MAX_SOURCE_BYTES } from "@/lib/video-segment";
import { Trash2, Upload, Sparkles, FileText, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/video")({
  component: VideoWalkthrough,
});

const SINGLE_MAX_BYTES = 20 * 1024 * 1024;
const SINGLE_MAX_SECONDS = 125; // one clip fits in a single AI request

type Fields = {
  before_state?: string;
  scope_performed?: string;
  outcome?: string;
  equipment_used?: string[];
  materials_used?: string[];
  unusual_details?: string;
  lesson_learned?: string;
  customer_quote?: string;
};

type Analysis = {
  transcript?: string;
  document_markdown?: string;
  fields?: Fields;
  open_questions?: string[];
  source?: string;
  segments?: Array<{ index: number; start_seconds: number; status: string; error?: string | null }>;
};

const FIELD_LABELS: Record<keyof Fields, string> = {
  before_state: "What was wrong",
  scope_performed: "What you did",
  outcome: "Outcome",
  equipment_used: "Equipment used",
  materials_used: "Materials used",
  unusual_details: "What stood out",
  lesson_learned: "Lesson learned",
  customer_quote: "Customer quote",
};

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(el.duration || 0); };
    el.onerror = () => { URL.revokeObjectURL(el.src); resolve(0); };
    el.src = URL.createObjectURL(file);
  });
}

function VideoWalkthrough() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const runAnalysis = useServerFn(analyzeWalkthrough);
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  const videosQ = useQuery({
    queryKey: ["videos", projectId],
    queryFn: async () =>
      (await supabase.from("media").select("*").eq("project_id", projectId).eq("type", "video").order("created_at", { ascending: false })).data ?? [],
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const v of videosQ.data ?? []) {
        const { data } = await supabase.storage.from("project-videos").createSignedUrl(v.url, 3600);
        if (data?.signedUrl) next[v.id] = data.signedUrl;
      }
      setUrls(next);
    })();
  }, [videosQ.data]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setError(null);

    const seconds = await readDuration(file);
    const splittable = canSegment();
    const needsSplit = seconds > SINGLE_MAX_SECONDS || file.size > SINGLE_MAX_BYTES;

    if (file.size > MAX_SOURCE_BYTES) {
      setError(`That clip is ${(file.size / 1024 / 1024).toFixed(0)} MB. Keep walkthroughs under 200 MB.`);
      return;
    }
    if (seconds > MAX_SOURCE_SECONDS) {
      setError(`That clip is ${Math.round(seconds / 60)} minutes. Keep walkthroughs under 10 minutes for now.`);
      return;
    }
    if (needsSplit && !splittable) {
      setError("This browser can't split long clips. Record a shorter walkthrough (under 2 minutes) or try Chrome.");
      return;
    }

    setBusy(true);
    const base = `${user.id}/${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      const up = await supabase.storage.from("project-videos").upload(base, file, { contentType: file.type || "video/mp4" });
      if (up.error) throw up.error;

      let segments: Array<{ index: number; path: string; start_seconds: number; duration_seconds: number }> = [];

      if (needsSplit) {
        const parts = await segmentVideo(file, {
          onProgress: (done, total) => setPrep(`Preparing part ${done} of ${total}…`),
        });
        setPrep("Uploading parts…");
        for (const part of parts) {
          const path = `${base}.segments/${String(part.index).padStart(2, "0")}.webm`;
          const su = await supabase.storage.from("project-videos").upload(path, part.blob, { contentType: part.blob.type || "video/webm" });
          if (su.error) throw su.error;
          segments.push({ index: part.index, path, start_seconds: part.start_seconds, duration_seconds: part.duration_seconds });
        }
      }

      const ins = await supabase.from("media").insert({
        project_id: projectId,
        url: base,
        type: "video",
        tag: "process",
        duration_seconds: seconds ? Math.round(seconds) : null,
        segments,
        segment_count: segments.length,
      });
      if (ins.error) throw ins.error;
      qc.invalidateQueries({ queryKey: ["videos", projectId] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPrep(null);
      setBusy(false);
    }
  };

  const analyze = async (mediaId: string, onlySegments?: number[]) => {
    setError(null);
    setAnalyzingId(mediaId);
    setSavedDocId(null);
    setApplied({});
    try {
      await runAnalysis({ data: { mediaId, ...(onlySegments ? { onlySegments } : {}) } });
      await qc.invalidateQueries({ queryKey: ["videos", projectId] });
    } catch (e) {
      setError(errorMessage(e));
      await qc.invalidateQueries({ queryKey: ["videos", projectId] });
    } finally {
      setAnalyzingId(null);
    }
  };

  const remove = async (id: string, path: string) => {
    const { data: files } = await supabase.storage.from("project-videos").list(`${path}.segments`);
    const paths = [path, ...(files ?? []).map((f) => `${path}.segments/${f.name}`)];
    await supabase.storage.from("project-videos").remove(paths);
    await supabase.from("media").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["videos", projectId] });
  };

  const applyField = async (key: keyof Fields, value: string | string[]) => {
    const patch = { [key]: value } as Partial<Record<keyof Fields, string | string[]>>;
    const { error: ue } = await supabase
      .from("projects")
      .update(patch as never)
      .eq("id", projectId);
    if (ue) { setError(errorMessage(ue)); return; }
    setApplied((m) => ({ ...m, [key]: true }));
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const saveAsDocument = async (analysis: Analysis) => {
    setError(null);
    try {
      const { data: existing } = await supabase
        .from("content_intents")
        .select("id")
        .eq("project_id", projectId)
        .eq("intent_type", "process")
        .maybeSingle();
      let intentId = existing?.id;
      if (!intentId) {
        const { data: created, error: ce } = await supabase
          .from("content_intents")
          .insert({ project_id: projectId, intent_type: "process", audience: "knowledge_base", notes: {} })
          .select("id")
          .single();
        if (ce || !created) throw ce ?? new Error("Could not create the document");
        intentId = created.id;
      }
      const body = analysis.document_markdown ?? "";
      const headline = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Walkthrough notes";
      const { data: asset, error: ie } = await supabase
        .from("content_assets")
        .insert({
          project_id: projectId,
          intent_id: intentId,
          channel: "internal_doc",
          audience: "knowledge_base",
          status: "draft",
          headline,
          body,
          flagged_unknowns: (analysis.open_questions ?? []).map((q) => ({
            key: q.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) || "unknown",
            prompt: q,
          })),
          generation_metadata: { model: "walkthrough-video", prompt_version: "walkthrough-v1", generated_at: new Date().toISOString() },
        })
        .select("id")
        .single();
      if (ie || !asset) throw ie ?? new Error("Could not save the document");
      setSavedDocId(asset.id);
      nav({ to: "/content/$contentId", params: { contentId: asset.id } });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const videos = videosQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Walkthrough video"
        subtitle="Record yourself walking and talking through the job. We'll turn it into a timestamped document and draft answers."
        right={<Link to="/projects/$projectId" params={{ projectId }}><SecondaryButton>Back</SecondaryButton></Link>}
      />

      <Card>
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-card px-4 py-3 hover:bg-accent text-sm font-medium">
          <Upload className="h-4 w-4" /> {busy ? (prep ?? "Uploading…") : "Upload a walkthrough clip"}
          <input ref={inputRef} type="file" accept="video/*" capture="environment" onChange={onFile} className="hidden" />
        </label>
        <p className="text-xs text-muted-foreground mt-3">
          Up to 10 minutes. Anything over 2 minutes is split into {SEGMENT_SECONDS}-second parts right here in your browser — that takes about as long as the clip itself, so keep this tab open. Your original is kept as recorded.
        </p>
      </Card>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      <div className="mt-6 space-y-6">
        {videos.length === 0 && <p className="text-sm text-muted-foreground">No walkthrough clips yet.</p>}

        {videos.map((v) => {
          const analysis = (v.analysis ?? {}) as Analysis;
          const isReady = v.analysis_status === "ready";
          const running = analyzingId === v.id;
          return (
            <Card key={v.id}>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="md:w-72 shrink-0">
                  {urls[v.id] && <video src={urls[v.id]} controls playsInline className="w-full rounded-md border border-border" />}
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{v.duration_seconds ? `${v.duration_seconds}s` : "clip"}</span>
                    <button onClick={() => remove(v.id, v.url)} className="hover:text-destructive" aria-label="Delete clip">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={() => analyze(v.id)} disabled={running || busy}>
                      <Sparkles className="h-4 w-4" />
                      {running ? "Analyzing…" : isReady ? "Re-analyze" : "Analyze walkthrough"}
                    </PrimaryButton>
                    {v.segment_count > 0 && (
                      <span className="text-xs text-muted-foreground">{v.segment_count} parts will be sent for analysis.</span>
                    )}
                    {isReady && (
                      <SecondaryButton onClick={() => saveAsDocument(analysis)} disabled={!!savedDocId}>
                        <FileText className="h-4 w-4" /> Save as document
                      </SecondaryButton>
                    )}
                    {analysis.source === "audio-only" && (
                      <span className="text-xs text-muted-foreground">Audio only — the picture couldn't be read on this clip.</span>
                    )}
                  </div>

                  {v.analysis_status === "error" && (
                    <p className="text-sm text-destructive mt-3">{v.analysis_error}</p>
                  )}

                  {isReady && (
                    <div className="mt-5 space-y-5">
                      {(analysis.segments ?? []).filter((s) => s.status === "error").length > 0 && (
                        <div className="rounded-md border border-destructive/40 p-3">
                          <h3 className="text-xs uppercase tracking-wider text-destructive mb-2">Some parts failed</h3>
                          <ul className="text-sm space-y-2">
                            {(analysis.segments ?? []).filter((s) => s.status === "error").map((s) => (
                              <li key={s.index} className="flex items-start justify-between gap-3">
                                <span>Part {s.index + 1}: {s.error}</span>
                                <SecondaryButton onClick={() => analyze(v.id, [s.index])} disabled={running} className="shrink-0">
                                  Retry part
                                </SecondaryButton>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(analysis.open_questions ?? []).length > 0 && (
                        <div>
                          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Needs confirming</h3>
                          <ul className="list-disc pl-5 text-sm space-y-1">
                            {(analysis.open_questions ?? []).map((q) => <li key={q}>{q}</li>)}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Suggested answers</h3>
                        <div className="space-y-3">
                          {(Object.keys(FIELD_LABELS) as Array<keyof Fields>).map((key) => {
                            const raw = analysis.fields?.[key];
                            const value = Array.isArray(raw) ? raw : (raw ?? "");
                            const empty = Array.isArray(value) ? value.length === 0 : !value.trim();
                            if (empty) return null;
                            return (
                              <div key={key} className="rounded-md border border-border p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{FIELD_LABELS[key]}</div>
                                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                                      {Array.isArray(value) ? value.join(", ") : value}
                                    </p>
                                  </div>
                                  <SecondaryButton onClick={() => applyField(key, value)} disabled={applied[key]} className="shrink-0">
                                    {applied[key] ? <><Check className="h-4 w-4" /> Added</> : "Use this"}
                                  </SecondaryButton>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-xs text-muted-foreground">Nothing is written to the project until you tap "Use this".</p>
                        </div>
                      </div>

                      {analysis.document_markdown && (
                        <details>
                          <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">Walkthrough document</summary>
                          <pre className="mt-3 whitespace-pre-wrap break-words text-sm font-sans">{analysis.document_markdown}</pre>
                        </details>
                      )}

                      {analysis.transcript && (
                        <details>
                          <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">Transcript</summary>
                          <pre className="mt-3 whitespace-pre-wrap break-words text-sm font-sans">{analysis.transcript}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
