import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Card, Chip, StatusBadge } from "@/components/AppShell";
import { CHANNELS, INTENTS } from "@/lib/constants";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

type Status = "all" | "draft" | "approved" | "exported";

function Library() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("all");
  const [projectId, setProjectId] = useState<string | "all">("all");

  const projectsQ = useQuery({
    enabled: !!user,
    queryKey: ["projects-lib", user?.id],
    queryFn: async () => (await supabase.from("projects").select("id,title").order("title")).data ?? [],
  });

  const contentQ = useQuery({
    enabled: !!user,
    queryKey: ["content", user?.id, status, projectId],
    queryFn: async () => {
      let q = supabase.from("content_items").select("*").order("updated_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = contentQ.data ?? [];

  return (
    <div>
      <PageHeader title="Library" subtitle="Everything you've generated, filterable by project and status." />
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "draft", "approved", "exported"] as Status[]).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === "all" ? "All statuses" : s}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <Chip active={projectId === "all"} onClick={() => setProjectId("all")}>All projects</Chip>
        {(projectsQ.data ?? []).map((p) => (
          <Chip key={p.id} active={projectId === p.id} onClick={() => setProjectId(p.id)}>{p.title}</Chip>
        ))}
      </div>
      {items.length === 0 ? (
        <Card className="text-center py-12 text-muted-foreground">No content matches these filters.</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => {
            const intent = INTENTS.find(i => i.id === c.intent)?.label ?? c.intent;
            const channel = CHANNELS.find(ch => ch.id === c.channel)?.label ?? c.channel;
            return (
              <Link key={c.id} to="/content/$contentId" params={{ contentId: c.id }}>
                <Card className="flex items-center justify-between hover:border-foreground/40">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.title ?? channel}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={c.status} />
                      <span>{intent}</span>
                      <span>·</span>
                      <span>{channel}</span>
                      <span>· {new Date(c.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}