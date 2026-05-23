import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/AppShell";
import { questionsFor } from "@/lib/interview";
import { WORTHINESS_TAGS, CHANNELS, INTENTS } from "@/lib/constants";
import { Image as ImageIcon, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectHub,
});

function ProjectHub() {
  const { projectId } = Route.useParams();
  const nav = useNavigate();

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const answersQ = useQuery({
    queryKey: ["answers", projectId],
    queryFn: async () => (await supabase.from("project_answers").select("*").eq("project_id", projectId)).data ?? [],
  });
  const photosQ = useQuery({
    queryKey: ["photos", projectId],
    queryFn: async () => (await supabase.from("project_photos").select("*").eq("project_id", projectId)).data ?? [],
  });
  const contentQ = useQuery({
    queryKey: ["project-content", projectId],
    queryFn: async () => (await supabase.from("content_items").select("*").eq("project_id", projectId).order("updated_at", { ascending: false })).data ?? [],
  });

  const project = projectQ.data;
  if (projectQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>;

  const questions = questionsFor(project.worthiness_tag);
  const answered = (answersQ.data ?? []).filter(a => a.value !== null).length;
  const requiredKeys = questions.filter(q => q.required).map(q => q.key);
  const requiredDone = requiredKeys.every(k => (answersQ.data ?? []).some(a => a.question_key === k && a.value));
  const tagLabel = WORTHINESS_TAGS.find(t => t.id === project.worthiness_tag)?.label;

  const markReady = async () => {
    await supabase.from("projects").update({ status: "ready" }).eq("id", projectId);
    projectQ.refetch();
  };

  return (
    <div>
      <PageHeader
        title={project.title}
        subtitle={[tagLabel, project.service_line].filter(Boolean).join(" · ") || undefined}
        right={<StatusBadge status={project.status} />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/projects/$projectId/interview" params={{ projectId }}>
          <Card className="h-full hover:border-foreground/40">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Interview</div>
                <div className="text-sm text-muted-foreground mt-1">{answered}/{questions.length} answered</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/projects/$projectId/photos" params={{ projectId }}>
          <Card className="h-full hover:border-foreground/40">
            <div className="flex items-start gap-3">
              <ImageIcon className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Photos</div>
                <div className="text-sm text-muted-foreground mt-1">{(photosQ.data ?? []).length} uploaded</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/projects/$projectId/generate" params={{ projectId }}>
          <Card className="h-full hover:border-foreground/40">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Generate content</div>
                <div className="text-sm text-muted-foreground mt-1">{(contentQ.data ?? []).length} drafts</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {project.status !== "ready" && project.status !== "archived" && (
          <PrimaryButton onClick={markReady} disabled={!requiredDone}>
            {requiredDone ? "Mark interview complete" : "Answer required questions to continue"}
          </PrimaryButton>
        )}
        {project.status !== "archived" && (
          <SecondaryButton onClick={async () => { await supabase.from("projects").update({ status: "archived" }).eq("id", projectId); nav({ to: "/dashboard" }); }}>
            Archive project
          </SecondaryButton>
        )}
      </div>

      {(contentQ.data ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Generated content</h2>
          <div className="grid gap-3">
            {(contentQ.data ?? []).map((c) => (
              <Link key={c.id} to="/content/$contentId" params={{ contentId: c.id }}>
                <Card className="hover:border-foreground/40 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.title ?? CHANNELS.find(ch => ch.id === c.channel)?.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                      <StatusBadge status={c.status} />
                      <span>{INTENTS.find(i => i.id === c.intent)?.label}</span>
                      <span>·</span>
                      <span>{CHANNELS.find(ch => ch.id === c.channel)?.label}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}