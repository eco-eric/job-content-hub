import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { questionsFor, ARRAY_COLUMNS } from "@/lib/interview";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/interview")({
  component: Interview,
});

function fromColumn(v: unknown, isArray: boolean): string {
  if (v == null) return "";
  if (isArray && Array.isArray(v)) return v.join(", ");
  return String(v);
}

function toColumn(value: string, isArray: boolean) {
  if (isArray) return value.split(",").map(s => s.trim()).filter(Boolean);
  return value.trim() ? value : null;
}

function Interview() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const project = projectQ.data;
  const questions = questionsFor(project?.worthiness_tag);
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!project) return;
    const m: Record<string, string> = {};
    for (const q of questions) {
      m[q.key] = fromColumn((project as Record<string, unknown>)[q.key], ARRAY_COLUMNS.has(q.key));
    }
    setVals(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.worthiness_tag]);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const save = (key: string, value: string) => {
    setVals(p => ({ ...p, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const payload: Record<string, unknown> = { [key]: toColumn(value, ARRAY_COLUMNS.has(key)) };
      if (project?.status === "draft") payload.status = "in_progress";
      await supabase.from("projects").update(payload).eq("id", projectId);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    }, 600);
  };

  if (projectQ.isLoading || !project) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const filled = (k: string) => {
    const v = vals[k];
    if (!v) return false;
    if (ARRAY_COLUMNS.has(k)) return v.split(",").some(s => s.trim());
    return v.trim().length > 0;
  };

  return (
    <div>
      <PageHeader title="Interview" subtitle="Answer in any order. We autosave. Come back later if you need to."
        right={<Link to="/projects/$projectId" params={{ projectId }}><SecondaryButton>Done for now</SecondaryButton></Link>}
      />
      <div className="space-y-4">
        {questions.map((q) => (
          <Card key={q.key}>
            <div className="flex items-start gap-3 mb-3">
              <div className={"mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs " + (filled(q.key) ? "bg-primary text-primary-foreground" : "border border-border")}>
                {filled(q.key) && <Check className="h-3 w-3" />}
              </div>
              <div>
                <div className="font-medium">{q.prompt}{q.required && <span className="text-destructive"> *</span>}</div>
                {q.hint && <div className="text-sm text-muted-foreground">{q.hint}</div>}
              </div>
            </div>
            <VoiceField value={vals[q.key] ?? ""} onChange={(v) => save(q.key, v)} multiline={q.multiline} rows={3} />
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Link to="/projects/$projectId" params={{ projectId }}><PrimaryButton>Back to project</PrimaryButton></Link>
      </div>
    </div>
  );
}
