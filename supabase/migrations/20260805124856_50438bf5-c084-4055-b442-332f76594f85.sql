alter table public.media
  add column if not exists analysis_status text not null default 'none',
  add column if not exists transcript text,
  add column if not exists analysis jsonb not null default '{}'::jsonb,
  add column if not exists analysis_error text,
  add column if not exists analyzed_at timestamptz,
  add column if not exists duration_seconds numeric;

alter table public.media
  add constraint media_analysis_status_check
  check (analysis_status in ('none','pending','ready','error'));

create policy "videos read own" on storage.objects
  for select using (bucket_id = 'project-videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos insert own" on storage.objects
  for insert with check (bucket_id = 'project-videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos update own" on storage.objects
  for update using (bucket_id = 'project-videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "videos delete own" on storage.objects
  for delete using (bucket_id = 'project-videos' and auth.uid()::text = (storage.foldername(name))[1]);