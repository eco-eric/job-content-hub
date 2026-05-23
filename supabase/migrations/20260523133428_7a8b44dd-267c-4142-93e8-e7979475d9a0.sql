
-- Enums
create type public.project_status as enum ('triaging','interviewing','ready','archived');
create type public.worthiness_tag as enum ('unusual_problem','dramatic_before_after','customer_stressed','taught_me_something','common_misconception');
create type public.photo_tag as enum ('before','after','process','detail');
create type public.content_intent as enum ('educational','seo','social_proof','process');
create type public.content_channel as enum ('seo_blog','facebook','instagram','case_study');
create type public.content_status as enum ('draft','approved','exported');

-- Company profile (1:1 with auth user)
create table public.company_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null default '',
  trade text not null default 'HVAC',
  service_area text not null default '',
  service_lines jsonb not null default '[]'::jsonb,        -- [{name, description, keywords:[]}]
  differentiators text[] not null default '{}',
  standard_ctas jsonb not null default '[]'::jsonb,         -- [{label, type, destination}]
  voice_sample text not null default '',                    -- the paragraph the user picked & edited
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  customer_type text,
  service_line text,
  status public.project_status not null default 'triaging',
  worthiness_tag public.worthiness_tag,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects(user_id, updated_at desc);

-- Answers (resumable interview)
create table public.project_answers (
  project_id uuid not null references public.projects(id) on delete cascade,
  question_key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (project_id, question_key)
);

-- Photos
create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  tag public.photo_tag not null,
  caption text,
  created_at timestamptz not null default now()
);
create index on public.project_photos(project_id);

-- Generated content
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  intent public.content_intent not null,
  channel public.content_channel not null,
  status public.content_status not null default 'draft',
  title text,
  body_md text not null default '',
  unresolved_confirms jsonb not null default '[]'::jsonb,  -- [{key, prompt}]
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  exported_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.content_items(user_id, updated_at desc);
create index on public.content_items(project_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_company_profile_updated before update on public.company_profile
  for each row execute function public.touch_updated_at();
create trigger t_projects_updated before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger t_answers_updated before update on public.project_answers
  for each row execute function public.touch_updated_at();
create trigger t_content_updated before update on public.content_items
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.company_profile enable row level security;
alter table public.projects enable row level security;
alter table public.project_answers enable row level security;
alter table public.project_photos enable row level security;
alter table public.content_items enable row level security;

create policy "own profile" on public.company_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own answers" on public.project_answers
  for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own photos" on public.project_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own content" on public.content_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket (private)
insert into storage.buckets (id, name, public) values ('project-photos','project-photos', false)
on conflict (id) do nothing;

create policy "photos read own" on storage.objects
  for select using (bucket_id = 'project-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "photos insert own" on storage.objects
  for insert with check (bucket_id = 'project-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "photos update own" on storage.objects
  for update using (bucket_id = 'project-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "photos delete own" on storage.objects
  for delete using (bucket_id = 'project-photos' and auth.uid()::text = (storage.foldername(name))[1]);
