import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, PrimaryButton, SecondaryButton, Chip } from "@/components/AppShell";
import { VoiceField } from "@/components/VoiceField";
import {
  VOICE_SAMPLES,
  HVAC_SERVICE_LINE_SUGGESTIONS,
  STANDARD_CTAS,
  CHANNELS,
  ALL_CHANNELS,
  type ChannelId,
} from "@/lib/constants";
import { Plus, Trash2, X } from "lucide-react";

type ServiceLine = { id: string; name: string; description: string; keywords: string[] };
type CTA = { id: string; label: string; type: string; destination: string };
type VoiceExample = { label: string; paragraph: string };

const CUSTOMER_TYPE_OPTIONS = [
  { id: "residential", label: "Residential" },
  { id: "light_commercial", label: "Light commercial" },
];

function slug() {
  return Math.random().toString(36).slice(2, 9);
}

export function OnboardingForm({
  onSaved,
  ctaLabel = "Save",
  mode = "wizard",
  secondary,
}: {
  onSaved: () => void;
  ctaLabel?: string;
  /** wizard = stepper (onboarding). single = one scrolling page (settings). */
  mode?: "wizard" | "single";
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
  const [areas, setAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState("");
  const [customerTypes, setCustomerTypes] = useState<string[]>(["residential"]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [differentiators, setDifferentiators] = useState<string[]>([""]);
  const [diffInput, setDiffInput] = useState("");
  const [ctas, setCtas] = useState<CTA[]>([]);
  const [voicePrimaryLabel, setVoicePrimaryLabel] = useState<string>(VOICE_SAMPLES[0].label);
  const [voicePrimaryText, setVoicePrimaryText] = useState<string>(VOICE_SAMPLES[0].paragraph);
  const [voiceOwnText, setVoiceOwnText] = useState<string>("");
  const [channels, setChannels] = useState<ChannelId[]>([...ALL_CHANNELS]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Hydrate from existing row.
  useEffect(() => {
    const c = companyQ.data;
    if (!c) {
      // First-run defaults: pre-fill HVAC suggestions.
      if (serviceLines.length === 0) {
        setServiceLines(
          HVAC_SERVICE_LINE_SUGGESTIONS.map((s) => ({ id: slug(), name: s.name, description: s.description, keywords: [] })),
        );
      }
      return;
    }
    setName(c.name || "");
    setAreas(c.service_area || []);
    if ((c.customer_types || []).length) setCustomerTypes(c.customer_types);
    const sl = Array.isArray(c.service_lines) ? (c.service_lines as unknown as ServiceLine[]) : [];
    setServiceLines(sl.length ? sl : HVAC_SERVICE_LINE_SUGGESTIONS.map((s) => ({ id: slug(), name: s.name, description: s.description, keywords: [] })));
    setDifferentiators((c.differentiators || []).length ? c.differentiators : [""]);
    setCtas(Array.isArray(c.standard_ctas) ? (c.standard_ctas as unknown as CTA[]) : []);
    const ex = Array.isArray(c.voice_examples) ? (c.voice_examples as unknown as VoiceExample[]) : [];
    if (ex[0]) {
      setVoicePrimaryLabel(ex[0].label);
      setVoicePrimaryText(ex[0].paragraph);
    }
    setVoiceOwnText(ex[1]?.paragraph ?? "");
    setChannels((c.channels_enabled?.length ? c.channels_enabled : ALL_CHANNELS) as ChannelId[]);
  }, [companyQ.data]);

  const addArea = () => {
    const v = areaInput.trim();
    if (!v) return;
    if (!areas.includes(v)) setAreas([...areas, v]);
    setAreaInput("");
  };
  const removeArea = (a: string) => setAreas(areas.filter((x) => x !== a));

  const toggleCustomerType = (id: string) =>
    setCustomerTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addServiceLine = () => setServiceLines([...serviceLines, { id: slug(), name: "", description: "", keywords: [] }]);

  const toggleCta = (id: string) => {
    const def = STANDARD_CTAS.find((c) => c.id === id)!;
    if (ctas.find((c) => c.id === id)) setCtas(ctas.filter((c) => c.id !== id));
    else setCtas([...ctas, { id: def.id, label: def.label, type: def.type, destination: "" }]);
  };

  const addDifferentiator = () => {
    const v = diffInput.trim();
    if (!v) return;
    setDifferentiators([...differentiators.filter((d) => d.trim()), v]);
    setDiffInput("");
  };

  const toggleChannel = (id: ChannelId) =>
    setChannels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pickVoice = (id: string) => {
    const s = VOICE_SAMPLES.find((v) => v.id === id);
    if (!s) return;
    setVoicePrimaryLabel(s.label);
    setVoicePrimaryText(s.paragraph);
  };

  const canSave = name.trim().length > 0 && voicePrimaryText.trim().length > 0;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const voiceExamples: VoiceExample[] = [];
    if (voicePrimaryText.trim())
      voiceExamples.push({ label: voicePrimaryLabel || "My voice", paragraph: voicePrimaryText.trim() });
    if (voiceOwnText.trim()) voiceExamples.push({ label: "Real example", paragraph: voiceOwnText.trim() });

    const payload = {
      owner_user_id: user.id,
      name: name.trim(),
      trade: "HVAC",
      service_area: areas,
      customer_types: customerTypes,
      service_lines: serviceLines
        .filter((s) => s.name.trim())
        .map((s) => ({ id: s.id || slug(), name: s.name.trim(), description: s.description.trim(), keywords: s.keywords })),
      differentiators: differentiators.map((d) => d.trim()).filter(Boolean),
      standard_ctas: ctas,
      voice_examples: voiceExamples,
      channels_enabled: channels,
    };
    const existing = companyQ.data;
    const { error: err } = existing
      ? await supabase.from("companies").update(payload).eq("id", existing.id)
      : await supabase.from("companies").insert(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["company"] });
    onSaved();
  };

  // ---------- Sections (reused in wizard + single page) ----------
  const BasicsSection = (
    <Card>
      <SectionHeader h="Business basics" sub="Just enough so generated content sounds like you." />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northside HVAC" className={inp} />
        </Field>
        <Field label="Trade">
          <input value="HVAC" disabled className={inp + " opacity-60"} />
        </Field>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Service area (cities and regions)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {areas.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm">
              {a}
              <button onClick={() => removeArea(a)} aria-label={`Remove ${a}`} className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addArea();
              }
            }}
            placeholder="Add a city or region"
            className={inp + " flex-1"}
          />
          <SecondaryButton onClick={addArea}>Add</SecondaryButton>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Customer types</label>
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_TYPE_OPTIONS.map((o) => (
            <Chip key={o.id} active={customerTypes.includes(o.id)} onClick={() => toggleCustomerType(o.id)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );

  const ServiceLinesSection = (
    <Card>
      <SectionHeader h="Service lines" sub="6–12 services. We pre-filled the usual HVAC ones — edit or remove anything that doesn't fit." />
      <div className="space-y-3">
        {serviceLines.map((sl, i) => (
          <div key={sl.id} className="rounded-md border border-border p-3 space-y-2 bg-background">
            <div className="flex gap-2">
              <input
                value={sl.name}
                onChange={(e) => updateAt(serviceLines, setServiceLines, i, { ...sl, name: e.target.value })}
                placeholder="Service name"
                className={inp + " flex-1"}
              />
              <button
                aria-label="Remove"
                onClick={() => setServiceLines(serviceLines.filter((_, j) => j !== i))}
                className="w-11 h-11 inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              value={sl.description}
              onChange={(e) => updateAt(serviceLines, setServiceLines, i, { ...sl, description: e.target.value })}
              placeholder="One-line description (optional)"
              className={inp}
            />
          </div>
        ))}
        <button onClick={addServiceLine} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Add service line
        </button>
      </div>
    </Card>
  );

  const VoiceSection = (
    <Card>
      <SectionHeader
        h="Voice calibration"
        sub="Pick the sample that sounds closest to how you'd actually describe a job. Then edit until it sounds like you. We pass this paragraph to the generator verbatim — it's the voice."
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {VOICE_SAMPLES.map((s) => (
          <Chip key={s.id} active={voicePrimaryLabel === s.label} onClick={() => pickVoice(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <VoiceField
        multiline
        rows={7}
        value={voicePrimaryText}
        onChange={setVoicePrimaryText}
        hint="Edit freely. This paragraph IS your voice sample."
      />
      <div className="mt-5">
        <label className="block text-sm font-medium mb-2">Have something you've actually written? Paste it (optional)</label>
        <VoiceField multiline rows={5} value={voiceOwnText} onChange={setVoiceOwnText} placeholder="Paste a Facebook post, review reply, or email you wrote." />
      </div>
    </Card>
  );

  const DifferentiatorsSection = (
    <Card>
      <SectionHeader h="Differentiators" sub="3–5 things you tell customers about why to hire you." />
      <div className="space-y-2">
        {differentiators.filter((d) => d.trim()).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={d} onChange={(e) => updateAt(differentiators, setDifferentiators, differentiators.indexOf(d), e.target.value)} className={inp + " flex-1"} />
            <button
              aria-label="Remove"
              onClick={() => setDifferentiators(differentiators.filter((_, j) => j !== differentiators.indexOf(d)))}
              className="w-11 h-11 inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={diffInput}
            onChange={(e) => setDiffInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDifferentiator();
              }
            }}
            placeholder="e.g. NATE-certified, 24/7 emergency, family-owned"
            className={inp + " flex-1"}
          />
          <SecondaryButton onClick={addDifferentiator}>Add</SecondaryButton>
        </div>
      </div>
    </Card>
  );

  const CTAsSection = (
    <Card>
      <SectionHeader h="Standard calls to action" sub="Toggle on the ones you actually use. Fill in the destination so generated content can link to it." />
      <div className="space-y-3">
        {STANDARD_CTAS.map((def) => {
          const active = !!ctas.find((c) => c.id === def.id);
          const current = ctas.find((c) => c.id === def.id);
          return (
            <div key={def.id} className="rounded-md border border-border p-3 bg-background">
              <div className="flex items-center justify-between mb-2">
                <Chip active={active} onClick={() => toggleCta(def.id)}>
                  {def.label}
                </Chip>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{def.type}</span>
              </div>
              {active && (
                <input
                  value={current?.destination ?? ""}
                  onChange={(e) => setCtas(ctas.map((c) => (c.id === def.id ? { ...c, destination: e.target.value } : c)))}
                  placeholder={def.destinationPlaceholder}
                  className={inp}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const ChannelsSection = (
    <Card>
      <SectionHeader h="Where you'll publish" sub="Toggle off channels you don't use. Generated content only fans out to enabled channels." />
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((ch) => (
          <Chip key={ch.id} active={channels.includes(ch.id)} onClick={() => toggleChannel(ch.id)}>
            {ch.label}
          </Chip>
        ))}
      </div>
    </Card>
  );

  const steps = useMemo(
    () => [
      { label: "Basics", node: BasicsSection },
      { label: "Service lines", node: ServiceLinesSection },
      { label: "Voice", node: VoiceSection },
      { label: "Differentiators & CTAs", node: <div className="space-y-6">{DifferentiatorsSection}{CTAsSection}</div> },
      { label: "Channels", node: ChannelsSection },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, areas, areaInput, customerTypes, serviceLines, differentiators, diffInput, ctas, voicePrimaryLabel, voicePrimaryText, voiceOwnText, channels],
  );

  if (mode === "single") {
    return (
      <div className="space-y-6">
        {BasicsSection}
        {ServiceLinesSection}
        {VoiceSection}
        {DifferentiatorsSection}
        {CTAsSection}
        {ChannelsSection}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={save} disabled={saving || !canSave}>
            {saving ? "Saving…" : ctaLabel}
          </PrimaryButton>
          {secondary}
        </div>
      </div>
    );
  }

  // Wizard mode
  const isLast = step === steps.length - 1;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i)}
              className={
                "h-8 min-w-8 px-2 rounded-full text-xs font-medium transition-colors " +
                (i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground")
              }
              aria-current={i === step}
            >
              {i + 1}
            </button>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
        <span className="ml-3 text-sm text-muted-foreground">{steps[step].label}</span>
      </div>

      {steps[step].node}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <SecondaryButton disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </SecondaryButton>
        {isLast ? (
          <PrimaryButton onClick={save} disabled={saving || !canSave}>
            {saving ? "Saving…" : ctaLabel}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}>
            Next
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-md border border-input bg-card px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring";

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

function SectionHeader({ h, sub }: { h: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-medium">{h}</h2>
      <p className="text-sm text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
