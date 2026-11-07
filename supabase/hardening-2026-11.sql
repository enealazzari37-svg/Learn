-- Bereits als Migration "security_hardening_grants_and_share_limits" angewendet.
revoke execute on function public.handle_new_user_access() from public, anon, authenticated;
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- lumi_share_put: Größenlimits (Zugriff bleibt per Link); Definition siehe Migration
