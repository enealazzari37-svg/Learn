-- Studix Workspace-Hub: Team-Kalender (Termine/Pruefungen/Meetings), gemeinsame Aufgaben, Team-Chat.
-- Zusatz zu workspace.sql (Mitgliedschaft/Rollen). Wie dort: RLS ohne Policy, Zugriff nur ueber SECURITY-DEFINER-Funktionen.
-- Im Supabase SQL-Editor ausfuehren, NACHDEM workspace.sql eingespielt wurde.
create table if not exists public.lumi_ws_events (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.lumi_workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'event' check (kind in ('event', 'meeting', 'exam')),
  starts_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists lumi_ws_events_ws on public.lumi_ws_events(ws_id, starts_at);
create table if not exists public.lumi_ws_tasks (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.lumi_workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  prio text not null default 'medium' check (prio in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee uuid references auth.users(id) on delete set null,
  due date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists lumi_ws_tasks_ws on public.lumi_ws_tasks(ws_id);
create table if not exists public.lumi_ws_msgs (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.lumi_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists lumi_ws_msgs_ws on public.lumi_ws_msgs(ws_id, created_at desc);
alter table public.lumi_ws_events enable row level security;
alter table public.lumi_ws_tasks enable row level security;
alter table public.lumi_ws_msgs enable row level security;
revoke all on public.lumi_ws_events, public.lumi_ws_tasks, public.lumi_ws_msgs from anon, authenticated;

create or replace function public.lumi_ws_hub(p_ws uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  return jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'starts_at', starts_at, 'note', note, 'created_by', created_by) order by starts_at) from lumi_ws_events where ws_id = p_ws and starts_at > now() - interval '62 days'), '[]'),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'prio', prio, 'status', status, 'assignee', assignee, 'due', due, 'created_by', created_by, 'created_at', created_at, 'done_at', done_at) order by created_at desc) from (select * from lumi_ws_tasks where ws_id = p_ws order by created_at desc limit 200) t), '[]'),
    'msgs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'body', body, 'created_at', created_at) order by created_at) from (select * from lumi_ws_msgs where ws_id = p_ws order by created_at desc limit 80) x), '[]')
  );
end $$;

create or replace function public.lumi_ws_event_save(p_ws uuid, p_id uuid, p_title text, p_kind text, p_at timestamptz, p_note text) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  if p_kind not in ('event', 'meeting', 'exam') then raise exception 'bad kind'; end if;
  if p_id is null then
    if (select count(*) from lumi_ws_events where ws_id = p_ws) >= 500 then raise exception 'event limit'; end if;
    insert into lumi_ws_events(ws_id, title, kind, starts_at, note, created_by) values (p_ws, left(trim(p_title), 120), p_kind, p_at, left(coalesce(p_note, ''), 500), auth.uid()) returning id into v;
  else
    update lumi_ws_events set title = left(trim(p_title), 120), kind = p_kind, starts_at = p_at, note = left(coalesce(p_note, ''), 500) where id = p_id and ws_id = p_ws returning id into v;
  end if;
  return v;
end $$;

create or replace function public.lumi_ws_event_delete(p_ws uuid, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  delete from lumi_ws_events where id = p_id and ws_id = p_ws and (created_by = auth.uid() or lumi_ws_role(p_ws) = 'admin');
end $$;

create or replace function public.lumi_ws_task_save(p_ws uuid, p_id uuid, p_title text, p_prio text, p_status text, p_assignee uuid, p_due date) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  if p_prio not in ('low', 'medium', 'high') or p_status not in ('todo', 'doing', 'done') then raise exception 'bad value'; end if;
  if p_assignee is not null and not exists (select 1 from lumi_ws_members where ws_id = p_ws and user_id = p_assignee) then raise exception 'bad assignee'; end if;
  if p_id is null then
    if (select count(*) from lumi_ws_tasks where ws_id = p_ws) >= 1000 then raise exception 'task limit'; end if;
    insert into lumi_ws_tasks(ws_id, title, prio, status, assignee, due, created_by, done_at) values (p_ws, left(trim(p_title), 160), p_prio, p_status, p_assignee, p_due, auth.uid(), case when p_status = 'done' then now() end) returning id into v;
  else
    update lumi_ws_tasks set title = left(trim(p_title), 160), prio = p_prio, assignee = p_assignee, due = p_due,
      done_at = case when p_status = 'done' and status <> 'done' then now() when p_status <> 'done' then null else done_at end, status = p_status
      where id = p_id and ws_id = p_ws returning id into v;
  end if;
  return v;
end $$;

create or replace function public.lumi_ws_task_delete(p_ws uuid, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  delete from lumi_ws_tasks where id = p_id and ws_id = p_ws;
end $$;

create or replace function public.lumi_ws_msg_send(p_ws uuid, p_body text) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if lumi_ws_role(p_ws) is null then raise exception 'no access'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'empty'; end if;
  insert into lumi_ws_msgs(ws_id, user_id, body) values (p_ws, auth.uid(), left(trim(p_body), 1000)) returning id into v;
  return v;
end $$;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('lumi_ws_hub', 'lumi_ws_event_save', 'lumi_ws_event_delete', 'lumi_ws_task_save', 'lumi_ws_task_delete', 'lumi_ws_msg_send') loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
