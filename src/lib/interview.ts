// Interview question schema. One question per screen at runtime.
//
// Layer 1 (always asked, every worthiness branch).
// Layer 2 (per worthiness tag) — only the `unusual_problem` branch is built
// now; the switch below is clearly marked for the others to plug into later.

export type WorthinessTag =
  | "unusual_problem"
  | "dramatic_before_after"
  | "customer_stressed"
  | "taught_me_something"
  | "common_misconception";

export type ChipMode = "replace" | "toggle";

export type Question = {
  // Stable id for interview_state tracking.
  id: string;
  // Which projects column(s) this question writes to.
  column: string;
  // For composite questions that write to two columns (the "Where" question).
  extraColumns?: string[];
  prompt: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
  // Chip choices. "service_lines" = pull from companies.service_lines.
  chips?: string[] | "service_lines";
  // replace = chip overwrites the text; toggle = chip text is added/removed.
  chipMode?: ChipMode;
  // For an "append to existing column" question (e.g. follow-up diag chain).
  appendTo?: string;
  // Mark this column as a text[] in the projects table.
  isArray?: boolean;
  // Should this step show the "attach photo" button?
  allowPhoto?: boolean;
  // Tag applied to any photo attached at this step.
  photoTag?: "before" | "after" | "process" | "detail";
};

export const LAYER_1: Question[] = [
  {
    id: "service",
    column: "service_type_detail",
    prompt: "What service did you perform?",
    hint: "Tap all that apply, or type it in.",
    chips: "service_lines",
    required: true,
  },
  {
    id: "location",
    column: "location_city",
    extraColumns: ["location_neighborhood"],
    prompt: "Where was the job?",
    hint: "City and (optionally) the neighborhood — helps with local SEO. No street addresses.",
  },
  {
    id: "customer_type",
    column: "customer_type",
    prompt: "Residential or commercial?",
    chips: ["single-family", "multi-family", "small business"],
    chipMode: "replace",
    required: true,
  },
  {
    id: "before_state",
    column: "before_state",
    prompt: "What was wrong when you got there?",
    hint: "Tap any that apply, and add detail in your own words.",
    chips: [
      "capacitor",
      "compressor",
      "refrigerant leak",
      "blower motor",
      "control board",
      "thermostat",
      "ductwork",
      "no cooling",
      "no heat",
      "other",
    ],
    chipMode: "toggle",
    multiline: true,
    required: true,
    allowPhoto: true,
    photoTag: "before",
  },
  {
    id: "scope_performed",
    column: "scope_performed",
    prompt: "What did you actually do?",
    multiline: true,
    required: true,
    allowPhoto: true,
    photoTag: "process",
  },
  {
    id: "outcome",
    column: "outcome",
    prompt: "What was the outcome for the customer?",
    chips: ["comfort restored", "lower bills", "safety issue fixed", "more reliable", "better air quality"],
    chipMode: "toggle",
    multiline: true,
    allowPhoto: true,
    photoTag: "after",
  },
];

// LAYER 2 — branch by worthiness_tag.
// IMPORTANT: only `unusual_problem` is built now. The other branches stub out
// to LAYER_1 only; plug them in here when their question lists are designed.
const BRANCH_UNUSUAL_PROBLEM: Question[] = [
  {
    id: "unusual_details",
    column: "unusual_details",
    prompt: "What made this different from a normal call?",
    multiline: true,
    required: true,
  },
  {
    id: "diag_chain",
    column: "unusual_details",
    appendTo: "unusual_details",
    prompt: "What did you check first, and what did it turn out to be?",
    hint: "We'll append this to the unusual-details note.",
    multiline: true,
  },
  {
    id: "lesson_learned",
    column: "lesson_learned",
    prompt: "What would a less experienced tech have missed?",
    multiline: true,
  },
];

export function questionsFor(tag: WorthinessTag | string | null | undefined): Question[] {
  switch (tag) {
    case "unusual_problem":
      return [...LAYER_1, ...BRANCH_UNUSUAL_PROBLEM];
    // TODO: implement these branches:
    case "dramatic_before_after":
    case "customer_stressed":
    case "taught_me_something":
    case "common_misconception":
    default:
      return LAYER_1;
  }
}

export const ARRAY_COLUMNS = new Set<string>(["materials_used", "equipment_used"]);

export type InterviewState = {
  answered: string[]; // question ids
  skipped: string[];
  completion_pct: number;
};

export function computeState(qs: Question[], project: Record<string, unknown>): InterviewState {
  const answered: string[] = [];
  for (const q of qs) {
    const v = project[q.column];
    const filled = Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null;
    if (filled) answered.push(q.id);
  }
  return {
    answered,
    skipped: [],
    completion_pct: qs.length === 0 ? 0 : Math.round((answered.length / qs.length) * 100),
  };
}
