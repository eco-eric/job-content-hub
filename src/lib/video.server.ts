// Server-only helpers for walkthrough video analysis.
// Kept out of *.functions.ts so the server-fn splitter never drops them.

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const VIDEO_MODEL = "google/gemini-3.6-flash";
const TRANSCRIBE_MODEL = "openai/gpt-4o-transcribe";
export const ANALYSIS_VERSION = "walkthrough-v1";

export type WalkthroughFields = {
  before_state?: string;
  scope_performed?: string;
  outcome?: string;
  equipment_used?: string[];
  materials_used?: string[];
  unusual_details?: string;
  lesson_learned?: string;
  customer_quote?: string;
};

export type WalkthroughAnalysis = {
  transcript: string;
  document_markdown: string;
  fields: WalkthroughFields;
  open_questions: string[];
  source: "video" | "audio-only";
  model: string;
  version: string;
};

const HARD_RULES = [
  "NEVER invent facts. Brands, model numbers, capacities, ages, prices, dates, names, measurements:",
  "if it is not clearly said out loud or clearly readable/visible, write a placeholder in the EXACT form",
  "[confirm: <short question>] instead of guessing. Example: [confirm: what brand is the condenser?].",
  "Do not smooth over uncertainty. A placeholder is always better than a plausible guess.",
].join(" ");

const JSON_SHAPE = `Return ONLY a JSON object (no code fences, no commentary) with exactly these keys:
{
  "transcript": "verbatim transcript of everything the speaker says, with [mm:ss] markers at natural breaks",
  "document_markdown": "a Markdown document: an H1 title, then '## Overview', '## Walkthrough' (timestamped bullets in [mm:ss] form), '## Equipment and conditions observed', '## Open questions' (one bullet per [confirm: ...] you used). No marketing language, no call to action.",
  "fields": {
    "before_state": "", "scope_performed": "", "outcome": "",
    "equipment_used": [], "materials_used": [],
    "unusual_details": "", "lesson_learned": "", "customer_quote": ""
  },
  "open_questions": ["short question for each [confirm: ...] placeholder used"]
}
Leave any "fields" value empty ("" or []) when the recording does not support it. Never fill a field with a guess.`;

function videoPrompt(segment?: { index: number; total: number }): string {
  return [
    "You are documenting a trade technician's walkthrough recording.",
    "The speaker is narrating while walking through a property or a job.",
    segment && segment.total > 1
      ? `This is part ${segment.index + 1} of ${segment.total} of one longer recording. Timestamp everything relative to the START OF THIS PART (it begins at 00:00). Do not try to guess what happened in other parts.`
      : "",
    HARD_RULES,
    "Transcribe what is said, and describe what is actually shown on camera, keeping both tied to timestamps.",
    JSON_SHAPE,
  ].filter(Boolean).join("\n\n");
}

function transcriptPrompt(transcript: string): string {
  return [
    "You are documenting a trade technician's walkthrough recording.",
    "Only the audio transcript is available — you cannot see the video, so never describe visuals.",
    HARD_RULES,
    JSON_SHAPE,
    "=== TRANSCRIPT ===",
    transcript,
  ].join("\n\n");
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean);
}

export function parseAnalysis(raw: string, fallbackTranscript: string): Omit<WalkthroughAnalysis, "source" | "model" | "version"> {
  const text = stripFences(raw);
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { obj = {}; }
    }
  }

  const f = (obj.fields ?? {}) as Record<string, unknown>;
  const document_markdown = asString(obj.document_markdown) || (text ? text : "");
  const transcript = asString(obj.transcript) || fallbackTranscript;

  let open_questions = asStringArray(obj.open_questions);
  if (!open_questions.length) {
    const seen = new Set<string>();
    const re = /\[confirm:\s*([^\]]+)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(document_markdown)) !== null) {
      const q = m[1].trim();
      if (!seen.has(q.toLowerCase())) { seen.add(q.toLowerCase()); open_questions.push(q); }
    }
  }

  return {
    transcript,
    document_markdown,
    open_questions,
    fields: {
      before_state: asString(f.before_state),
      scope_performed: asString(f.scope_performed),
      outcome: asString(f.outcome),
      equipment_used: asStringArray(f.equipment_used),
      materials_used: asStringArray(f.materials_used),
      unusual_details: asString(f.unusual_details),
      lesson_learned: asString(f.lesson_learned),
      customer_quote: asString(f.customer_quote),
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function gatewayError(status: number, body: string): Error {
  if (status === 402) return new Error("Out of AI credits. Add credits in workspace settings and try again.");
  if (status === 429) return new Error("AI is rate limited right now. Wait a moment and try again.");
  return new Error(`AI gateway ${status}: ${body.slice(0, 300)}`);
}

async function chat(apiKey: string, body: Record<string, unknown>): Promise<string> {
  const resp = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw gatewayError(resp.status, await resp.text().catch(() => ""));
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("The model returned an empty response.");
  return text;
}

/** Full video understanding: the model sees the frames AND hears the narration. */
export async function analyzeVideoDirect(apiKey: string, bytes: Uint8Array, mime: string): Promise<string> {
  const base64 = bytesToBase64(bytes);
  return chat(apiKey, {
    model: VIDEO_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: videoPrompt() },
        { type: "file", file: { filename: `walkthrough.${mime.split("/")[1] ?? "mp4"}`, file_data: `data:${mime};base64,${base64}` } },
      ],
    }],
  });
}

/** Fallback: transcribe the audio track, then document from the transcript alone. */
export async function transcribeMedia(apiKey: string, bytes: Uint8Array, mime: string): Promise<string> {
  const ext = ({ "video/mp4": "mp4", "video/quicktime": "mp4", "video/webm": "webm" } as Record<string, string>)[mime] ?? "mp4";
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mime }), `walkthrough.${ext}`);
  const resp = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!resp.ok) throw gatewayError(resp.status, await resp.text().catch(() => ""));
  const data = await resp.json() as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) throw new Error("No speech was detected in that recording.");
  return text;
}

export async function documentFromTranscript(apiKey: string, transcript: string): Promise<string> {
  return chat(apiKey, {
    model: VIDEO_MODEL,
    messages: [{ role: "user", content: transcriptPrompt(transcript) }],
  });
}

export const MODELS = { video: VIDEO_MODEL, transcribe: TRANSCRIBE_MODEL };
