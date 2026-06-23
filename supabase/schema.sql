create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  age integer,
  sex text,
  height_cm numeric,
  weight_kg numeric,
  goal text default 'maintain',
  training_level text default 'active',
  activity_level text default 'moderate',
  daily_calorie_target integer default 2200,
  protein_target_g integer,
  carbs_target_g integer,
  fat_target_g integer,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  title text not null,
  source text not null check (source in ('photo', 'voice', 'text')),
  image_path text,
  calories integer not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  score numeric not null default 0 check (score >= 0 and score <= 10),
  confidence numeric,
  ai_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  title text not null,
  source text not null check (source in ('voice', 'text')),
  image_path text,
  duration_minutes integer not null default 0,
  calories_burned integer not null default 0,
  effort text not null default 'moderate',
  movements text[] not null default '{}',
  score numeric not null default 0 check (score >= 0 and score <= 10),
  ai_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  title text not null,
  amount numeric not null default 0,
  currency text not null default 'INR',
  category text not null default 'miscellaneous',
  merchant text,
  source text not null default 'text' check (source in ('voice', 'text')),
  confidence numeric,
  ai_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  title text not null default 'Step entry',
  steps integer not null default 0 check (steps >= 0),
  distance_km numeric not null default 0 check (distance_km >= 0),
  calories integer not null default 0 check (calories >= 0),
  source text not null default 'manual' check (source in ('motion', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_analysis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_type text not null check (analysis_type in ('food', 'workout', 'expense')),
  provider text not null,
  input_mode text not null,
  request_summary jsonb,
  response_summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_logged_at_idx on public.food_logs (user_id, logged_at desc);
create index if not exists workout_logs_user_logged_at_idx on public.workout_logs (user_id, logged_at desc);
create index if not exists expense_logs_user_logged_at_idx on public.expense_logs (user_id, logged_at desc);
create index if not exists step_logs_user_logged_at_idx on public.step_logs (user_id, logged_at desc);
create index if not exists ai_analysis_events_user_created_at_idx on public.ai_analysis_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.food_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.expense_logs enable row level security;
alter table public.step_logs enable row level security;
alter table public.ai_analysis_events enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Profiles are editable by owner"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Food logs are readable by owner"
  on public.food_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Food logs are insertable by owner"
  on public.food_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Food logs are editable by owner"
  on public.food_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Food logs are deletable by owner"
  on public.food_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Workout logs are readable by owner"
  on public.workout_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Workout logs are insertable by owner"
  on public.workout_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Workout logs are editable by owner"
  on public.workout_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Workout logs are deletable by owner"
  on public.workout_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Expense logs are readable by owner"
  on public.expense_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Expense logs are insertable by owner"
  on public.expense_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Expense logs are editable by owner"
  on public.expense_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Expense logs are deletable by owner"
  on public.expense_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Step logs are readable by owner"
  on public.step_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Step logs are insertable by owner"
  on public.step_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Step logs are editable by owner"
  on public.step_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Step logs are deletable by owner"
  on public.step_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "AI events are readable by owner"
  on public.ai_analysis_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "AI events are insertable by owner"
  on public.ai_analysis_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', false)
on conflict (id) do nothing;

create policy "Food image owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Food image owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Food image owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Food image owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

insert into storage.buckets (id, name, public)
values ('workout-images', 'workout-images', false)
on conflict (id) do nothing;

create policy "Workout image owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workout-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Workout image owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workout-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Workout image owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workout-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'workout-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Workout image owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workout-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Avatar owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatar owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatar owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatar owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
