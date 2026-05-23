
-- Drop old schema
DROP TABLE IF EXISTS public.content_items CASCADE;
DROP TABLE IF EXISTS public.project_answers CASCADE;
DROP TABLE IF EXISTS public.project_photos CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.company_profile CASCADE;
DROP TYPE IF EXISTS public.content_channel CASCADE;
DROP TYPE IF EXISTS public.content_intent CASCADE;
DROP TYPE IF EXISTS public.content_status CASCADE;
DROP TYPE IF EXISTS public.photo_tag CASCADE;
DROP TYPE IF EXISTS public.project_status CASCADE;
DROP TYPE IF EXISTS public.worthiness_tag CASCADE;

-- companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT 'HVAC',
  service_area text[] NOT NULL DEFAULT '{}',
  customer_types text[] NOT NULL DEFAULT '{}',
  voice_tone_keywords text[] NOT NULL DEFAULT '{}',
  voice_examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  differentiators text[] NOT NULL DEFAULT '{}',
  standard_ctas jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels_enabled text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_owner ON public.companies(owner_user_id);

-- projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled project',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
  service_line_id text,
  service_type_detail text,
  location_city text,
  location_neighborhood text,
  location_region text,
  customer_type text,
  worthiness_tag text,
  before_state text,
  scope_performed text,
  outcome text,
  materials_used text[] NOT NULL DEFAULT '{}',
  equipment_used text[] NOT NULL DEFAULT '{}',
  unusual_details text,
  lesson_learned text,
  homeowner_misconception text,
  customer_quote text,
  interview_state jsonb NOT NULL DEFAULT '{"answered":[],"skipped":[],"completion_pct":0}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_company ON public.projects(company_id);

-- media
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('image','video')),
  tag text NOT NULL CHECK (tag IN ('before','after','process','detail','team')),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_project ON public.media(project_id);

-- content_intents
CREATE TABLE public.content_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  intent_type text NOT NULL CHECK (intent_type IN ('educational','seo','social_proof','process')),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_intents_project ON public.content_intents(project_id);

-- content_assets
CREATE TABLE public.content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  intent_id uuid NOT NULL REFERENCES public.content_intents(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('blog','facebook','instagram','case_study')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','exported')),
  headline text,
  body text NOT NULL DEFAULT '',
  cta_id text,
  hashtags text[] NOT NULL DEFAULT '{}',
  suggested_media uuid[] NOT NULL DEFAULT '{}',
  length_variant text NOT NULL DEFAULT 'medium' CHECK (length_variant IN ('short','medium','long')),
  tone_overrides text,
  flagged_unknowns jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_project ON public.content_assets(project_id);
CREATE INDEX idx_assets_intent ON public.content_assets(intent_id);

-- Security definer helper: does this user own this company?
CREATE OR REPLACE FUNCTION public.user_owns_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = _project_id AND c.owner_user_id = auth.uid()
  )
$$;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;

-- companies policies
CREATE POLICY "own company" ON public.companies FOR ALL
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- projects policies
CREATE POLICY "own projects" ON public.projects FOR ALL
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

-- media policies
CREATE POLICY "own media" ON public.media FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

-- content_intents policies
CREATE POLICY "own intents" ON public.content_intents FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

-- content_assets policies
CREATE POLICY "own assets" ON public.content_assets FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

-- updated_at triggers
CREATE TRIGGER touch_companies BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_projects BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_intents BEFORE UPDATE ON public.content_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_assets BEFORE UPDATE ON public.content_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
