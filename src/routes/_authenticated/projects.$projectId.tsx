import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/AppShell";
import { questionsFor, ARRAY_COLUMNS } from "@/lib/interview";
import { WORTHINESS_TAGS, CHANNELS, INTENTS } from "@/lib/constants";
import { Image as ImageIcon, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectHub,
});

function isFilled(value: unknown, isArray: boolean) {
  if (value == null) return false;
  if (isArray) return Array.isArray(value) && value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : !!value;
}

function ProjectHub() {
  const { projectId } = Route.useParams();
  const nav = useNavigate();

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const photosQ = useQuery({
    queryKey: ["media", projectId],
    queryFn: async () => (await supabase.from("media").select("id").eq("project_id", projectId)).data ?? [],
  });
  const contentQ = useQuery({
    queryKey: ["project-content", projectId],
    queryFn: async () => (await supabase
      .from("content_assets")
      .select("id,headline,channel,status,updated_at,intent_id,content_intents(intent_type)")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })).data ?? [],
  });

  const project = projectQ.data;
  if (projectQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>;

  const questions = questionsFor(project.worthiness_tag);
  const answered = questions.filter(q => isFilled((project as Record<string, unknown>)[q.column], ARRAY_COLUMNS.has(q.column))).length;
  const requiredDone = questions
    .filter(q => q.required)
    .every(q => isFilled((project as Record<string, unknown>)[q.column], ARRAY_COLUMNS.has(q.column)));
  const tagLabel = WORTHINESS_TAGS.find(t => t.id === project.worthiness_tag)?.label;

  const markReady = async () => {
    await supabase.from("projects").update({ status: "ready", completed_at: new Date().toISOString() }).eq("id", projectId);
    projectQ.refetch();
  };

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={[tagLabel, project.service_type_detail].filter(Boolean).join(" · ") || undefined}
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
            {(contentQ.data ?? []).map((c) => {
              const intentType = (c as { content_intents?: { intent_type?: string } | null }).content_intents?.intent_type;
              return (
                <Link key={c.id} to="/content/$contentId" params={{ contentId: c.id }}>
                  <Card className="hover:border-foreground/40 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c.headline ?? CHANNELS.find(ch => ch.id === c.channel)?.label}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                        <StatusBadge status={c.status} />
                        {intentType && <span>{INTENTS.find(i => i.id === intentType)?.label ?? intentType}</span>}
                        <span>·</span>
                        <span>{CHANNELS.find(ch => ch.id === c.channel)?.label}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
