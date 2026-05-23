// Generation seam — DETERMINISTIC STUB.
//
// CRITICAL CONTRACT — NEVER INVENT FACTS.
// For every required Layer-1 project column that is empty (null / "" / []),
// the body contains a [confirm: <column>] token AND `flagged_unknowns`
// includes the same key. Swap the body of buildDraft() for an LLM later —
// keep the no-invented-facts contract intact.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Confirm = { key: string; prompt: string };

const REQUIRED_FACTS: Record<string, string> = {
  service_type_detail: "Which type of job was this?",
  customer_type: "Residential or commercial?",
  before_state: "What was the customer's complaint?",
  scope_performed: "What did you do to fix it?",
};

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim().length === 0;
  return false;
}

function fact(project: Record<string, unknown>, key: string, confirms: Confirm[]): string {
  const v = project[key];
  if (!isEmpty(v)) return Array.isArray(v) ? (v as unknown[]).join(", ") : String(v);
  const prompt = REQUIRED_FACTS[key] ?? `Provide ${key.replace(/_/g, " ")}`;
  if (!confirms.find(c => c.key === key)) confirms.push({ key, prompt });
  return `[confirm: ${key}]`;
}

function opt(project: Record<string, unknown>, key: string): string {
  const v = project[key];
  if (isEmpty(v)) return "";
  return Array.isArray(v) ? (v as unknown[]).join(", ") : String(v).trim();
}

function buildDraft(args: {
  intent: string;
  channel: string;
  project: Record<string, unknown>;
  company: Record<string, unknown>;
}) {
  const confirms: Confirm[] = [];

  const rawCompanyName = typeof args.company.name === "string" ? (args.company.name as string).trim() : "";
  let company = rawCompanyName;
  if (!company) { confirms.push({ key: "company_name", prompt: "Company name" }); company = "[confirm: company_name]"; }

  const ctas = Array.isArray(args.company.standard_ctas) ? args.company.standard_ctas as Array<{ label?: string }> : [];
  const rawCta = ctas[0]?.label?.trim() || "";
  let cta = rawCta;
  if (!cta) { confirms.push({ key: "cta", prompt: "Standard call to action" }); cta = "[confirm: cta]"; }

  const area = Array.isArray(args.company.service_area) ? (args.company.service_area as string[]).join(", ") : "";

  const service = fact(args.project, "service_type_detail", confirms);
  const symptom = fact(args.project, "before_state", confirms);
  const fix = fact(args.project, "scope_performed", confirms);
  const ctype = fact(args.project, "customer_type", confirms);
  const neighborhood = opt(args.project, "location_neighborhood");
  const equipment = opt(args.project, "equipment_used");
  const outcome = opt(args.project, "outcome");
  const unusual = opt(args.project, "unusual_details");
  const lesson = opt(args.project, "lesson_learned");

  const local = neighborhood ? ` in ${neighborhood}` : area ? ` in ${area}` : "";
  const angles: Record<string, string> = {
    educational: `What this ${service} job can teach you`,
    seo: `${service}${local}: a real case`,
    social_proof: `How ${company} handled a tricky ${service}`,
    process: `Inside a ${service}: step by step`,
  };
  const headline = angles[args.intent] || `${service}${local}`;

  const equipLine = equipment ? `Equipment involved: ${equipment}.` : "";
  const outcomeLine = outcome ? `Outcome: ${outcome}` : "";
  const unusualLine = unusual ? `What made this one stand out: ${unusual}` : "";
  const lessonLine = lesson ? `Lesson for other techs: ${lesson}` : "";

  const blog = `# ${headline}

We got called out for a ${service}${local}. The customer's complaint: ${symptom}.

## What we did
${fix}
${equipLine}

${unusualLine}

${outcomeLine}

${lessonLine}

If you're dealing with something similar, ${cta}. — ${company}`;

  const fb = `${headline}

Called out for a ${service}${local}. Complaint: ${symptom}. Here's what we did: ${fix}. ${outcomeLine}

${cta} — ${company}`;

  const ig = `${headline}

${symptom} → ${fix}.
${outcome ? outcome + " " : ""}${cta}

#HVAC #${service.replace(/\s+/g, "")}${neighborhood ? ` #${neighborhood.replace(/\s+/g, "")}` : ""}`;

  const caseStudy = `# ${headline}

**Customer:** ${ctype}${local}

**Problem.** ${symptom}

**Approach.** ${fix}${equipment ? ` ${equipLine}` : ""}

**Result.** ${outcome || "[confirm: outcome]"}

${unusualLine}

${cta} — ${company}`;

  const bodies: Record<string, string> = { seo_blog: blog, facebook: fb, instagram: ig, case_study: caseStudy };
  const body = (bodies[args.channel] || blog).trim();

  if (!outcome && args.channel === "case_study" && !confirms.find(c => c.key === "outcome")) {
    confirms.push({ key: "outcome", prompt: "How did the job end?" });
  }

  const seen = new Set<string>();
  const flagged_unknowns = confirms.filter(c => seen.has(c.key) ? false : (seen.add(c.key), true));
  return { headline, body, flagged_unknowns };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { projectId, intent, channel } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });

    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });

    const { data: company } = await supabase.from("companies").select("*").eq("id", (project as { company_id: string }).company_id).maybeSingle();

    const result = buildDraft({
      intent,
      channel,
      project: project as Record<string, unknown>,
      company: (company ?? {}) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(result), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
