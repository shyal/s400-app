create table workouts (
  id uuid primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  date date not null,
  time text not null,
  workout_type text not null check (workout_type in ('A', 'B', 'custom')),
  activity text not null,
  duration_min int not null default 0,
  exercises jsonb not null default '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table exercise_progress (
  user_id uuid references auth.users(id) not null default auth.uid(),
  name text not null,
  weight_kg numeric not null,
  failure_count int not null default 0,
  primary key (user_id, name)
);

create table user_settings (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  rest_timer_seconds int default 90,
  weight_unit text default 'kg',
  program text default 'stronglifts',
  sound_enabled boolean default true,
  vibration_enabled boolean default true
);

create table workout_meta (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  last_workout_type text,
  last_workout_date date
);

-- RLS
alter table workouts enable row level security;
alter table exercise_progress enable row level security;
alter table user_settings enable row level security;
alter table workout_meta enable row level security;

create policy "Users own their workouts" on workouts for all using (auth.uid() = user_id);
create policy "Users own their progress" on exercise_progress for all using (auth.uid() = user_id);
create policy "Users own their settings" on user_settings for all using (auth.uid() = user_id);
create policy "Users own their meta" on workout_meta for all using (auth.uid() = user_id);

create index idx_workouts_user_date on workouts(user_id, date desc);
