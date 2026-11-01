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
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!L.sameOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const b = await L.readJson(req), user = await L.userFromReq(req); if (!user) return res.status(401).json({ error: "Bitte zuerst anmelden." });
    const key = L.SB_SERVICE(); if (!key) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel." });
    const meta = async () => { const r = await fetch(adminUrl(user.id), { headers: adminHeaders(key) }); return r.ok ? (await r.json()).app_metadata || {} : {}; };
    if (b.action === "status") return res.status(200).json({ access: !!(await meta()).access });
    const code = C.norm(b.code), hit = C.match(code), base = code.length >= 6 && crypto.timingSafeEqual(C.sha(code), WANT());
    await new Promise(r => setTimeout(r, 600));   // bremst Durchprobieren
    let limited = false;   // Code mit begrenzter Einlösung (Tabelle lumi_access_codes, siehe supabase/access-codes.sql)
    if (!hit && !base && code.length >= 6) {
      let st = "invalid"; try { st = await L.sb("POST", "rpc/lumi_code_redeem", { p_hash: C.sha(code).toString("hex"), p_user: user.id }); } catch {}
      if (st === "used_up") return res.status(403).json({ error: "Dieser Code wurde schon so oft eingelöst, wie er gilt." });
      limited = st === "ok";
    }
    if (!hit && !base && !limited) return res.status(403).json({ error: "Dieser Code ist ungültig." });
    const m = { access: true };
    if (hit && !(await L.grantOf(user.id))) { const until = new Date(); until.setMonth(until.getMonth() + hit.months); m.early_backer = true; m.pro_until = until.toISOString(); }
    const r = await fetch(adminUrl(user.id), { method: "PUT", headers: adminHeaders(key), body: JSON.stringify({ app_metadata: m }) });
    if (!r.ok) return res.status(502).json({ error: "Konnte den Code nicht einlösen." });
    L.dropGrantCache(user.id); L.dropSubCache(user.id);
    res.status(200).json({ ok: true, gift: !!hit && !!m.early_backer });
  } catch (e) { res.status(e.status && e.status < 600 ? e.status : 502).json({ error: e.message }); }
};
