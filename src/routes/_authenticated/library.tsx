import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Card, Chip, StatusBadge } from "@/components/AppShell";
import { CHANNELS, INTENTS, type ChannelId, type IntentId } from "@/lib/constants";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

type StatusFilter = "all" | "draft" | "approved" | "exported";

function Library() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [projectId, setProjectId] = useState<string | "all">("all");
  const [intent, setIntent] = useState<IntentId | "all">("all");
  const [channel, setChannel] = useState<ChannelId | "all">("all");

  const projectsQ = useQuery({
    enabled: !!user,
    queryKey: ["projects-lib", user?.id],
    queryFn: async () => (await supabase.from("projects").select("id,name").order("name")).data ?? [],
  });

  const contentQ = useQuery({
    enabled: !!user,
    queryKey: ["content", user?.id, status, projectId, intent, channel],
    queryFn: async () => {
      let q = supabase
        .from("content_assets")
        .select("id,headline,channel,status,updated_at,project_id,content_intents!inner(intent_type)")
        .order("updated_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      if (channel !== "all") q = q.eq("channel", channel);
      if (intent !== "all") q = q.eq("content_intents.intent_type", intent);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = contentQ.data ?? [];

  return (
    <div>
      <PageHeader title="Library" subtitle="Everything you've generated, filterable." />

      <FilterGroup label="Status">
        {(["all", "draft", "approved", "exported"] as StatusFilter[]).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === "all" ? "All" : s}</Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Intent">
        <Chip active={intent === "all"} onClick={() => setIntent("all")}>All</Chip>
        {INTENTS.map((i) => (
          <Chip key={i.id} active={intent === i.id} onClick={() => setIntent(i.id)}>{i.label}</Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Channel">
        <Chip active={channel === "all"} onClick={() => setChannel("all")}>All</Chip>
        {CHANNELS.map((c) => (
          <Chip key={c.id} active={channel === c.id} onClick={() => setChannel(c.id)}>{c.label}</Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Project">
        <Chip active={projectId === "all"} onClick={() => setProjectId("all")}>All</Chip>
        {(projectsQ.data ?? []).map((p) => (
          <Chip key={p.id} active={projectId === p.id} onClick={() => setProjectId(p.id)}>{p.name}</Chip>
        ))}
      </FilterGroup>

      {items.length === 0 ? (
        <Card className="text-center py-12 text-muted-foreground mt-4">No content matches these filters.</Card>
      ) : (
        <div className="grid gap-3 mt-4">
          {items.map((c) => {
            const intentType = (c as { content_intents?: { intent_type?: string } | null }).content_intents?.intent_type;
            const intentLabel = INTENTS.find((i) => i.id === intentType)?.label ?? intentType ?? "";
            const channelLabel = CHANNELS.find((ch) => ch.id === c.channel)?.label ?? c.channel;
            return (
              <Link key={c.id} to="/content/$contentId" params={{ contentId: c.id }}>
                <Card className="flex items-center justify-between hover:border-foreground/40">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.headline ?? channelLabel}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={c.status} />
                      <span>{intentLabel}</span>
                      <span>·</span>
                      <span>{channelLabel}</span>
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
