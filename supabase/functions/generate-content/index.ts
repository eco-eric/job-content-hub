// Generation seam.
//
// CRITICAL CONTRACT — NEVER INVENT FACTS.
// If a fact (brand, model, refrigerant, price, warranty, name, etc.) is not
// present in answers or company_profile, the output MUST surface a
// `[confirm: <key>]` token AND include the key in `unresolved_confirms`.
// Today this returns a deterministic mock. Swap the body of buildDraft()
// for an LLM call later — keep the no-invented-facts contract intact.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Intent = "educational" | "seo" | "social_proof" | "process";
type Channel = "seo_blog" | "facebook" | "instagram" | "case_study";
type Confirm = { key: string; prompt: string };

const REQUIRED_FACTS: Record<string, string> = {
  service_line: "Which type of job was this?",
  customer_type: "Residential or commercial?",
  symptom: "What was the customer's complaint?",
  root_cause: "What did you actually find?",
  fix: "What did you do to fix it?",
};

function fact(answers: Record<string, string>, key: string, confirms: Confirm[]): string {
  const v = answers[key];
  if (v && v.trim()) return v.trim();
  const prompt = REQUIRED_FACTS[key] ?? `Provide ${key.replace(/_/g, " ")}`;
  if (!confirms.find(c => c.key === key)) confirms.push({ key, prompt });
  return `[confirm: ${key}]`;
}

function buildDraft(args: {
  intent: Intent;
  channel: Channel;
  answers: Record<string, string>;
  profile: { company_name?: string; service_area?: string; voice_sample?: string; standard_ctas?: Array<{ label: string }> };
}): { title: string; body_md: string; unresolved_confirms: Confirm[] } {
  const confirms: Confirm[] = [];
  const company = args.profile.company_name?.trim() || "[confirm: company_name]";
  if (!args.profile.company_name) confirms.push({ key: "company_name", prompt: "Company name" });
  const area = args.profile.service_area?.trim() || "";
  const cta = args.profile.standard_ctas?.[0]?.label?.trim() || "[confirm: cta]";
  if (!args.profile.standard_ctas?.[0]?.label) confirms.push({ key: "cta", prompt: "Standard call to action" });

  const service = fact(args.answers, "service_line", confirms);
  const symptom = fact(args.answers, "symptom", confirms);
  const root = fact(args.answers, "root_cause", confirms);
  const fix = fact(args.answers, "fix", confirms);
  const equipment = args.answers.equipment?.trim();
  const neighborhood = args.answers.neighborhood?.trim();
  const outcome = args.answers.outcome?.trim();
  const unusual = args.answers.branch_what_made_it_unusual?.trim();
  const lesson = args.answers.branch_lesson?.trim();

  const angle: Record<Intent, string> = {
    educational: `What this ${service} job can teach you`,
    seo:         `${service}${neighborhood ? ` in ${neighborhood}` : area ? ` in ${area}` : ""}: a real case`,
    social_proof:`How ${company} handled a tricky ${service}`,
    process:     `Inside a ${service}: step by step`,
  };
  const title = angle[args.intent];

  const local = neighborhood ? ` in ${neighborhood}` : area ? ` in ${area}` : "";
  const equipLine = equipment ? `Equipment involved: ${equipment}.` : "";
  const outcomeLine = outcome ? `Outcome: ${outcome}` : "";
  const unusualLine = unusual ? `What made this one stand out: ${unusual}` : "";
  const lessonLine = lesson ? `Lesson for other techs: ${lesson}` : "";

  const blog = `# ${title}

We got called out for a ${service}${local}. The customer's complaint: ${symptom}.

## What we found
${root}
${equipLine}

## How we fixed it
${fix}

${unusualLine}

${outcomeLine}

${lessonLine}

If you're dealing with something similar, ${cta}. — ${company}`;

  const fb = `${title}

Called out for a ${service}${local}. Complaint: ${symptom}. Turned out to be ${root}. Here's what we did: ${fix}. ${outcomeLine}

${cta} — ${company}`;

  const ig = `${title}

${symptom} → ${root} → ${fix}.
${outcome ? outcome + " " : ""}${cta}

#HVAC #${service.replace(/\s+/g, "")}${neighborhood ? ` #${neighborhood.replace(/\s+/g, "")}` : ""}`;

  const caseStudy = `# ${title}

**Customer:** ${args.answers.customer_type ? fact(args.answers, "customer_type", confirms) : "[confirm: customer_type]"}${local}

**Problem.** ${symptom}

**Diagnosis.** ${root}${equipment ? ` ${equipLine}` : ""}

**Approach.** ${fix}

**Result.** ${outcome || "[confirm: outcome]"}

${unusualLine}

${cta} — ${company}`;

  const body = ({ seo_blog: blog, facebook: fb, instagram: ig, case_study: caseStudy } as Record<Channel, string>)[args.channel];

  // Dedupe confirms
  const seen = new Set<string>();
  const unresolved_confirms = confirms.filter(c => (seen.has(c.key) ? false : (seen.add(c.key), true)));

  return { title, body_md: body.trim(), unresolved_confirms };
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

    const [{ data: project }, { data: answersRows }, { data: profile }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("project_answers").select("*").eq("project_id", projectId),
      supabase.from("company_profile").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });

    const answers: Record<string, string> = {};
    for (const a of answersRows ?? []) {
      const v = (a as { value: unknown }).value;
      answers[(a as { question_key: string }).question_key] = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
    }

    const result = buildDraft({ intent, channel, answers, profile: profile ?? {} });
    return new Response(JSON.stringify(result), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});