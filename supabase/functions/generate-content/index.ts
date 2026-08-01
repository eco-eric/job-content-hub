// Generation seam — real LLM (Anthropic) with deterministic stub fallback.
//
// CRITICAL CONTRACT — NEVER INVENT FACTS.
// Empty Layer-1 project fields MUST surface as [confirm: <key>] tokens in
// the body AND entries in `flagged_unknowns`. The model is instructed to
// emit them; a post-generation scan catches any it missed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROMPT_VERSION = "v2-anthropic-audience";
const MODEL = "claude-sonnet-4-20250514";

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
  if (!isEmpty(v)) return Array.isArray(v) ? (v as unknown[]).join(", ") : String(v).trim();
  const prompt = REQUIRED_FACTS[key] ?? `Provide ${key.replace(/_/g, " ")}`;
  if (!confirms.find((c) => c.key === key)) confirms.push({ key, prompt });
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
  length?: "short" | "medium" | "long";
  tone?: "more_technical" | "more_homeowner" | null;
  project: Record<string, unknown>;
  company: Record<string, unknown>;
}) {
  const confirms: Confirm[] = [];

  const rawCompanyName = typeof args.company.name === "string" ? (args.company.name as string).trim() : "";
  let company = rawCompanyName;
  if (!company) {
    confirms.push({ key: "company_name", prompt: "Company name" });
    company = "[confirm: company_name]";
  }

  const ctas = Array.isArray(args.company.standard_ctas)
    ? (args.company.standard_ctas as Array<{ label?: string; destination?: string }>)
    : [];
  const rawCta = ctas[0]?.label?.trim() || "";
  let cta = rawCta;
  if (!cta) {
    confirms.push({ key: "cta", prompt: "Standard call to action" });
    cta = "[confirm: cta]";
  }

  const area = Array.isArray(args.company.service_area) ? (args.company.service_area as string[]).join(", ") : "";

  const service = fact(args.project, "service_type_detail", confirms);
  const symptom = fact(args.project, "before_state", confirms);
  const fix = fact(args.project, "scope_performed", confirms);
  const ctype = fact(args.project, "customer_type", confirms);
  const neighborhood = opt(args.project, "location_neighborhood");
  const city = opt(args.project, "location_city");
  const equipment = opt(args.project, "equipment_used");
  const outcome = opt(args.project, "outcome");
  const unusual = opt(args.project, "unusual_details");
  const lesson = opt(args.project, "lesson_learned");
  const quote = opt(args.project, "customer_quote");

  const local = neighborhood ? ` in ${neighborhood}` : city ? ` in ${city}` : area ? ` in ${area}` : "";

  const angles: Record<string, string> = {
    educational: `What this ${service} job can teach you`,
    seo: `${service}${local}: a real case`,
    social_proof: `How ${company} handled a tricky ${service}`,
    process: `Inside a ${service}: step by step`,
  };
  const headline = angles[args.intent] || `${service}${local}`;

  const equipLine = equipment ? `Equipment involved: ${equipment}.` : "";
  const outcomeLine = outcome ? `Outcome: ${outcome}.` : "";
  const unusualLine = unusual ? `What stood out: ${unusual}` : "";
  const lessonLine = lesson ? `Lesson for other techs: ${lesson}` : "";
  const quoteLine = quote ? `> "${quote}"` : "";
  const toneTag = args.tone === "more_technical" ? " (technical voice)" : args.tone === "more_homeowner" ? " (homeowner-friendly voice)" : "";
  const lengthHint = args.length ?? "medium";

  const blog = `# ${headline}${toneTag}

We got called out for a ${service}${local}. The customer's complaint: ${symptom}.

## What we did
${fix}
${equipLine}

${unusualLine}

${outcomeLine}

${quoteLine}

${lessonLine}

If you're dealing with something similar, ${cta}. — ${company}`;

  const fb = `${headline}

Called out for a ${service}${local}. Complaint: ${symptom}. Here's what we did: ${fix}. ${outcomeLine}

${cta} — ${company}`;

  const tagify = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "");
  const hashtags = ["HVAC", tagify(service), neighborhood ? tagify(neighborhood) : ""].filter(Boolean);
  const ig = `${headline}

${symptom} → ${fix}.
${outcome ? outcome + " " : ""}${cta}

${hashtags.map((h) => `#${h}`).join(" ")}`;

  const caseStudy = `# ${headline}

**Customer:** ${ctype}${local}

**Problem.** ${symptom}

**Approach.** ${fix}${equipment ? ` ${equipLine}` : ""}

**Result.** ${outcome || "[confirm: outcome]"}

${quoteLine}

${unusualLine}

${cta} — ${company}`;

  const bodies: Record<string, string> = { blog, facebook: fb, instagram: ig, case_study: caseStudy };
  let body = (bodies[args.channel] || blog).trim();

  // Length variant: crude shorten/extend on the stub.
  if (lengthHint === "short" && body.length > 400) body = body.slice(0, 400) + "…";
  if (lengthHint === "long" && args.channel !== "instagram") body = body + `\n\nP.S. Want this kind of work done right? ${cta}.`;

  if (!outcome && args.channel === "case_study" && !confirms.find((c) => c.key === "outcome")) {
    confirms.push({ key: "outcome", prompt: "How did the job end?" });
  }

  const seen = new Set<string>();
  const flagged_unknowns = confirms.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
  return { headline, body, hashtags: args.channel === "instagram" ? hashtags : [], flagged_unknowns };
}

