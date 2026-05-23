export type WorthinessTag =
  | "unusual_problem"
  | "dramatic_before_after"
  | "customer_stressed"
  | "taught_me_something"
  | "common_misconception";

export type Question = {
  key: string; // matches a projects column name
  prompt: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
};

// Layer 1: always required for any worthy job. Empty values become
// [confirm: <key>] tokens in generation — no-invented-facts contract.
export const LAYER_1: Question[] = [
  { key: "service_type_detail", prompt: "What kind of job was this?", hint: "e.g. furnace repair, AC install, ductwork", required: true },
  { key: "customer_type", prompt: "Residential or commercial?", required: true },
  { key: "location_neighborhood", prompt: "Neighborhood, city or area", hint: "Used for local SEO. No street addresses." },
  { key: "equipment_used", prompt: "Equipment involved", hint: "Brand, model, age if you know it. Comma separated.", multiline: true },
  { key: "before_state", prompt: "What was the customer's complaint?", multiline: true, required: true },
  { key: "scope_performed", prompt: "What did you do to fix it?", multiline: true, required: true },
  { key: "outcome", prompt: "How did it end? What was the customer's reaction?", multiline: true },
];

export const BRANCH_UNUSUAL_PROBLEM: Question[] = [
  { key: "unusual_details", prompt: "What made this one unusual?", multiline: true, required: true },
  { key: "lesson_learned", prompt: "Anything another tech could learn from this?", multiline: true },
];

// Columns stored as text[] in the projects table.
export const ARRAY_COLUMNS = new Set<string>(["equipment_used", "materials_used"]);

export function questionsFor(tag: string | null | undefined): Question[] {
  if (tag === "unusual_problem") return [...LAYER_1, ...BRANCH_UNUSUAL_PROBLEM];
  return LAYER_1;
}

// Layer-1 keys that MUST be present or the generator emits a [confirm:] token.
export const REQUIRED_LAYER_1 = LAYER_1.filter(q => q.required).map(q => q.key);
