import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, PrimaryButton, Chip } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { VOICE_SAMPLES } from "@/lib/constants";
import { Plus, Trash2 } from "lucide-react";

type ServiceLine = { name: string; description: string; keywords: string[] };
type CTA = { label: string; type: string; destination: string };

export function OnboardingForm({
  onSaved,
  ctaLabel = "Save",
  secondary,
}: {
  onSaved: () => void;
  ctaLabel?: string;
  secondary?: React.ReactNode;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const profileQ = useQuery({
    enabled: !!user,
    queryKey: ["company_profile", user?.id],
    queryFn: async () => (await supabase.from("company_profile").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  const [companyName, setCompanyName] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([
    { name: "", description: "", keywords: [] },
  ]);
  const [differentiators, setDifferentiators] = useState<string[]>([""]);
  const [ctas, setCtas] = useState<CTA[]>([{ label: "", type: "phone", destination: "" }]);
  const [voiceSampleId, setVoiceSampleId] = useState<string>(VOICE_SAMPLES[0].id);
  const [voiceSample, setVoiceSample] = useState<string>(VOICE_SAMPLES[0].text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQ.data) return;
    const p = profileQ.data;
    setCompanyName(p.company_name || "");
    setServiceArea(p.service_area || "");
    const sl = Array.isArray(p.service_lines) ? (p.service_lines as unknown as ServiceLine[]) : [];
    if (sl.length) setServiceLines(sl);
    if (p.differentiators?.length) setDifferentiators(p.differentiators);
    const cs = Array.isArray(p.standard_ctas) ? (p.standard_ctas as unknown as CTA[]) : [];
    if (cs.length) setCtas(cs);
    if (p.voice_sample) {
      setVoiceSample(p.voice_sample);
      const match = VOICE_SAMPLES.find(v => v.text === p.voice_sample);
      setVoiceSampleId(match?.id ?? "custom");
    }
  }, [profileQ.data]);

  const pickSample = (id: string) => {
    const s = VOICE_SAMPLES.find(v => v.id === id);
    if (!s) return;
    setVoiceSampleId(id);
    setVoiceSample(s.text);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const payload = {
      user_id: user.id,
      company_name: companyName.trim(),
      trade: "HVAC",
      service_area: serviceArea.trim(),
      service_lines: serviceLines.filter(s => s.name.trim()),
      differentiators: differentiators.map(d => d.trim()).filter(Boolean),
      standard_ctas: ctas.filter(c => c.label.trim()),
      voice_sample: voiceSample.trim(),
    };
    const { error } = await supabase.from("company_profile").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["company_profile"] });
    onSaved();
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium mb-4">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company name">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Northside HVAC"
              className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <Field label="Service area">
            <input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Greater Boston"
              className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
        </div>
      </Card>

      <Card>
        <Header h="Service lines" sub="What kinds of jobs do you take? These become chips in the interview." />
        <div className="space-y-3">
          {serviceLines.map((sl, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-background">
              <div className="flex gap-2">
                <input value={sl.name} onChange={(e) => updateAt(serviceLines, setServiceLines, i, { ...sl, name: e.target.value })}
                  placeholder="Name (e.g. Furnace repair)" className="flex-1 rounded-md border border-input bg-card px-3 py-3 text-base" />
                <button aria-label="Remove" onClick={() => setServiceLines(serviceLines.filter((_, j) => j !== i))} className="w-11 h-11 inline-flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea value={sl.description} onChange={(e) => updateAt(serviceLines, setServiceLines, i, { ...sl, description: e.target.value })}
                placeholder="Short description (one sentence)" rows={2} className="w-full rounded-md border border-input bg-card px-3 py-3 text-base" />
              <input value={sl.keywords.join(", ")} onChange={(e) => updateAt(serviceLines, setServiceLines, i, { ...sl, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
                placeholder="SEO keywords, comma separated" className="w-full rounded-md border border-input bg-card px-3 py-3 text-base" />
            </div>
          ))}
          <button onClick={() => setServiceLines([...serviceLines, { name: "", description: "", keywords: [] }])}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" /> Add service line
          </button>
        </div>
      </Card>

      <Card>
        <Header h="Differentiators" sub="What makes you different from the next guy? One per line." />
        <div className="space-y-2">
          {differentiators.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input value={d} onChange={(e) => updateAt(differentiators, setDifferentiators, i, e.target.value)}
                placeholder="e.g. NATE-certified, 24/7 emergency, family-owned"
                className="flex-1 rounded-md border border-input bg-card px-3 py-3 text-base" />
              <button aria-label="Remove" onClick={() => setDifferentiators(differentiators.filter((_, j) => j !== i))} className="w-11 h-11 inline-flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setDifferentiators([...differentiators, ""])} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" /> Add differentiator
          </button>
        </div>
      </Card>

      <Card>
        <Header h="Standard calls to action" sub="What do you want readers to do? We'll put the right one at the bottom of generated posts." />
        <div className="space-y-3">
          {ctas.map((c, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_140px_1fr_44px] items-start">
              <input value={c.label} onChange={(e) => updateAt(ctas, setCtas, i, { ...c, label: e.target.value })}
                placeholder="Label (e.g. Book a service call)" className="rounded-md border border-input bg-card px-3 py-3 text-base" />
              <select value={c.type} onChange={(e) => updateAt(ctas, setCtas, i, { ...c, type: e.target.value })}
                className="rounded-md border border-input bg-card px-3 py-3 text-base">
                <option value="phone">Phone</option>
                <option value="url">Website</option>
                <option value="email">Email</option>
              </select>
              <input value={c.destination} onChange={(e) => updateAt(ctas, setCtas, i, { ...c, destination: e.target.value })}
                placeholder="Destination (number / URL / email)" className="rounded-md border border-input bg-card px-3 py-3 text-base" />
              <button aria-label="Remove" onClick={() => setCtas(ctas.filter((_, j) => j !== i))} className="w-11 h-11 inline-flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setCtas([...ctas, { label: "", type: "phone", destination: "" }])} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" /> Add CTA
          </button>
        </div>
      </Card>

      <Card>
        <Header h="Voice sample" sub="Pick the example that sounds most like how you'd actually talk about a job, then edit it until it sounds like you. Generated content will mirror this voice." />
        <div className="flex flex-wrap gap-2 mb-4">
          {VOICE_SAMPLES.map((s) => (
            <Chip key={s.id} active={voiceSampleId === s.id} onClick={() => pickSample(s.id)}>{s.label}</Chip>
          ))}
          <Chip active={voiceSampleId === "custom"} onClick={() => setVoiceSampleId("custom")}>Custom</Chip>
        </div>
        <VoiceField multiline rows={7} value={voiceSample} onChange={(v) => { setVoiceSample(v); setVoiceSampleId("custom"); }}
          hint="Edit freely. This paragraph IS your voice — the generator will match its rhythm, vocabulary, and length." />
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving || !companyName.trim() || !voiceSample.trim()}>
          {saving ? "Saving…" : ctaLabel}
        </PrimaryButton>
        {secondary}
      </div>
    </div>
  );
}

function updateAt<T>(arr: T[], set: (a: T[]) => void, i: number, v: T) {
  const next = arr.slice();
  next[i] = v;
  set(next);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}

function Header({ h, sub }: { h: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-medium">{h}</h2>
      <p className="text-sm text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}