// ----------------- ANTHROPIC PATH -----------------

const CHANNEL_SPEC: Record<string, string> = {
  blog: "Format: a single H1 markdown headline, then 400-600 words of scannable prose with short paragraphs and 1-2 subheadings. Naturally mention the city or neighborhood. End with the CTA exactly once.",
  case_study: "Format: a single H1 markdown headline, then ~300-450 words structured as **Problem**, **Approach**, **Result** sections. End with the CTA exactly once.",
  facebook: "Format: NO headline. 80-150 words, conversational, first-person, one CTA. Plain text only.",
  instagram: "Format: a caption of 60-125 words (plain text, no markdown), then a blank line, then 5-8 relevant hashtags on the final line (e.g. #HVAC #Brooklyn). No headline.",
  internal_doc: "Format: structured Markdown reference document. Lead with an H1 headline naming the topic. Use H2 sections (e.g., Symptoms, Diagnosis, Common causes, Standard procedure, Pitfalls, Customer-facing explanation). Bullet lists where helpful. Length 300-700 words. No CTA. No promotional language.",
};

const LENGTH_HINT: Record<string, string> = {
  short: "Target the LOW end of the channel's word range.",
  medium: "Target the MIDDLE of the channel's word range.",
  long: "Target the HIGH end of the channel's word range.",
};

function jsonOmitEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

const DEFAULT_AUDIENCE_TONES: Record<string, string> = {
  homeowner: "Explain HVAC concepts in plain language. Never assume the reader knows trade jargon — when a technical term is necessary, define it briefly inline. Tone is warm, patient, and respectful of the reader's intelligence. Avoid talking down.",
  tech_training: "Assume the reader is a junior or apprentice HVAC technician with baseline literacy. Use trade vocabulary precisely. Show diagnostic reasoning step by step. Include the WHY behind each decision, not just the WHAT.",
  sales_training: "Assume the reader is a salesperson who needs to talk credibly about the work to customers. Emphasize value framing, common customer objections, and how to translate technical work into outcomes the customer feels. Avoid deep diagnostic detail.",
  knowledge_base: "Reference-style: dense, factual, scannable. Lead with the conclusion. Use short paragraphs and structure (headings, lists where appropriate). Assume the reader is searching for a specific answer, not reading start-to-finish.",
};

function isInternal(audience: string, channel: string): boolean {
  return audience === "knowledge_base" || channel === "internal_doc";
}

function buildSystemPrompt(audience: string, channel: string, audienceTone: string): string {
  const internal = isInternal(audience, channel);
  return [
    "You are a marketing coordinator for a trade business. Write trade-accurate content in the company's own voice.",
    "HARD RULES:",
    "(a) NEVER invent facts. If a specific detail (brand, model number, warranty length, price, date, customer name, exact measurement, neighborhood) is not present in the provided project data, do NOT guess — insert a placeholder in the EXACT form [confirm: <short question>]. Example: [confirm: what brand of furnace?].",
    internal
      ? "(b) This is INTERNAL content — no call-to-action. End with a concise summary instead."
      : "(b) Include the chosen call-to-action exactly once, near the end.",
    "(c) For customer-facing blog/seo content, naturally include the city or neighborhood from the project location in the body and (where applicable) the headline.",
    "(d) Match the company's VOICE SAMPLES — imitate their rhythm, sentence length, and word choice. Do NOT copy the example content into your output; only mirror the style.",
    "(e) Output ONLY the requested asset. No preamble, no explanation, no meta commentary, no surrounding quotes or code fences.",
    "",
    "=== AUDIENCE PERSONA ===",
    `Audience: ${audience}`,
    audienceTone,
  ].join("\n");
}

