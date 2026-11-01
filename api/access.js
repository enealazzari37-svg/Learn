/* Einladungs-/Early-Access-Code: optional beim Registrieren, kein Zugangscode mehr nötig für die App. Der Code wird nach der Anmeldung über "redeem" eingelöst (Early-Backer-Pro-Geschenk, Abzeichen).
   POST { action:"status" }            mit Supabase-Token → { access:bool } (ob dieses Konto schon freigeschaltet ist)
   POST { action:"redeem", code }      mit Supabase-Token → schaltet das Konto frei. Early-Backer-/Pro-Codes geben zusätzlich Pro gratis + Abzeichen "Early Backer" (pro Konto einmal).
   Gespeichert in app_metadata des Kontos (nur mit SUPABASE_SERVICE_ROLE_KEY schreibbar). Beides in einer Datei, weil Vercel Hobby nur 12 Funktionen erlaubt.
   Codes mit begrenzten Einlösungen (z. B. 20x) liegen als SHA-256 in der Datenbank (supabase/access-codes.sql) und schalten nur den Zugang frei.
   Codes: nur SHA-256 im Quelltext. Zugangscode: Umgebungsvariable ACCESS_CODE überschreibt den eingebauten; weitere Codes siehe _codes.js. */
const crypto = require("crypto");
const L = require("./_lib");
const C = require("./_codes");
const WANT = () => process.env.ACCESS_CODE ? C.sha(C.norm(process.env.ACCESS_CODE)) : Buffer.from("9104adbd35f74485831a005a2a34a78f806fa977dcb23e545df89f6342b8a063", "hex");
const adminUrl = id => L.SB_URL() + "/auth/v1/admin/users/" + id;
const adminHeaders = key => ({ apikey: key, authorization: "Bearer " + key, "content-type": "application/json" });

/* ===== Freunde einladen (SQL: supabase/referrals.sql) ===== */
const REF_ERR = { self: "Du kannst deinen eigenen Code nicht einlösen.", already: "Du hast schon eine Einladung eingelöst.", not_new: "Einladungen gelten nur für neue Konten (bis 14 Tage nach der Registrierung).", limit: "Dieser Code wurde schon so oft eingelöst, wie er gilt.", inactive: "Dieser Einladungscode ist nicht mehr aktiv.", invalid: "Dieser Code ist ungültig." };
const noSql = e => /relation|function|lumi_ref|does not exist|schema cache|PGRST/i.test(e.message || "");
async function refInfo(req, res, user) {
  try {
    const ok = await L.canInvite(user.id);
    const st = await L.sb("POST", "rpc/lumi_ref_stats", { p_user: user.id });
    if (!ok) return res.status(200).json({ locked: true, pending_cents: st?.pending_cents || 0 });
    const code = await L.sb("POST", "rpc/lumi_ref_code", { p_user: user.id });
    return res.status(200).json({ locked: false, code, link: L.siteUrl(req) + "/?ref=" + code, invited: st?.invited || 0, max: st?.max || 12, pending_cents: st?.pending_cents || 0 });
  } catch (e) { return res.status(noSql(e) ? 503 : 502).json({ error: noSql(e) ? "Einladungen sind noch nicht eingerichtet." : e.message }); }
}
async function refRedeem(res, user, code) {
  try {
    const owner = await L.sb("POST", "rpc/lumi_ref_owner", { p_code: code });
    if (!owner) return res.status(403).json({ error: REF_ERR.invalid });
    if (!(await L.canInvite(owner))) return res.status(403).json({ error: REF_ERR.inactive });
    const r = await L.sb("POST", "rpc/lumi_ref_redeem", { p_code: code, p_invitee: user.id });
    if (r?.status !== "ok") return res.status(403).json({ error: REF_ERR[r?.status] || REF_ERR.invalid });
    /* beide: 1 Monat Pro; Einladende:r hat meist schon ein Abo → Guthaben sofort bei Stripe gutschreiben (die eingeladene Person bekommt es beim ersten Bezahlen) */
    const [mine] = await Promise.all([L.giftMonth(user.id), L.giftMonth(owner).catch(() => null)]);
    try { const s = await L.liveSubscription(owner, { fresh: true }); if (s?.customer && s.currency) await L.applyCredits(owner, s.customer, s.currency); } catch {}
    return res.status(200).json({ ok: true, referral: true, granted: true, until: mine, credit_cents: 200 });
  } catch (e) { return res.status(noSql(e) ? 503 : 502).json({ error: noSql(e) ? "Einladungen sind noch nicht eingerichtet." : e.message }); }
}

