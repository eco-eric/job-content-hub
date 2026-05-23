import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, Chip, PageHeader, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { WORTHINESS_TAGS } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Tag = Database["public"]["Enums"]["worthiness_tag"];

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProject,
});

function NewProject() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [serviceLine, setServiceLine] = useState<string>("");
  const [tag, setTag] = useState<Tag | "nothing_special" | null>(null);
  const [busy, setBusy] = useState(false);

  const profileQ = useQuery({
    enabled: !!user,
    queryKey: ["company_profile", user?.id],
    queryFn: async () => (await supabase.from("company_profile").select("service_lines").eq("user_id", user!.id).maybeSingle()).data,
  });
  const lines = ((profileQ.data?.service_lines as unknown) as Array<{ name: string }> | undefined) ?? [];

  const create = async () => {
    if (!user || !title.trim() || !tag) return;
    setBusy(true);
    const status = tag === "nothing_special" ? "archived" : "interviewing";
    const worthiness_tag = tag === "nothing_special" ? null : (tag as Tag);
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: title.trim(), service_line: serviceLine || null, status, worthiness_tag })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return;
    if (tag === "nothing_special") nav({ to: "/dashboard" });
    else nav({ to: "/projects/$projectId/interview", params: { projectId: data.id } });
  };

  return (
    <div>
      <PageHeader title="New project" subtitle="Just enough to start. You can fill the rest in later." />

      <Card className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">What was the job?</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Heat pump replacement on Maple St."
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {lines.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Service line <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              {lines.map((l) => (
                <Chip key={l.name} active={serviceLine === l.name} onClick={() => setServiceLine(serviceLine === l.name ? "" : l.name)}>
                  {l.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-medium">Is there a story here?</h2>
        <p className="text-sm text-muted-foreground mt-1">Pick the one that fits best. This decides what angle the interview takes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {WORTHINESS_TAGS.map((t) => (
            <Chip key={t.id} active={tag === t.id} onClick={() => setTag(t.id as Tag)}>{t.label}</Chip>
          ))}
          <Chip active={tag === "nothing_special"} onClick={() => setTag("nothing_special")}>
            Nothing special — skip
          </Chip>
        </div>
        {tag === "nothing_special" && (
          <p className="text-sm text-muted-foreground mt-3">
            Got it. We'll archive this project and you can move on. Not every job needs content.
          </p>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <PrimaryButton onClick={create} disabled={busy || !title.trim() || !tag}>
          {tag === "nothing_special" ? "Archive and exit" : "Start interview"}
        </PrimaryButton>
        <SecondaryButton onClick={() => nav({ to: "/dashboard" })}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}