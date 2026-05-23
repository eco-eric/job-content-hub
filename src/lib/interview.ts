import type { Database } from "@/integrations/supabase/types";

export type WorthinessTag = Database["public"]["Enums"]["worthiness_tag"];

export type Question = {
  key: string;
  prompt: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
};

// Layer 1: facts we always need. Missing = [confirm: …] in generator.
export const LAYER_1: Question[] = [
  { key: "service_line", prompt: "What kind of job was this?", hint: "e.g. furnace repair, AC install, ductwork", required: true },
  { key: "customer_type", prompt: "Residential or commercial?", required: true },
  { key: "neighborhood", prompt: "Neighborhood, city or zip", hint: "Used for local SEO. No street addresses." },
  { key: "equipment", prompt: "Equipment involved", hint: "Brand, model, age if you know it. Skip what you don't.", multiline: true },
  { key: "symptom", prompt: "What was the customer's complaint?", multiline: true, required: true },
  { key: "root_cause", prompt: "What did you actually find?", multiline: true, required: true },
  { key: "fix", prompt: "What did you do to fix it?", multiline: true, required: true },
  { key: "duration", prompt: "Roughly how long did the job take?" },
  { key: "outcome", prompt: "How did it end? What was the customer's reaction?", multiline: true },
];

// Branch question — only one branch in MVP, keyed by worthiness tag.
export const BRANCH_UNUSUAL_PROBLEM: Question[] = [
  { key: "branch_what_made_it_unusual", prompt: "What made this one unusual?", multiline: true, required: true },
  { key: "branch_why_tricky", prompt: "Why was the diagnosis or repair tricky?", multiline: true },
  { key: "branch_lesson", prompt: "Anything another tech could learn from this?", multiline: true },
];

export function questionsFor(tag: WorthinessTag | null | undefined): Question[] {
  const layer1 = LAYER_1;
  if (tag === "unusual_problem") return [...layer1, ...BRANCH_UNUSUAL_PROBLEM];
  return layer1;
}