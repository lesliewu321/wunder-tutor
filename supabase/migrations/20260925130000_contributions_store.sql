-- Where a contributed recording's audio lives (2026-09-25): new ones go to Cloudflare R2 (bucket
-- wunder-tutor-recordings, Asia-Pacific, 90-day expiry), beside the API that receives them; the rows written before
-- that day point at the Supabase Storage bucket `contributions`. `audio_path` is the key in whichever store.
alter table public.contributions add column if not exists store text not null default 'supabase'
  check (store in ('supabase', 'r2'));
comment on column public.contributions.store is 'Which store holds audio_path: supabase (the contributions bucket, before 2026-09-25) or r2 (wunder-tutor-recordings).';
