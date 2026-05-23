import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { questionsFor } from "@/lib/interview";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/interview")({
  component: Interview,
});

function Interview() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const answersQ = useQuery({
    queryKey: ["answers", projectId],
    queryFn: async () => (await supabase.from("project_answers").select("*").eq("project_id", projectId)).data ?? [],
  });

  const project = projectQ.data;
  const questions = questionsFor(project?.worthiness_tag);
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!answersQ.data) return;
    const m: Record<string, string> = {};
    for (const a of answersQ.data) {
      const v = a.value as unknown;
      m[a.question_key] = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
    }
    setVals(m);
  }, [answersQ.data]);

  // Debounced autosave per field
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const save = (key: string, value: string) => {
    setVals((p) => ({ ...p, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      await supabase.from("project_answers").upsert(
        { project_id: projectId, question_key: key, value: value || null },
        { onConflict: "project_id,question_key" }
      );
      qc.invalidateQueries({ queryKey: ["answers", projectId] });
    }, 600);
  };

  if (projectQ.isLoading || !project) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const filled = (k: string) => !!(vals[k] && vals[k].trim());

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