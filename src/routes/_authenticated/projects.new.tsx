import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, Chip, PageHeader, PrimaryButton, SecondaryButton } from "@/components/AppShell";
import { WORTHINESS_TAGS } from "@/lib/constants";
import { ensureCompany } from "@/lib/company";

type ServiceLine = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProject,
});

function NewProject() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [serviceLineId, setServiceLineId] = useState<string>("");
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () => (await supabase.from("companies").select("id,service_lines").eq("owner_user_id", user!.id).maybeSingle()).data,
  });
  const lines = (Array.isArray(companyQ.data?.service_lines) ? companyQ.data!.service_lines : []) as unknown as ServiceLine[];

  const create = async () => {
    if (!user || !name.trim() || !tag) return;
    setBusy(true); setErr(null);
    try {
      const company = await ensureCompany(user.id);
      const isNothing = tag === "nothing_special";
      const status = isNothing ? "archived" : "in_progress";
      const worthiness_tag = isNothing ? null : tag;
      const selectedLine = lines.find(l => l.id === serviceLineId);
      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: company.id,
          name: name.trim(),
          status,
          worthiness_tag,
          service_line_id: serviceLineId || null,
          service_type_detail: selectedLine?.name ?? null,
          started_at: isNothing ? null : new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Insert failed");
      if (isNothing) nav({ to: "/dashboard" });
      else nav({ to: "/projects/$projectId/interview", params: { projectId: data.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="New project" subtitle="Just enough to start. You can fill the rest in later." />

      <Card className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">What was the job?</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Heat pump replacement on Maple St."
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {lines.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Service line <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              {lines.map((l) => (
                <Chip key={l.id} active={serviceLineId === l.id} onClick={() => setServiceLineId(serviceLineId === l.id ? "" : l.id)}>
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
            <Chip key={t.id} active={tag === t.id} onClick={() => setTag(t.id)}>{t.label}</Chip>
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

      {err && <p className="text-sm text-destructive mt-4">{err}</p>}

      <div className="mt-8 flex gap-3">
        <PrimaryButton onClick={create} disabled={busy || !name.trim() || !tag}>
          {tag === "nothing_special" ? "Archive and exit" : "Start interview"}
        </PrimaryButton>
        <SecondaryButton onClick={() => nav({ to: "/dashboard" })}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
