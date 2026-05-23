import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, PrimaryButton, Chip } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import { VOICE_SAMPLES } from "@/lib/constants";
import { Plus, Trash2 } from "lucide-react";

type ServiceLine = { id: string; name: string; description: string; keywords: string[] };
type CTA = { label: string; type: string; destination: string };
type VoiceExample = { label: string; paragraph: string };

const CUSTOMER_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "residential", label: "Residential" },
  { id: "light_commercial", label: "Light commercial" },
];

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

  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () => (await supabase.from("companies").select("*").eq("owner_user_id", user!.id).maybeSingle()).data,
  });

  const [name, setName] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [customerTypes, setCustomerTypes] = useState<string[]>(["residential"]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ id: "sl_1", name: "", description: "", keywords: [] }]);
  const [differentiators, setDifferentiators] = useState<string[]>([""]);
  const [ctas, setCtas] = useState<CTA[]>([{ label: "", type: "phone", destination: "" }]);
  const [voiceLabel, setVoiceLabel] = useState<string>(VOICE_SAMPLES[0].label);
  const [voiceParagraph, setVoiceParagraph] = useState<string>(VOICE_SAMPLES[0].text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = companyQ.data;
    if (!c) return;
    setName(c.name || "");
    setServiceArea((c.service_area || []).join(", "));
    if ((c.customer_types || []).length) setCustomerTypes(c.customer_types);
    const sl = Array.isArray(c.service_lines) ? (c.service_lines as unknown as ServiceLine[]) : [];
    if (sl.length) setServiceLines(sl);
    if ((c.differentiators || []).length) setDifferentiators(c.differentiators);
    const cs = Array.isArray(c.standard_ctas) ? (c.standard_ctas as unknown as CTA[]) : [];
    if (cs.length) setCtas(cs);
    const ex = Array.isArray(c.voice_examples) ? (c.voice_examples as unknown as VoiceExample[]) : [];
    if (ex[0]) {
      setVoiceLabel(ex[0].label);
      setVoiceParagraph(ex[0].paragraph);
    }
  }, [companyQ.data]);

  const pickSample = (id: string) => {
    const s = VOICE_SAMPLES.find(v => v.id === id);
    if (!s) return;
    setVoiceLabel(s.label);
    setVoiceParagraph(s.text);
  };

  const toggleCustomerType = (id: string) => {
    setCustomerTypes((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true); setError(null);
    const payload = {
      owner_user_id: user.id,
      name: name.trim(),
      trade: "HVAC",
      service_area: serviceArea.split(",").map(s => s.trim()).filter(Boolean),
      customer_types: customerTypes,
      service_lines: serviceLines
        .filter(s => s.name.trim())
        .map((s, i) => ({ id: s.id || `sl_${i + 1}`, name: s.name.trim(), description: s.description.trim(), keywords: s.keywords })),
      differentiators: differentiators.map(d => d.trim()).filter(Boolean),
      standard_ctas: ctas.filter(c => c.label.trim()),
      voice_examples: voiceParagraph.trim()
        ? [{ label: voiceLabel || "My voice", paragraph: voiceParagraph.trim() }]
        : [],
    };
    const existing = companyQ.data;
    const { error: err } = existing
      ? await supabase.from("companies").update(payload).eq("id", existing.id)
      : await supabase.from("companies").insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ["company"] });
    onSaved();
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium mb-4">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northside HVAC"
              className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <Field label="Service area (comma separated)">
            <input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Boston, Cambridge, Somerville"
              className="w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          </Field>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Customer types</label>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_TYPE_OPTIONS.map(o => (
              <Chip key={o.id} active={customerTypes.includes(o.id)} onClick={() => toggleCustomerType(o.id)}>{o.label}</Chip>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <Header h="Service lines" sub="What kinds of jobs do you take? These become chips when starting a project." />
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
          <button onClick={() => setServiceLines([...serviceLines, { id: `sl_${serviceLines.length + 1}`, name: "", description: "", keywords: [] }])}
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
        <Header h="Standard calls to action" sub="What do you want readers to do? The first one gets used at the bottom of generated posts." />
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
        <Header h="Voice example" sub="Pick the example that sounds most like how you'd actually talk about a job, then edit it until it sounds like you. Generated content will mirror this paragraph's rhythm, vocabulary, and length." />
        <div className="flex flex-wrap gap-2 mb-4">
          {VOICE_SAMPLES.map((s) => (
            <Chip key={s.id} active={voiceLabel === s.label} onClick={() => pickSample(s.id)}>{s.label}</Chip>
          ))}
        </div>
        <VoiceField multiline rows={7} value={voiceParagraph}
          onChange={(v) => { setVoiceParagraph(v); }}
          hint="Edit freely. This paragraph IS your voice sample — we pass it to the generator verbatim." />
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving || !name.trim() || !voiceParagraph.trim()}>
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
