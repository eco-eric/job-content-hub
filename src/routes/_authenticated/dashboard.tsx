import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, PrimaryButton, Card, StatusBadge } from "@/components/AppShell";
import { Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const projectsQ = useQuery({
    enabled: !!user,
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const projects = projectsQ.data ?? [];
  const inProgress = projects.filter((p) => p.status === "triaging" || p.status === "interviewing");
  const ready = projects.filter((p) => p.status === "ready");
  const archived = projects.filter((p) => p.status === "archived");

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="One finished job per project. Interview it once, generate content whenever."
        right={
          <Link to="/projects/new">
            <PrimaryButton><Plus className="h-4 w-4" /> New project</PrimaryButton>
          </Link>
        }
      />
      {projectsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted-foreground">No projects yet.</p>
          <Link to="/projects/new" className="inline-block mt-4">
            <PrimaryButton><Plus className="h-4 w-4" /> Start your first project</PrimaryButton>
          </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          {inProgress.length > 0 && <Section title="Pick up where you left off" items={inProgress} />}
          {ready.length > 0 && <Section title="Ready to generate" items={ready} />}
          {archived.length > 0 && <Section title="Archived" items={archived} />}
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: Array<{ id: string; title: string; status: string; service_line: string | null; updated_at: string }> }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      <div className="grid gap-3">
        {items.map((p) => (
          <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
            <Card className="flex items-center justify-between hover:border-foreground/40 transition-colors">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={p.status} />
                  {p.service_line && <span>{p.service_line}</span>}
                  <span>· {new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}