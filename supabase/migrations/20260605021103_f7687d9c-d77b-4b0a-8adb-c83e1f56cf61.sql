
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS audience_tone_modifiers jsonb NOT NULL DEFAULT
  '{"homeowner":"Explain HVAC concepts in plain language. Never assume the reader knows trade jargon — when a technical term is necessary, define it briefly inline. Tone is warm, patient, and respectful of the reader''s intelligence. Avoid talking down.","tech_training":"Assume the reader is a junior or apprentice HVAC technician with baseline literacy. Use trade vocabulary precisely. Show diagnostic reasoning step by step. Include the WHY behind each decision, not just the WHAT.","sales_training":"Assume the reader is a salesperson who needs to talk credibly about the work to customers. Emphasize value framing, common customer objections, and how to translate technical work into outcomes the customer feels. Avoid deep diagnostic detail.","knowledge_base":"Reference-style: dense, factual, scannable. Lead with the conclusion. Use short paragraphs and structure (headings, lists where appropriate). Assume the reader is searching for a specific answer, not reading start-to-finish."}'::jsonb;

ALTER TABLE public.content_intents
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'homeowner'
  CHECK (audience IN ('homeowner','tech_training','sales_training','knowledge_base'));

ALTER TABLE public.content_assets
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'homeowner'
  CHECK (audience IN ('homeowner','tech_training','sales_training','knowledge_base'));

ALTER TABLE public.content_assets DROP CONSTRAINT IF EXISTS content_assets_channel_check;
ALTER TABLE public.content_assets
  ADD CONSTRAINT content_assets_channel_check
  CHECK (channel IN ('blog','facebook','instagram','case_study','internal_doc'));
