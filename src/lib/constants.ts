export const INTENTS = [
  { id: "educational", label: "Educational", blurb: "Teach a homeowner something useful from this job." },
  { id: "seo", label: "SEO / Local SEO", blurb: "Rank for what your customers actually type." },
  { id: "social_proof", label: "Social Proof", blurb: "Show you can handle this kind of work." },
  { id: "process", label: "Process / Story", blurb: "Walk through how you did the work." },
] as const;

export type IntentId = (typeof INTENTS)[number]["id"];

// Per-intent quick follow-ups saved into content_intents.notes.
export const INTENT_FOLLOWUPS: Record<IntentId, { key: string; prompt: string }[]> = {
  educational: [{ key: "homeowner_should_know", prompt: "What's one thing a homeowner should know before calling about this?" }],
  seo: [{ key: "search_phrases", prompt: "What do customers actually say or type when they call about this?" }],
  social_proof: [{ key: "customer_quote", prompt: "Did the customer say anything quotable? (We'll save it on the project too.)" }],
  process: [{ key: "showable_step", prompt: "What part of the work would you show someone?" }],
};

// Channel ids match the schema's content_assets.channel values.
export const CHANNELS = [
  { id: "blog", label: "Blog post", blurb: "Long-form, headings, ~700–1000 words." },
  { id: "facebook", label: "Facebook post", blurb: "Conversational, 80–150 words." },
  { id: "instagram", label: "Instagram caption", blurb: "Short hook + a few hashtags." },
  { id: "case_study", label: "Case study", blurb: "Problem → Approach → Result." },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];
export const ALL_CHANNELS: ChannelId[] = CHANNELS.map(c => c.id);

export const WORTHINESS_TAGS = [
  { id: "unusual_problem", label: "Unusual problem" },
  { id: "dramatic_before_after", label: "Dramatic before / after" },
  { id: "customer_stressed", label: "Customer was stressed and we fixed it" },
  { id: "taught_me_something", label: "It taught me something" },
  { id: "common_misconception", label: "Common issue homeowners miss" },
] as const;

export const PHOTO_TAGS = ["before", "after", "process", "detail"] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];

// Three voice samples — same fictional job, three different voices.
// User picks the closest, edits the paragraph. The paragraph IS the voice sample.
export const VOICE_SAMPLES = [
  {
    id: "straight_talker",
    label: "Straight-talking",
    paragraph:
      "Got a call this morning — no heat, family of four. Pulled up, found the inducer motor seized. Had the part on the truck, swapped it in about forty minutes. Cycled the system twice to make sure it stayed lit. Charged them the diagnostic plus the part. No nonsense. That's how we work.",
  },
  {
    id: "warm_reassuring",
    label: "Warm and reassuring",
    paragraph:
      "Met a young family this morning who'd woken up to a cold house — never fun with a baby in the room. I got out there as fast as I could, took a look at the furnace, and found the inducer motor had given out. Lucky for them I had the part on the truck. About forty minutes later they were warm again. We cycled the system twice just to be sure, and I left them with a few tips on what to watch for. Glad we got them sorted before the day got any colder.",
  },
  {
    id: "technical_authority",
    label: "Technical authority",
    paragraph:
      "Service call this morning: no-heat call on a mid-efficiency forced-air furnace. Diagnosis: failed inducer motor — no draft pressure at the switch, no call for ignition. Replaced the motor with an OEM equivalent stocked on the truck, verified pressure switch closure, ran two full ignition cycles to confirm flame stability and limit operation. System restored to normal sequence in under an hour. Customer billed standard diagnostic plus the inducer assembly. Recommended an annual tune-up to catch wear like this before it strands them.",
  },
] as const;

// Pre-fill suggestions for service_lines on first onboarding.
export const HVAC_SERVICE_LINE_SUGGESTIONS: Array<{ name: string; description: string }> = [
  { name: "AC repair", description: "Diagnose and fix a non-cooling or under-performing AC." },
  { name: "AC install", description: "New central AC or replacement install." },
  { name: "Furnace repair", description: "No-heat / short-cycle / pilot or ignition issues." },
  { name: "Furnace install", description: "New furnace install or full replacement." },
  { name: "Heat pump install", description: "Air-source heat pump install or changeover." },
  { name: "Maintenance / tune-up", description: "Seasonal cleaning and inspection." },
  { name: "Ductwork", description: "New, sealed, or repaired duct runs." },
  { name: "Thermostat", description: "Smart or programmable thermostat install / setup." },
  { name: "Refrigerant / leak", description: "Leak search, repair, recharge." },
  { name: "Indoor air quality", description: "Filtration, humidifier, UV, ventilation." },
  { name: "Emergency / no-heat", description: "After-hours no-heat or no-cool calls." },
  { name: "Mini-split", description: "Ductless mini-split install or service." },
];

// Standard CTAs the user can toggle on/off, with an editable destination.
export const STANDARD_CTAS: Array<{ id: string; label: string; type: "phone" | "url" | "email"; destinationPlaceholder: string }> = [
  { id: "call_now", label: "Call now", type: "phone", destinationPlaceholder: "Phone number" },
  { id: "request_quote", label: "Request a quote", type: "url", destinationPlaceholder: "Quote form URL" },
  { id: "financing_available", label: "Financing available", type: "url", destinationPlaceholder: "Financing page URL" },
  { id: "seasonal_tune_up", label: "Book a seasonal tune-up", type: "url", destinationPlaceholder: "Booking URL" },
  { id: "maintenance_plan", label: "Ask about our maintenance plan", type: "url", destinationPlaceholder: "Maintenance plan URL" },
];
