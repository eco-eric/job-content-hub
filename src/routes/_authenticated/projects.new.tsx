import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const CUSTOMER_TYPES = [
  { id: "single-family", label: "Single-family" },
  { id: "multi-family", label: "Multi-family" },
  { id: "small business", label: "Small business" },
];

function NewProject() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [serviceLineId, setServiceLineId] = useState<string>("");
  const [serviceName, setServiceName] = useState<string>("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const [tag, setTag] = useState<string | null>(null);
  const [confirmNothing, setConfirmNothing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () => (await supabase.from("companies").select("id,service_lines").eq("owner_user_id", user!.id).maybeSingle()).data,
  });
  const lines = (Array.isArray(companyQ.data?.service_lines) ? companyQ.data!.service_lines : []) as unknown as ServiceLine[];

  // Auto-suggest project name from service + location.
  useEffect(() => {
    if (nameTouched) return;
    const place = neighborhood || city;
    const parts = [serviceName, place && `on ${place}`].filter(Boolean);
    setName(parts.join(" ").trim());
  }, [serviceName, city, neighborhood, nameTouched]);

  const pickServiceLine = (id: string) => {
    const line = lines.find((l) => l.id === id);
    setServiceLineId(id);
    setServiceName(line?.name ?? "");
  };

  const canCreate = name.trim() && tag && (tag !== "nothing_special" || confirmNothing);

  const create = async () => {
    if (!user || !canCreate) return;
    setBusy(true);
    setErr(null);
    try {
      const company = await ensureCompany(user.id);
      const isNothing = tag === "nothing_special";
      const status = isNothing ? "archived" : "interviewing";
      const worthiness_tag = isNothing ? null : tag;
      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: company.id,
          name: name.trim() || "Untitled project",
          status,
          worthiness_tag,
          service_line_id: serviceLineId || null,
          service_type_detail: serviceName || null,
          location_city: city || null,
          location_neighborhood: neighborhood || null,
          customer_type: customerType || null,
          started_at: isNothing ? null : new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Insert failed");
      if (isNothing) nav({ to: "/dashboard" });
      else nav({ to: "/projects/$projectId/interview", params: { projectId: data.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      <PageHeader title="New project" subtitle="Just enough to start. You can fill the rest in the interview." />

      <Card className="space-y-5">
        {lines.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">What service?</label>
            <div className="flex flex-wrap gap-2">
              {lines.map((l) => (
                <Chip key={l.id} active={serviceLineId === l.id} onClick={() => pickServiceLine(l.id)}>
                  {l.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Boston" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Neighborhood <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="e.g. Jamaica Plain" className={inp} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Who was the customer?</label>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_TYPES.map((c) => (
              <Chip key={c.id} active={customerType === c.id} onClick={() => setCustomerType(c.id)}>{c.label}</Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Project name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameTouched(true); }}
            placeholder="e.g. AC repair on Maple St."
            className={inp}
          />
          {!nameTouched && <p className="text-xs text-muted-foreground mt-1">Auto-suggested — edit if you want.</p>}
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="text-lg font-medium">What made this job worth talking about?</h2>
        <p className="text-sm text-muted-foreground mt-1">Pick one. It decides what the interview asks next.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {WORTHINESS_TAGS.map((t) => (
            <Chip key={t.id} active={tag === t.id} onClick={() => { setTag(t.id); setConfirmNothing(false); }}>
              {t.label}
            </Chip>
          ))}
          <Chip active={tag === "nothing_special"} onClick={() => { setTag("nothing_special"); setConfirmNothing(false); }}>
            Nothing special
          </Chip>
        </div>
        {tag === "nothing_special" && (
          <Card className="mt-4 border-muted">
            <p className="text-sm">
              You're saying this one isn't worth content. We'll archive it and you can move on — no draft will be generated.
            </p>
            <div className="mt-3 flex gap-2">
              <Chip active={confirmNothing} onClick={() => setConfirmNothing(true)}>Yes, archive it</Chip>
              <Chip onClick={() => setTag(null)}>Never mind</Chip>
            </div>
          </Card>
        )}
      </div>

      {err && <p className="text-sm text-destructive mt-4">{err}</p>}

      {/* Sticky bottom action bar on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:static md:bg-transparent md:border-0 md:mt-8">
        <div className="mx-auto max-w-5xl px-4 py-3 flex gap-3 md:px-0">
          <SecondaryButton onClick={() => nav({ to: "/dashboard" })}>Cancel</SecondaryButton>
          <PrimaryButton onClick={create} disabled={busy || !canCreate} className="flex-1 md:flex-none">
            {tag === "nothing_special" ? "Archive and exit" : busy ? "Starting…" : "Start interview"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring";
