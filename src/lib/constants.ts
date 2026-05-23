export const INTENTS = [
  { id: "educational", label: "Educate", blurb: "Teach the reader something useful from this job." },
  { id: "seo", label: "SEO", blurb: "Rank for what your customers search." },
  { id: "social_proof", label: "Social Proof", blurb: "Show you can handle this kind of work." },
  { id: "process", label: "Process", blurb: "Walk through how you actually did it." },
] as const;

export const CHANNELS = [
  { id: "seo_blog", label: "SEO Blog Post", blurb: "Long-form, headings, ~700–1000 words." },
  { id: "facebook", label: "Facebook Post", blurb: "Conversational, 80–150 words." },
  { id: "instagram", label: "Instagram Caption", blurb: "Short hook + a few hashtags." },
  { id: "case_study", label: "Case Study", blurb: "Problem → Approach → Result." },
] as const;

export const WORTHINESS_TAGS = [
  { id: "unusual_problem", label: "Unusual problem" },
  { id: "dramatic_before_after", label: "Dramatic before / after" },
  { id: "customer_stressed", label: "Customer was stressed" },
  { id: "taught_me_something", label: "Taught me something" },
  { id: "common_misconception", label: "Busts a common misconception" },
] as const;

export const PHOTO_TAGS = ["before", "after", "process", "detail"] as const;

export const VOICE_SAMPLES = [
  {
    id: "straight_shooter",
    label: "Straight Shooter",
    text:
      "Got a call this morning — no heat, family of four, baby in the house. Pulled up, found the inducer motor seized. Had the right part on the truck, swapped it in about forty minutes. Cycled the system twice to make sure it stayed lit. Charged them the diagnostic plus the part, no nonsense. That's how we do it.",
  },
  {
    id: "teacher",
    label: "Teacher",
    text:
      "A lot of folks don't realize that when your furnace short-cycles, it's usually not the thermostat — it's a dirty flame sensor. Took me about ten minutes today to pull it, clean the rod with fine sandpaper, and put it back. The furnace fired right up and held. Small parts, big difference. Worth checking before you replace anything expensive.",
  },
  {
    id: "neighborly",
    label: "Neighborly",
    text:
      "Met the Hendersons today over on Maple — sweetest couple, AC quit on them right before the heat wave. Took a look, found the capacitor was bulging like a soda can. Quick swap, system back up before lunch. They kept offering me iced tea. That's the part of this job I love — showing up, fixing it, leaving folks better than I found them.",
  },
] as const;