/* Ist der Code gültig? Löst nichts ein. → { valid: true|false, kind: "referral"|"gift"|"access"|"limited", months?, reason? } */
async function checkCode(res, code) {
  await new Promise(r => setTimeout(r, 400));   // bremst Durchprobieren
  if (code.length < 6) return res.status(200).json({ valid: false, reason: "short" });
  const hit = C.match(code); if (hit) return res.status(200).json({ valid: true, kind: "gift", months: hit.months });
  if (crypto.timingSafeEqual(C.sha(code), WANT())) return res.status(200).json({ valid: true, kind: "access" });
  if (!L.SB_SERVICE()) return res.status(200).json({ valid: false, reason: "invalid" });
  try {
    const hex = C.sha(code).toString("hex"), rows = await L.sb("GET", `lumi_access_codes?code_hash=eq.${hex}&select=max_uses`);
    if (rows && rows[0]) { const used = await L.sb("GET", `lumi_access_redemptions?code_hash=eq.${hex}&select=user_id`); return res.status(200).json(used.length < rows[0].max_uses ? { valid: true, kind: "limited" } : { valid: false, reason: "used_up" }); }
  } catch {}
  if (/^[A-Z0-9]{8}$/.test(code)) {
    try { const owner = await L.sb("POST", "rpc/lumi_ref_owner", { p_code: code }); if (owner) return res.status(200).json((await L.canInvite(owner)) ? { valid: true, kind: "referral" } : { valid: false, reason: "inactive" }); } catch {}
  }
  return res.status(200).json({ valid: false, reason: "invalid" });
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!L.sameOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const b = await L.readJson(req);
    if (b.action === "check") return checkCode(res, C.norm(b.code));   // Code prüfen, ohne ihn einzulösen (auch vor der Anmeldung, z. B. beim Registrieren)
    const user = await L.userFromReq(req); if (!user) return res.status(401).json({ error: "Bitte zuerst anmelden." });
    const key = L.SB_SERVICE(); if (!key) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel." });
    const meta = async () => { const r = await fetch(adminUrl(user.id), { headers: adminHeaders(key) }); return r.ok ? (await r.json()).app_metadata || {} : {}; };
    if (b.action === "status") return res.status(200).json({ access: !!(await meta()).access });
    if (b.action === "ref_info") return refInfo(req, res, user);
    const code = C.norm(b.code), hit = C.match(code), base = code.length >= 6 && crypto.timingSafeEqual(C.sha(code), WANT());
    await new Promise(r => setTimeout(r, 600));   // bremst Durchprobieren
    let limited = false;   // Code mit begrenzter Einlösung (Tabelle lumi_access_codes, siehe supabase/access-codes.sql)
    if (!hit && !base && code.length >= 6) {
      let st = "invalid"; try { st = await L.sb("POST", "rpc/lumi_code_redeem", { p_hash: C.sha(code).toString("hex"), p_user: user.id }); } catch {}
      if (st === "used_up") return res.status(403).json({ error: "Dieser Code wurde schon so oft eingelöst, wie er gilt." });
      limited = st === "ok";
    }
    if (!hit && !base && !limited && /^[A-Z0-9]{8}$/.test(code)) return refRedeem(res, user, code);   // Einladungscode eines Freundes
    if (!hit && !base && !limited) return res.status(403).json({ error: "Dieser Code ist ungültig." });
    const m = { access: true };
    if (hit && !(await L.grantOf(user.id))?.badge) { const until = new Date(); until.setMonth(until.getMonth() + hit.months); m.early_backer = true; m.pro_until = until.toISOString(); }
    /* Zugangscodes (fester oder mit begrenzter Einlösung) schalten direkt Pro für 1 Monat frei – einmal pro Konto, ohne Zahlungsdaten */
    let until = m.pro_until || null, granted = !!m.early_backer;
    if (!hit && (base || limited)) {
      const cur = await meta();
      if (!cur.code_pro) { until = await L.giftMonth(user.id); m.code_pro = true; granted = true; } else until = cur.ref_pro_until || null;
    }
    const r = await fetch(adminUrl(user.id), { method: "PUT", headers: adminHeaders(key), body: JSON.stringify({ app_metadata: m }) });
    if (!r.ok) return res.status(502).json({ error: "Konnte den Code nicht einlösen." });
    L.dropGrantCache(user.id); L.dropSubCache(user.id);
    res.status(200).json({ ok: true, gift: !!hit && !!m.early_backer, granted, until });
  } catch (e) { res.status(e.status && e.status < 600 ? e.status : 502).json({ error: e.message }); }
};
