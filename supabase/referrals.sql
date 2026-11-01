-- „Freunde einladen“: Einladungscodes, Einlösungen und Guthaben. Im Supabase SQL Editor ausführen (einmalig).
-- Wer Essential oder Pro hat, bekommt einen persönlichen Code. Löst ein neues Konto den Code ein, bekommen beide 1 Monat Pro (Server, app_metadata)
-- und 2 Guthaben, das beim nächsten Bezahlen in Stripe verrechnet wird (Tabelle lumi_credits, siehe api/_lib.js applyCredits).

create table if not exists public.lumi_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code    text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.lumi_referrals (
  invitee_id uuid primary key references auth.users(id) on delete cascade,   -- jedes Konto kann nur einmal eingeladen werden
  inviter_id uuid not null references auth.users(id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now()
);
create index if not exists lumi_referrals_inviter on public.lumi_referrals(inviter_id);
create table if not exists public.lumi_credits (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  cents      int  not null check (cents > 0),
  reason     text not null default 'referral',
  created_at timestamptz not null default now(),
  applied_at timestamptz                                                      -- gesetzt, sobald das Guthaben bei Stripe verbucht ist
);
create index if not exists lumi_credits_user on public.lumi_credits(user_id) where applied_at is null;
alter table public.lumi_referral_codes enable row level security;            -- keine Policies: nur der Service-Key (Server) kommt dran
alter table public.lumi_referrals enable row level security;
alter table public.lumi_credits enable row level security;

-- Persönlicher Code (8 Zeichen, ohne verwechselbare Zeichen); wird beim ersten Aufruf angelegt
create or replace function public.lumi_ref_code(p_user uuid) returns text language plpgsql security definer set search_path = public as $$
declare c text; alpha text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; i int;
begin
  select code into c from public.lumi_referral_codes where user_id = p_user; if c is not null then return c; end if;
  loop
    c := ''; for i in 1..8 loop c := c || substr(alpha, 1 + floor(random() * length(alpha))::int, 1); end loop;
    begin insert into public.lumi_referral_codes (user_id, code) values (p_user, c); return c;
    exception when unique_violation then
      select code into c from public.lumi_referral_codes where user_id = p_user; if c is not null then return c; end if;
    end;
  end loop;
end $$;

-- Wem gehört der Code? (uuid oder null)
create or replace function public.lumi_ref_owner(p_code text) returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.lumi_referral_codes where code = upper(p_code);
$$;

-- Einlösen: { status: ok | invalid | self | already | not_new | limit, inviter }. Neue Konten (max. 14 Tage alt) und höchstens 12 Einladungen pro Person.
create or replace function public.lumi_ref_redeem(p_code text, p_invitee uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare inv uuid; n int; made timestamptz;
begin
  select user_id into inv from public.lumi_referral_codes where code = upper(p_code);
  if inv is null then return jsonb_build_object('status', 'invalid'); end if;
  if inv = p_invitee then return jsonb_build_object('status', 'self'); end if;
  if exists (select 1 from public.lumi_referrals where invitee_id = p_invitee) then return jsonb_build_object('status', 'already'); end if;
  select created_at into made from auth.users where id = p_invitee;
  if made is null or made < now() - interval '14 days' then return jsonb_build_object('status', 'not_new'); end if;
  perform 1 from public.lumi_referral_codes where user_id = inv for update;   -- pro Einladende:r serialisieren
  select count(*) into n from public.lumi_referrals where inviter_id = inv;
  if n >= 12 then return jsonb_build_object('status', 'limit'); end if;
  insert into public.lumi_referrals (invitee_id, inviter_id, code) values (p_invitee, inv, upper(p_code));
  insert into public.lumi_credits (user_id, cents, reason) values (inv, 200, 'referral'), (p_invitee, 200, 'referral');
  return jsonb_build_object('status', 'ok', 'inviter', inv);
end $$;

-- Übersicht für die Einladenden: Code, Anzahl Einladungen, offenes Guthaben
create or replace function public.lumi_ref_stats(p_user uuid) returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('invited', (select count(*) from public.lumi_referrals where inviter_id = p_user), 'max', 12,
    'pending_cents', coalesce((select sum(cents) from public.lumi_credits where user_id = p_user and applied_at is null), 0));
$$;

-- Offenes Guthaben holen und als verbucht markieren (nur aufrufen, wenn es gleich bei Stripe gutgeschrieben wird)
create or replace function public.lumi_credit_take(p_user uuid) returns int language plpgsql security definer set search_path = public as $$
declare s int;
begin
  with t as (update public.lumi_credits set applied_at = now() where user_id = p_user and applied_at is null returning cents) select coalesce(sum(cents), 0) into s from t;
  return s;
end $$;
-- Falls die Stripe-Gutschrift fehlschlägt: wieder freigeben
create or replace function public.lumi_credit_giveback(p_user uuid, p_cents int) returns void language sql security definer set search_path = public as $$
  insert into public.lumi_credits (user_id, cents, reason) select p_user, p_cents, 'giveback' where p_cents > 0;
$$;

revoke all on function public.lumi_ref_code(uuid), public.lumi_ref_owner(text), public.lumi_ref_redeem(text, uuid), public.lumi_ref_stats(uuid), public.lumi_credit_take(uuid), public.lumi_credit_giveback(uuid, int) from public, anon, authenticated;
grant execute on function public.lumi_ref_code(uuid), public.lumi_ref_owner(text), public.lumi_ref_redeem(text, uuid), public.lumi_ref_stats(uuid), public.lumi_credit_take(uuid), public.lumi_credit_giveback(uuid, int) to service_role;
