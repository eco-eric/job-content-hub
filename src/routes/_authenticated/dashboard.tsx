import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PrimaryButton, Card, StatusBadge } from "@/components/AppShell";
import { CHANNELS } from "@/lib/constants";
import { Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  service_type_detail: string | null;
  worthiness_tag: string | null;
  interview_state: { completion_pct?: number } | null;
  updated_at: string;
};

type ContentRow = {
  id: string;
  project_id: string;
  headline: string | null;
  channel: string;
  status: string;
  updated_at: string;
};

function Dashboard() {
  const { user } = useAuth();
  const projectsQ = useQuery({
    enabled: !!user,
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,service_type_detail,worthiness_tag,interview_state,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });
  const contentQ = useQuery({
    enabled: !!user,
    queryKey: ["recent-content", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_assets")
        .select("id,project_id,headline,channel,status,updated_at")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ContentRow[];
    },
  });

  const projects = projectsQ.data ?? [];
  const inProgress = projects.filter((p) => {
    const pct = p.interview_state?.completion_pct ?? 0;
    return p.status === "triaging" || p.status === "interviewing" || (p.status !== "ready" && p.status !== "archived" && pct < 100);
  });
  const recent = contentQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="One finished job per project. Interview it once, generate content whenever."
        right={
          <Link to="/projects/new">
            <PrimaryButton><Plus className="h-4 w-4" /> Start a new project</PrimaryButton>
          </Link>
        }
      />

      <div className="space-y-10">
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pick up where you left off</h2>
          {inProgress.length === 0 ? (
            <Card className="text-center py-10 text-sm text-muted-foreground">
              Nothing in progress. Tap <span className="text-foreground font-medium">Start a new project</span> to begin.
            </Card>
          ) : (
            <div className="grid gap-3">
              {inProgress.map((p) => {
                const pct = p.interview_state?.completion_pct ?? 0;
                return (
                  <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
                    <Card className="hover:border-foreground/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                            <StatusBadge status={p.status} />
                            {p.service_type_detail && <span>{p.service_type_detail}</span>}
                          </div>
                          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{pct}% complete</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Recent content</h2>
          {recent.length === 0 ? (
            <Card className="text-center py-10 text-sm text-muted-foreground">No drafts yet.</Card>
          ) : (
            <div className="grid gap-3">
              {recent.map((c) => (
                <Link key={c.id} to="/content/$contentId" params={{ contentId: c.id }}>
                  <Card className="flex items-center justify-between hover:border-foreground/40 transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.headline ?? CHANNELS.find((ch) => ch.id === c.channel)?.label ?? c.channel}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <StatusBadge status={c.status} />
                        <span>{CHANNELS.find((ch) => ch.id === c.channel)?.label ?? c.channel}</span>
                        <span>· {new Date(c.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
