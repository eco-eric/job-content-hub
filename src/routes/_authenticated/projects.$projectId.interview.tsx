import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, PrimaryButton, SecondaryButton, Chip } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { questionsFor, computeState, ARRAY_COLUMNS, type Question } from "@/lib/interview";
import { Image as ImageIcon, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/interview")({
  component: Interview,
});

type ServiceLine = { id: string; name: string };

function readColumn(project: Record<string, unknown>, key: string): string {
  const v = project[key];
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function toColumn(value: string, isArray: boolean) {
  if (isArray) return value.split(",").map((s) => s.trim()).filter(Boolean);
  return value.trim() ? value.trim() : null;
}

function Interview() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () =>
      (await supabase.from("companies").select("service_lines").eq("owner_user_id", user!.id).maybeSingle()).data,
  });

  const project = projectQ.data;
  const questions = useMemo(() => questionsFor(project?.worthiness_tag ?? null), [project?.worthiness_tag]);
  const serviceLines = (Array.isArray(companyQ.data?.service_lines) ? companyQ.data!.service_lines : []) as unknown as ServiceLine[];

  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [uploading, setUploading] = useState(false);

  // Hydrate current question's value when project or step changes.
  useEffect(() => {
    if (!project) return;
    const q = questions[step];
    if (!q) return;
    if (q.id === "location") {
      setCity(((project as Record<string, unknown>).location_city as string) ?? "");
      setNeighborhood(((project as Record<string, unknown>).location_neighborhood as string) ?? "");
    } else {
      setValue(readColumn(project as Record<string, unknown>, q.column));
    }
  }, [project, step, questions]);

  const persist = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueSave = (q: Question, nextVal: string, nextCity?: string, nextNeighborhood?: string) => {
    if (persist.current) clearTimeout(persist.current);
    persist.current = setTimeout(() => {
      persist.current = null;
      doSave(q, nextVal, nextCity, nextNeighborhood);
    }, 800);
  };

  const flushSave = async (q: Question) => {
    if (persist.current) {
      clearTimeout(persist.current);
      persist.current = null;
      await doSave(q, value, city, neighborhood);
    }
  };

  const doSave = async (q: Question, nextVal: string, nextCity?: string, nextNeighborhood?: string) => {
    if (!project) return;
    const payload: Record<string, unknown> = {};
    if (q.id === "location") {
      payload.location_city = (nextCity ?? city).trim() || null;
      payload.location_neighborhood = (nextNeighborhood ?? neighborhood).trim() || null;
    } else if (q.appendTo) {
      // Append (with separator) to the target column rather than overwriting.
      const existing = readColumn(project as Record<string, unknown>, q.appendTo);
      const sep = existing && nextVal ? "\n\n" : "";
      const combined = (existing ? existing : "") + sep + nextVal.trim();
      payload[q.appendTo] = toColumn(combined, ARRAY_COLUMNS.has(q.appendTo));
    } else {
      payload[q.column] = toColumn(nextVal, ARRAY_COLUMNS.has(q.column));
    }
    // Recompute interview_state.
    const draftProject = { ...(project as Record<string, unknown>), ...payload };
    const state = computeState(questions, draftProject);
    payload.interview_state = state;
    if (project.status === "triaging" || project.status === "draft") payload.status = "interviewing";
    await supabase.from("projects").update(payload).eq("id", projectId);
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  // Chip handlers
  const tapChip = (q: Question, chip: string) => {
    if (q.chipMode === "replace") {
      setValue(chip);
      queueSave(q, chip);
      return;
    }
    // toggle
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const has = parts.includes(chip);
    const next = has ? parts.filter((p) => p !== chip) : [...parts, chip];
    const joined = next.join(", ");
    setValue(joined);
    queueSave(q, joined);
  };

  // Photo upload at this step
  const onPhoto = async (q: Question, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("project-photos").upload(path, file);
    if (!up.error) {
      await supabase.from("media").insert({
        project_id: projectId,
        url: path,
        type: "image",
        tag: q.photoTag ?? "detail",
      });
    }
    setUploading(false);
    e.target.value = "";
  };

  const finishLater = async () => {
    nav({ to: "/projects/$projectId", params: { projectId } });
  };

  const goNext = async () => {
    const q = questions[step];
    await flushSave(q);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // Branch complete -> ready
      await supabase
        .from("projects")
        .update({ status: "ready", completed_at: new Date().toISOString() })
        .eq("id", projectId);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      nav({ to: "/projects/$projectId", params: { projectId } });
    }
  };

  const goBack = async () => {
    if (step === 0) return;
    await flushSave(questions[step]);
    setStep(step - 1);
  };

  if (projectQ.isLoading || !project) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const q = questions[step];
  if (!q) return <p className="text-sm text-muted-foreground">No questions.</p>;

  const pct = Math.round(((step + 1) / questions.length) * 100);
  const isLocation = q.id === "location";
  const chipsList =
    q.chips === "service_lines" ? serviceLines.map((l) => l.name) : Array.isArray(q.chips) ? q.chips : [];
  const activeChips = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));

  return (
    <div className="pb-32">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
          <span>Question {step + 1} of {questions.length}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Card>
        <h1 className="text-xl font-medium leading-snug">
          {q.prompt}
          {q.required && <span className="text-destructive"> *</span>}
        </h1>
        {q.hint && <p className="text-sm text-muted-foreground mt-2">{q.hint}</p>}

        {chipsList.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chipsList.map((c) => (
              <Chip key={c} active={q.chipMode === "replace" ? value === c : activeChips.has(c)} onClick={() => tapChip(q, c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-5">
          {isLocation ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <VoiceField
                  value={city}
                  onChange={(v) => { setCity(v); queueSave(q, value, v, neighborhood); }}
                  onBlur={() => flushSave(q)}
                  placeholder="e.g. Boston"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Neighborhood (optional)</label>
                <VoiceField
                  value={neighborhood}
                  onChange={(v) => { setNeighborhood(v); queueSave(q, value, city, v); }}
                  onBlur={() => flushSave(q)}
                  placeholder="e.g. Jamaica Plain"
                />
              </div>
            </div>
          ) : (
            <VoiceField
              value={value}
              onChange={(v) => { setValue(v); queueSave(q, v); }}
              onBlur={() => flushSave(q)}
              multiline={q.multiline}
              rows={4}
              placeholder="Tap the mic, or type."
            />
          )}
        </div>

        {q.allowPhoto && (
          <div className="mt-4">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-card px-4 py-3 hover:bg-accent text-sm font-medium min-h-11">
              <ImageIcon className="h-4 w-4" />
              {uploading ? "Uploading…" : `Attach a ${q.photoTag ?? "detail"} photo`}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => onPhoto(q, e)} className="hidden" />
            </label>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="h-3 w-3" /> Autosaved
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:static md:bg-transparent md:border-0 md:mt-6">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-3 md:px-0">
          <SecondaryButton onClick={goBack} disabled={step === 0}>
            Back
          </SecondaryButton>
          <Link to="/projects/$projectId" params={{ projectId }} className="ml-auto">
            <SecondaryButton onClick={finishLater}>Save & finish later</SecondaryButton>
          </Link>
          <PrimaryButton onClick={goNext} className="min-w-32">
            {step === questions.length - 1 ? "Mark ready" : "Next"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
