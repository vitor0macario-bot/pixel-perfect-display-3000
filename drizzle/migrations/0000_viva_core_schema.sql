-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text not null default '',
  plan text not null default 'free',
  wake_time text,
  sleep_time text,
  notifications boolean not null default true,
  quiz_completed boolean not null default false,
  plan_created boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins read profiles" on public.profiles for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Quiz responses
create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quiz_responses to authenticated;
grant all on public.quiz_responses to service_role;
alter table public.quiz_responses enable row level security;
create policy "Users manage own quiz" on public.quiz_responses for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Routine tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  period text not null default 'manha',
  category text not null default 'habitos',
  title text not null,
  description text not null default '',
  time_of_day text,
  duration_min integer not null default 10,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "Users manage own tasks" on public.tasks for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Task completions (daily)
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, day)
);
grant select, insert, update, delete on public.task_completions to authenticated;
grant all on public.task_completions to service_role;
alter table public.task_completions enable row level security;
create policy "Users manage own completions" on public.task_completions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins read completions" on public.task_completions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Daily check-ins
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day date not null default (now() at time zone 'utc')::date,
  item text not null,
  done boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, day, item)
);
grant select, insert, update, delete on public.checkins to authenticated;
grant all on public.checkins to service_role;
alter table public.checkins enable row level security;
create policy "Users manage own checkins" on public.checkins for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins read checkins" on public.checkins for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- AI conversations
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;
create policy "Users manage own messages" on public.ai_messages for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan text not null default 'free',
  status text not null default 'active',
  provider text,
  external_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users manage own subscription" on public.subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins read subscriptions" on public.subscriptions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Weekly goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  target integer not null default 5,
  week_start date not null default date_trunc('week', (now() at time zone 'utc'))::date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "Users manage own goals" on public.goals for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();