function buildUserPrompt(args: {
  intent: string;
  channel: string;
  audience: string;
  length?: string;
  tone?: string | null;
  project: Record<string, unknown>;
  company: Record<string, unknown>;
  intentNotes: Record<string, unknown>;
}): string {
  const sections: string[] = [];
  const internal = isInternal(args.audience, args.channel);

  // LAYER 2 — Company
  const companyName = (args.company.name as string) || "";
  sections.push("=== COMPANY ===");
  sections.push(`Name: ${companyName || "[confirm: company_name]"}`);
  sections.push(`Trade: ${args.company.trade ?? "HVAC"}`);

  const serviceArea = Array.isArray(args.company.service_area) ? (args.company.service_area as string[]) : [];
  if (serviceArea.length) sections.push(`Service area: ${serviceArea.join(", ")}`);

  const diffs = Array.isArray(args.company.differentiators) ? (args.company.differentiators as string[]) : [];
  if (diffs.length) sections.push(`Differentiators: ${diffs.join("; ")}`);

  const lines = Array.isArray(args.company.service_lines) ? (args.company.service_lines as Array<Record<string, unknown>>) : [];
  if (lines.length) {
    sections.push("Service lines:");
    for (const sl of lines) {
      const nm = sl.name ?? sl.id ?? "";
      const desc = sl.description ? ` — ${sl.description}` : "";
      const kw = Array.isArray(sl.keywords) ? ` (keywords: ${(sl.keywords as string[]).join(", ")})` : "";
      sections.push(`- ${nm}${desc}${kw}`);
    }
  }

  const voiceExamples = Array.isArray(args.company.voice_examples) ? (args.company.voice_examples as Array<Record<string, unknown>>) : [];
  if (voiceExamples.length) {
    sections.push("\n=== VOICE SAMPLES (match tone, DO NOT copy content) ===");
    for (const ve of voiceExamples) {
      const label = ve.label ?? "sample";
      const para = ve.paragraph ?? "";
      sections.push(`-- VOICE SAMPLE — ${label} --`);
      sections.push(String(para));
    }
  }

  // Pick one CTA. Future: caller picks; for now first standard CTA.
  const ctas = Array.isArray(args.company.standard_ctas) ? (args.company.standard_ctas as Array<Record<string, unknown>>) : [];
  const cta = ctas[0] ?? null;
  if (internal) {
    sections.push("\n=== CALL TO ACTION ===");
    sections.push("(Internal content — no call-to-action. End with a concise summary instead.)");
  } else {
    sections.push("\n=== CALL TO ACTION (use exactly once) ===");
    if (cta) {
      const label = (cta.label as string) || "[confirm: cta]";
      const dest = (cta.destination as string) || "";
      sections.push(dest ? `${label} (${dest})` : label);
    } else {
      sections.push("[confirm: cta]");
    }
  }

  // LAYER 3 — Project (omit empties)
  const projectFields = jsonOmitEmpty({
    service_type_detail: args.project.service_type_detail,
    location_city: args.project.location_city,
    location_neighborhood: args.project.location_neighborhood,
    location_region: args.project.location_region,
    customer_type: args.project.customer_type,
    before_state: args.project.before_state,
    scope_performed: args.project.scope_performed,
    outcome: args.project.outcome,
    materials_used: args.project.materials_used,
    equipment_used: args.project.equipment_used,
    unusual_details: args.project.unusual_details,
    lesson_learned: args.project.lesson_learned,
    homeowner_misconception: args.project.homeowner_misconception,
    customer_quote: args.project.customer_quote,
  });
  sections.push("\n=== PROJECT FACTS (only what's listed here is known — anything not listed must be a [confirm: ...] placeholder) ===");
  for (const [k, v] of Object.entries(projectFields)) {
    const val = Array.isArray(v) ? (v as unknown[]).join(", ") : String(v);
    sections.push(`${k}: ${val}`);
  }

  const notes = jsonOmitEmpty(args.intentNotes);
  if (Object.keys(notes).length) {
    sections.push("\n=== ANGLE-SPECIFIC NOTES ===");
    for (const [k, v] of Object.entries(notes)) {
      sections.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }

  // LAYER 4 — Output spec
  sections.push("\n=== OUTPUT SPEC ===");
  sections.push(`Intent: ${args.intent}`);
  sections.push(`Audience: ${args.audience}`);
  sections.push(`Channel: ${args.channel}`);
  sections.push(LENGTH_HINT[args.length ?? "medium"] ?? LENGTH_HINT.medium);
  if (args.tone === "more_technical") sections.push("Tone override: more technical — assume the reader is another tradesperson; use precise terminology.");
  if (args.tone === "more_homeowner") sections.push("Tone override: more homeowner-friendly — assume a non-technical homeowner; avoid jargon.");
  sections.push(CHANNEL_SPEC[args.channel] ?? CHANNEL_SPEC.blog);
  sections.push("\nReminder: any unknown specific fact MUST appear as [confirm: <short question>]. Do not guess. Begin the asset now.");

  return sections.join("\n");
}

function parseOutput(raw: string, channel: string): { headline: string; body: string; hashtags: string[]; flagged_unknowns: Confirm[] } {
  let body = raw.trim();
  // Strip wrapping code fences if model added them.
  body = body.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();

  let headline = "";
  let hashtags: string[] = [];

  if (channel === "blog" || channel === "case_study") {
    const h1 = body.match(/^#\s+(.+)$/m);
    if (h1) {
      headline = h1[1].trim();
    } else {
      // Fallback: first non-empty line.
      const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
      headline = firstLine.replace(/^#+\s*/, "").trim();
    }
  } else if (channel === "instagram") {
    // Extract trailing hashtag line.
    const linesArr = body.split("\n");
    for (let i = linesArr.length - 1; i >= 0; i--) {
      const t = linesArr[i].trim();
      if (!t) continue;
      const tags = t.match(/#[A-Za-z0-9_]+/g);
      if (tags && tags.length >= 3 && tags.join(" ").length >= t.length * 0.6) {
        hashtags = tags.map((h) => h.slice(1));
        body = linesArr.slice(0, i).join("\n").trim();
      }
      break;
    }
  }

  // Scan for [confirm: ...] placeholders.
  const flagged_unknowns: Confirm[] = [];
  const seen = new Set<string>();
  const re = /\[confirm:\s*([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const prompt = m[1].trim();
    const key = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "unknown";
    if (seen.has(key)) continue;
    seen.add(key);
    flagged_unknowns.push({ key, prompt });
  }

  return { headline, body, hashtags, flagged_unknowns };
}

async function callAnthropic(args: {
  apiKey: string;
  intent: string;
  channel: string;
  audience: string;
  audienceTone: string;
  length?: string;
  tone?: string | null;
  project: Record<string, unknown>;
  company: Record<string, unknown>;
  intentNotes: Record<string, unknown>;
}): Promise<{ headline: string; body: string; hashtags: string[]; flagged_unknowns: Confirm[] }> {
  const system = buildSystemPrompt(args.audience, args.channel, args.audienceTone);
  const user = buildUserPrompt(args);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Anthropic ${resp.status}: ${text.slice(0, 500)}`);
  }
  const data = await resp.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((p: { type: string }) => p.type === "text").map((p: { text: string }) => p.text).join("\n").trim()
    : "";
  if (!text) throw new Error("Anthropic returned empty content");

  return parseOutput(text, args.channel);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { projectId, intent, channel, length, tone, audience: audienceIn } = await req.json();
    const audience = (audienceIn && typeof audienceIn === "string" ? audienceIn : "homeowner");

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });

    // RLS ("own projects") scopes this read to the caller: non-owned ids come back null.
    const { data: project } = await userClient.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });

    const companyId = (project as { company_id: string }).company_id;
    // RLS (auth.uid() = owner_user_id) scopes the company read to the caller.
    const { data: company } = await userClient.from("companies").select("*").eq("id", companyId).maybeSingle();
    if (!company) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...cors, "content-type": "application/json" } });

    const tones = ((company as { audience_tone_modifiers?: Record<string, string> }).audience_tone_modifiers) ?? {};
    const audienceTone = (tones[audience] && String(tones[audience]).trim()) || DEFAULT_AUDIENCE_TONES[audience] || DEFAULT_AUDIENCE_TONES.homeowner;

    const { data: intentRow } = await userClient
      .from("content_intents")
      .select("notes")
      .eq("project_id", projectId)
      .eq("intent_type", intent)
      .maybeSingle();
    const intentNotes = (intentRow?.notes ?? {}) as Record<string, unknown>;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    let result: { headline: string; body: string; hashtags: string[]; flagged_unknowns: Confirm[] };
    let modelUsed = MODEL;

    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY missing — using stub fallback");
      result = buildDraft({ intent, channel, length, tone, project: project as Record<string, unknown>, company: company as Record<string, unknown> });
      modelUsed = "stub-fallback";
    } else {
      try {
        result = await callAnthropic({
          apiKey,
          intent, channel, length, tone,
          audience, audienceTone,
          project: project as Record<string, unknown>,
          company: company as Record<string, unknown>,
          intentNotes,
        });
      } catch (err) {
        console.error("Anthropic call failed:", err instanceof Error ? err.message : String(err));
        result = buildDraft({ intent, channel, length, tone, project: project as Record<string, unknown>, company: company as Record<string, unknown> });
        modelUsed = "stub-fallback";
      }
    }

    const payload = {
      ...result,
      generation_metadata: {
        model: modelUsed,
        prompt_version: PROMPT_VERSION,
        audience,
        generated_at: new Date().toISOString(),
      },
    };
    return new Response(JSON.stringify(payload), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    console.error("generate-content fatal:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
