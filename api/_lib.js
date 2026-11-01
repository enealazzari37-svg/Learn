/* Gemeinsame Helfer für die Bezahl-Funktionen (Stripe + Supabase). Dateien mit "_" werden von Vercel nicht als Route veröffentlicht.
   Kein SDK nötig: Stripe und Supabase werden direkt über ihre REST-Schnittstellen angesprochen. */
const crypto = require("crypto");

const SB_URL = () => String(process.env.SUPABASE_URL || "https://rzbmtzxukqfdkcmfmugv.supabase.co").replace(/\/+$/, "");
const SB_ANON = () => process.env.SUPABASE_ANON_KEY || "sb_publishable_1AJLgVlp0Q-J4UdMni8ObA_uXWUD1ae";
const SB_SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const stripeKey = () => process.env.STRIPE_SECRET_KEY || "";

/* Pro-Tarife: kommen direkt aus Stripe. Gesucht werden aktive, wiederkehrende Preise des Produkts "Studix Study Pro" (oder STRIPE_PRODUCT_ID);
   monatlich = interval month, jährlich = interval year. STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY überschreiben die Suche. */
let priceCache = { at: 0, v: null };
async function plans() {
  if (priceCache.v && Date.now() - priceCache.at < 60000) return priceCache.v;
  const out = { monthly: { price: process.env.STRIPE_PRICE_MONTHLY || "", cents: +process.env.PLUS_MONTHLY_CENTS || 0, opts: {} }, yearly: { price: process.env.STRIPE_PRICE_YEARLY || "", cents: +process.env.PLUS_YEARLY_CENTS || 0, opts: {} }, currency: String(process.env.PLUS_CURRENCY || "eur").toLowerCase() };
  if (stripeKey() && (!out.monthly.price || !out.yearly.price)) {
    try {
      const j = await stripe("GET", "/prices", { active: "true", type: "recurring", limit: 50, expand: ["data.product", "data.currency_options"] }), want = process.env.STRIPE_PRODUCT_ID;
      const ok = j.data.filter(p => p.product && typeof p.product === "object" && p.product.active && (want ? p.product.id === want : /(lumi|studix)\s*(study\s*)?(pro|plus)/i.test(p.product.name || "")));
      /* Pro Intervall alle passenden Preise einsammeln: entweder je Währung ein eigener Preis oder ein Preis mit currency_options. Der neueste gewinnt je Währung. */
      for (const [k, iv] of [["monthly", "month"], ["yearly", "year"]]) {
        if (out[k].price) continue;
        const list = ok.filter(x => x.recurring?.interval === iv && x.recurring.interval_count === 1 && x.unit_amount).sort((x, y) => y.created - x.created);
        if (!list.length) continue;
        const opts = {}, ids = {};
        for (const p of list) {
          const add = (cur, cents) => { if (cents && !(cur in opts)) { opts[cur] = cents; ids[cur] = p.id; } };
          add(p.currency, p.unit_amount); Object.entries(p.currency_options || {}).forEach(([c, v]) => add(c, v.unit_amount));
        }
        out[k] = { price: list[0].id, cents: list[0].unit_amount, opts, ids, product: list[0].product.id }; out.currency = list[0].currency;
      }
      /* Preise: Monat = Stripe-Preis des Produkts (optional PRO_MONTHLY_CENTS überschreibt); Jahr = 12 Monate minus 40 % Rabatt (PRO_YEARLY_DISCOUNT), sofern in Stripe kein eigener Jahrespreis existiert */
      const mc = +process.env.PRO_MONTHLY_CENTS || 699;   // Pro: 6.99 pro Monat (PRO_MONTHLY_CENTS überschreibt; die Stripe-Preise des Produkts werden nur noch als Produkt genutzt)
      if (mc && out.monthly.product && Object.keys(out.monthly.opts || {}).length) { Object.keys(out.monthly.opts).forEach(c => { out.monthly.opts[c] = mc; }); out.monthly.cents = mc; }
      /* Jahr: Pro 40 pro Jahr (PRO_YEARLY_CENTS); nur wenn PRO_YEARLY_DISCOUNT gesetzt ist, wird er stattdessen aus 12 Monaten minus Rabatt berechnet */
      const yEnv = +process.env.PRO_YEARLY_CENTS || (process.env.PRO_YEARLY_DISCOUNT ? 0 : 4000);
      if (out.monthly.product && Object.keys(out.monthly.opts || {}).length) {
        const disc = Math.min(90, Math.max(0, +process.env.PRO_YEARLY_DISCOUNT || 0)), opts = {}; Object.entries(out.monthly.opts).forEach(([c, v]) => { opts[c] = yEnv || Math.round(v * 12 * (100 - disc) / 100); });
        const yc = Object.values(opts)[0];
        if (!out.yearly.price) out.yearly = { price: "dyn", cents: yc, opts, ids: {}, product: out.monthly.product };
        else if (out.yearly.product) { out.yearly.opts = opts; out.yearly.cents = yc; out.yearly.ids = {}; out.yearly.price = "dyn"; }
      }
    } catch (e) { if (priceCache.v) return priceCache.v; }
  }
  /* Studix Essential: günstigerer Tarif (Standard 3.99 je Währung) mit halbem KI-Budget. Braucht ein Produkt „Studix Essential“ in Stripe (oder STRIPE_ESSENTIAL_PRODUCT_ID); der Preis kommt aus ESSENTIAL_MONTHLY_CENTS */
  out.essential = { price: "", opts: {} }; out.essentialYearly = { price: "", opts: {} };
  if (stripeKey() && (out.monthly.price || out.yearly.price)) {
    try {
      let ep = process.env.STRIPE_ESSENTIAL_PRODUCT_ID || "";
      if (!ep) ep = ((await stripe("GET", "/products", { active: "true", limit: 100 })).data || []).find(p => /(lumi|studix)\s*(study\s*)?essential/i.test(p.name || ""))?.id || "";
      const ec = +process.env.ESSENTIAL_MONTHLY_CENTS || 399, cur = Object.keys(out.monthly.opts || {}); if (!cur.length) cur.push(out.currency || "chf");
      const ey = +process.env.ESSENTIAL_YEARLY_CENTS || 2000;   // Essential: 3.99 pro Monat, 20 pro Jahr
      if (ep) { out.essential = { price: "dyn", product: ep, cents: ec, opts: Object.fromEntries(cur.map(c => [c, ec])) }; out.essentialYearly = { price: "dyn", product: ep, cents: ey, opts: Object.fromEntries(cur.map(c => [c, ey])) }; }
    } catch (e) { if (priceCache.v?.essential) { out.essential = priceCache.v.essential; out.essentialYearly = priceCache.v.essentialYearly || out.essentialYearly; } }
  }
  if (out.monthly.price || out.yearly.price) priceCache = { at: Date.now(), v: out };
  return out;
}
/* Währung nach Land des Besuchs (Vercel-Header): Schweiz → CHF, Euroraum → EUR, sonst USD */
const EURO = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK AD MC SM VA ME".split(" ");
const EUROPA = EURO.concat("AL BA BG CZ DK GB HU IS MK NO PL RO RS SE UA XK TR".split(" "));
const currencyOfCountry = () => "eur";   // Preise überall in Euro (Standard für alle Länder)
const currencyFor = (req, avail, country) => { const c = String(country || req?.headers?.["x-vercel-ip-country"] || "").toUpperCase(), want = currencyOfCountry(c); return want && (!avail || avail.includes(want)) ? want : (avail?.[0] || want || "eur"); };
const CURRENCY = () => String(process.env.PLUS_CURRENCY || "eur").toLowerCase();
const billingReady = async () => { const P = await plans(); return !!(stripeKey() && (P.monthly.price || P.yearly.price)); };

const sameOrigin = req => { const o = req.headers.origin || req.headers.referer || ""; try { return new URL(o).host === req.headers.host; } catch { return false; } };
const siteUrl = req => String(process.env.SITE_URL || "").replace(/\/+$/, "") || `https://${req.headers.host}`;

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body && typeof req.body === "object") return Buffer.from(JSON.stringify(req.body));
  const chunks = []; for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); return Buffer.concat(chunks);
}
async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse((await readBody(req)).toString("utf8") || "{}"); } catch { return {}; }
}

/* Stripe erwartet Formularkodierung mit verschachtelten Schlüsseln: a[b][0][c]=… */
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === "object" ? form(x, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, x]));
    else if (typeof v === "object") form(v, key, out);
    else out.push([key, v]);
  }
  return out;
}
async function stripe(method, path, data) {
  const key = stripeKey(); if (!key) throw Object.assign(new Error("STRIPE_SECRET_KEY fehlt in Vercel."), { status: 503 });
  const body = data ? new URLSearchParams(form(data)).toString() : undefined;
  const r = await fetch("https://api.stripe.com/v1" + path + (method === "GET" && body ? "?" + body : ""), {
    method, headers: { authorization: "Bearer " + key, "stripe-version": process.env.STRIPE_API_VERSION || "2025-03-31.basil", ...(method !== "GET" ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body: method === "GET" ? undefined : body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error?.message || "Stripe-Fehler " + r.status), { status: r.status, code: j.error?.code });
  return j;
}

/* Stripe-Webhook: Signatur prüfen (HMAC-SHA256 über "t.payload"), 5 Minuten Toleranz */
function verifyStripeSignature(raw, header, secret, tolerance = 300) {
  if (!header || !secret) return false;
  const items = String(header).split(",").map(p => p.trim().split("=")), t = +(items.find(i => i[0] === "t") || [])[1], sigs = items.filter(i => i[0] === "v1").map(i => i[1]);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > tolerance) return false;
  const exp = crypto.createHmac("sha256", secret).update(`${t}.`).update(raw).digest("hex");
  return sigs.some(x => x.length === exp.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(exp)));
}

/* Eingeloggte Person aus dem Supabase-Token ermitteln */
const userCache = new Map();   // Token → { at, u }: spart bei jeder KI-/API-Anfrage den Aufruf bei Supabase (60 s)
async function userFromReq(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || ""); if (!m) return null;
  const hit = userCache.get(m[1]); if (hit && Date.now() - hit.at < 60000) return hit.u;
  const u = await userFromToken(m[1]); if (u) { if (userCache.size > 500) userCache.clear(); userCache.set(m[1], { at: Date.now(), u }); } return u;
}
async function userFromToken(token) {
  const m = [0, token];
  try {
    const r = await fetch(SB_URL() + "/auth/v1/user", { headers: { apikey: SB_ANON(), authorization: "Bearer " + m[1] } });
    if (!r.ok) return null; const u = await r.json(); return u?.id ? { id: u.id, email: u.email || "" } : null;
  } catch { return null; }
}

/* Supabase REST mit Service-Key (nur serverseitig!) */
async function sb(method, path, body, extra = {}) {
  const key = SB_SERVICE(); if (!key) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel."), { status: 503 });
  const r = await fetch(SB_URL() + "/rest/v1/" + path, { method, headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json", ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) throw Object.assign(new Error(j?.message || "Datenbankfehler " + r.status), { status: r.status });
  return j;
}

/* ===== Abo live aus Stripe lesen (keine eigene Datenbank) ===== */
const ACTIVE = ["active", "trialing", "past_due"], subCache = new Map();
const iso = t => t ? new Date(t * 1000).toISOString() : null;
function shapeSub(sub, invoices = []) {
  const it = sub.items?.data?.[0] || {}, pr = it.price || {}, pm = sub.default_payment_method && typeof sub.default_payment_method === "object" ? sub.default_payment_method : null, card = pm?.card;
  const end = sub.status === "trialing" && sub.trial_end ? sub.trial_end : (sub.current_period_end || it.current_period_end);
  return {
    tier: sub.metadata?.tier === "essential" || (pr.product && typeof pr.product === "string" && pr.product === priceCache.v?.essential?.product) ? "essential" : "pro",
    id: sub.id, customer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id, status: sub.status,
    interval: pr.recurring?.interval || null, amount: pr.unit_amount ?? null, currency: pr.currency || null, tax_behavior: pr.tax_behavior || null,
    created: iso(sub.start_date || sub.created), trial_end: iso(sub.trial_end), current_period_end: iso(end), cancel_at_period_end: !!sub.cancel_at_period_end, cancel_at: iso(sub.cancel_at), canceled_at: iso(sub.canceled_at), ended_at: iso(sub.ended_at),
    card: card ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year } : null,
    invoices: invoices.map(i => ({ number: i.number, created: iso(i.created), total: i.total, currency: i.currency, status: i.status, tax: i.tax ?? null, url: i.hosted_invoice_url || null, pdf: i.invoice_pdf || null })),
  };
}
/* Das Abo eines Kontos finden: Stripe-Suche über die Konto-ID (metadata.user_id), Fallback über die Checkout-Sitzungen (sofort aktuell) */
async function findSubscription(uid) {
  /* beides gleichzeitig: Suche (schnell, kann kurz hinterherhinken) und letzte Checkout-Sitzungen (sofort aktuell) */
  const [found, sess] = await Promise.all([
    stripe("GET", "/subscriptions/search", { query: `metadata['user_id']:'${uid}'`, limit: 20, expand: ["data.default_payment_method"] }).then(j => j.data || []).catch(() => []),
    stripe("GET", "/checkout/sessions", { limit: 30 }).then(j => (j.data || []).filter(x => x.mode === "subscription" && x.status === "complete" && x.subscription && (x.client_reference_id === uid || x.metadata?.user_id === uid)).sort((a, b) => b.created - a.created)).catch(() => []),
  ]);
  let list = found;
  if (!list.length && sess.length) list = await Promise.all(sess.slice(0, 2).map(x => stripe("GET", "/subscriptions/" + (typeof x.subscription === "string" ? x.subscription : x.subscription.id), { expand: ["default_payment_method"] }).catch(() => null))).then(r => r.filter(Boolean));
  if (!list.length) return null;
  const rank = x => (ACTIVE.includes(x.status) ? 1e12 : 0) + (x.created || 0);
  /* Abos gelöschter Kunden zählen nicht (z. B. nach dem Aufräumen von Testdaten in Stripe) – so verhält sich das Konto wieder wie neu */
  const sorted = list.sort((a, b) => rank(b) - rank(a)), checked = new Map();
  for (const s of sorted) { const cid = typeof s.customer === "string" ? s.customer : s.customer?.id; if (!checked.has(cid)) checked.set(cid, await validCustomer(cid)); if (checked.get(cid)) return s; }
  return null;
}
async function liveSubscription(uid, { fresh = false, withInvoices = false } = {}) {
  const c = subCache.get(uid);
  if (!fresh && !withInvoices && c && Date.now() - c.at < 60000) return c.v;
  const sub = await findSubscription(uid); let v = null;
  if (sub) {
    let inv = []; if (withInvoices) { try { inv = (await stripe("GET", "/invoices", { subscription: sub.id, limit: 6 })).data || []; } catch {} }
    v = shapeSub(sub, inv);
  }
  subCache.set(uid, { at: Date.now(), v }); return v;
}
/* Geschenk-Pro: Early-Backer (pro_until + Abzeichen) und Einladungs-Monate (ref_pro_until) stehen in app_metadata des Kontos (nur mit dem Service-Key schreibbar) → { until: ISO, badge } oder null */
const grantCache = new Map();
async function grantOf(uid) {
  const c = grantCache.get(uid); if (c && Date.now() - c.at < 60000) return c.v;
  let v = null; const key = SB_SERVICE();
  if (key) { try { const r = await fetch(SB_URL() + "/auth/v1/admin/users/" + uid, { headers: { apikey: key, authorization: "Bearer " + key } }); const m = r.ok ? (await r.json()).app_metadata || {} : {}; const u = [m.early_backer ? m.pro_until : null, m.ref_pro_until].filter(Boolean).sort().pop(); if (u) v = { until: u, badge: m.early_backer ? "early_backer" : null }; } catch {} }
  grantCache.set(uid, { at: Date.now(), v }); return v;
}
const grantActive = g => !!g && !!g.until && new Date(g.until).getTime() > Date.now();
const dropGrantCache = uid => grantCache.delete(uid);
/* Stufe des Kontos: "pro" | "essential" | "free" (Early-Backer-Geschenk zählt als Pro) */
const tierOf = async uid => {
  if (grantActive(await grantOf(uid))) return "pro";
  try { const s = await liveSubscription(uid); if (s && ACTIVE.includes(s.status) && (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now() - 3 * 864e5)) return s.tier === "essential" ? "essential" : "pro"; } catch {}
  return "free";
};
const isProLive = async uid => (await tierOf(uid)) !== "free";
/* ===== Freunde einladen: 1 Monat Pro geschenkt + Guthaben (supabase/referrals.sql) ===== */
const adminHeaders = key => ({ apikey: key, authorization: "Bearer " + key, "content-type": "application/json" });
/* Verlängert das geschenkte Pro um einen Monat (ab jetzt oder ab Ende des laufenden Geschenks) → neues Ende als ISO */
async function giftMonth(uid) {
  const key = SB_SERVICE(); if (!key) return null;
  const r0 = await fetch(SB_URL() + "/auth/v1/admin/users/" + uid, { headers: adminHeaders(key) }), m = r0.ok ? (await r0.json()).app_metadata || {} : {};
  const from = Math.max(Date.now(), m.ref_pro_until ? new Date(m.ref_pro_until).getTime() : 0), d = new Date(from); d.setMonth(d.getMonth() + 1);
  const r = await fetch(SB_URL() + "/auth/v1/admin/users/" + uid, { method: "PUT", headers: adminHeaders(key), body: JSON.stringify({ app_metadata: { ref_pro_until: d.toISOString() } }) });
  if (!r.ok) throw Object.assign(new Error("Konnte das Geschenk nicht speichern."), { status: 502 });
  dropGrantCache(uid); dropSubCache(uid); return d.toISOString();
}
/* Offenes Guthaben (Einladungen) beim Stripe-Kunden gutschreiben – wird bei der nächsten Rechnung verrechnet. → Cent, die gutgeschrieben wurden */
async function applyCredits(uid, customer, currency) {
  if (!customer || !currency || !stripeKey()) return 0;
  let cents = 0; try { cents = +(await sb("POST", "rpc/lumi_credit_take", { p_user: uid })) || 0; } catch { return 0; }
  if (!cents) return 0;
  try { await stripe("POST", `/customers/${customer}/balance_transactions`, { amount: -cents, currency: String(currency).toLowerCase(), description: "Studix: Einladungs-Guthaben" }); return cents; }
  catch { try { await sb("POST", "rpc/lumi_credit_giveback", { p_user: uid, p_cents: cents }); } catch {} return 0; }
}
const pendingCredit = async uid => { try { return +((await sb("POST", "rpc/lumi_ref_stats", { p_user: uid }))?.pending_cents) || 0; } catch { return 0; } };
/* Darf dieses Konto Freunde einladen? Nur mit bezahltem Essential/Pro (oder Early-Backer-Geschenk) – nicht mit einem Einladungs-Monat */
async function canInvite(uid) {
  try { const s = await liveSubscription(uid); if (s && ACTIVE.includes(s.status)) return true; } catch {}
  const g = await grantOf(uid); return !!g && g.badge === "early_backer" && grantActive(g);
}

/* Kunden-ID nur verwenden, wenn der Kunde bei Stripe (in diesem Modus) noch existiert – sonst „No such customer“ */
const validCustomer = async id => { if (!id) return null; try { const c = await stripe("GET", "/customers/" + id); return c && !c.deleted ? id : null; } catch { return null; } };
const dropSubCache = uid => subCache.delete(uid);

/* KI-Budget (Token) pro Zeitfenster: Standard eine Woche (168 Std.), das Fenster startet mit der ersten Anfrage und endet nach AI_WINDOW_HOURS.
   AI_FREE_WINDOW_TOKENS = Token pro Woche für Gratis-Konten (Standard 12500), AI_PRO_WINDOW_TOKENS = Token pro Woche für Studix Study Pro (Standard 120000); jeweils 0 = unbegrenzt.
   Gibt null zurück, wenn Service-Key oder SQL fehlen → dann bleibt die KI offen. */
const num = (v, d) => v === undefined || v === "" ? d : (+v || 0);
const FREE_TOKENS = num(process.env.AI_FREE_WINDOW_TOKENS, 12500), PRO_TOKENS = num(process.env.AI_PRO_WINDOW_TOKENS, 120000), WINDOW_H = Math.max(1, Math.round(num(process.env.AI_WINDOW_HOURS, 168)));
/* Essential: etwa halb so viel wie Pro (AI_ESSENTIAL_WINDOW_TOKENS / AI_ESSENTIAL_SESSION_TOKENS) */
const ESS_TOKENS = num(process.env.AI_ESSENTIAL_WINDOW_TOKENS, 60000);
const tierName = t => t === true || t === "pro" ? "pro" : t === "essential" ? "essential" : "free";   // true (alt) = Pro
const limitFor = t => ({ pro: PRO_TOKENS, essential: ESS_TOKENS, free: FREE_TOKENS })[tierName(t)];   // 0 = unbegrenzt
/* Zusätzlich ein kurzes Fenster (Standard 5 Std.): Gratis 2 500, Pro 24 000 Token */
const FREE_S = num(process.env.AI_FREE_SESSION_TOKENS, 2500), PRO_S = num(process.env.AI_PRO_SESSION_TOKENS, 24000), SESSION_H = Math.max(1, Math.round(num(process.env.AI_SESSION_HOURS, 5)));
const ESS_S = num(process.env.AI_ESSENTIAL_SESSION_TOKENS, 12000);
const limitS = t => ({ pro: PRO_S, essential: ESS_S, free: FREE_S })[tierName(t)];
const nf = n => Math.round(n).toLocaleString("de-CH");
const upsell = (t, big, small) => tierName(t) === "pro" ? "." : tierName(t) === "essential" ? ` – oder wechsle zu Studix Study Pro mit ${nf(big[0])} Token statt ${nf(big[1])}.` : ` – oder nutze Studix Essential (${nf(small[0])}) bzw. Study Pro (${nf(big[0])} Token) statt ${nf(small[1])}.`;
const limitMsg = (t, hours) => `Dein ${hours >= 168 ? "Wochenlimit" : "Limit"} für Studix AI ist erreicht. Es setzt sich ${hours >= 168 ? "eine Woche nach deiner ersten Anfrage" : "nach Ablauf des Zeitfensters"} zurück${upsell(t, [PRO_TOKENS, tierName(t) === "essential" ? ESS_TOKENS : FREE_TOKENS], [ESS_TOKENS, FREE_TOKENS])}`;
const limitMsgS = t => `Dein ${SESSION_H}-Stunden-Limit für Studix AI ist erreicht. Es setzt sich ${SESSION_H} Stunden nach deiner ersten Anfrage zurück${upsell(t, [PRO_S, tierName(t) === "essential" ? ESS_S : FREE_S], [ESS_S, FREE_S])}`;
const winOf = (j, h) => j && typeof j === "object" ? { used: +j.tokens || 0, reset: j.started ? new Date(new Date(j.started).getTime() + h * 36e5).toISOString() : null } : null;
const both = (w, s) => w ? { ...w, s } : null;   // Wochenfenster + optional das 5-Stunden-Fenster (s)
const aiUsed = async uid => {
  try {
    const [w, s] = await Promise.all([sb("POST", "rpc/lumi_ai_tokens", { p_user: uid, p_hours: WINDOW_H }), sb("POST", "rpc/lumi_ai_s_tokens", { p_user: uid, p_hours: SESSION_H }).catch(() => null)]);
    return both(winOf(w, WINDOW_H), winOf(s, SESSION_H));
  } catch { return null; }
};
const aiAdd = async (uid, t) => {
  const p = Math.max(0, Math.round(t));
  try {
    const [w, s] = await Promise.all([sb("POST", "rpc/lumi_ai_add", { p_user: uid, p_tokens: p, p_hours: WINDOW_H }), sb("POST", "rpc/lumi_ai_s_add", { p_user: uid, p_tokens: p, p_hours: SESSION_H }).catch(() => null)]);
    return both(winOf(w, WINDOW_H), winOf(s, SESSION_H));
  } catch { return null; }
};
/* Prüft beide Fenster: gibt null (frei) oder [429, Body] zurück */
const aiBlock = (pro, w) => {   // pro = Stufe ("pro" | "essential" | "free")
  const lim = limitFor(pro), ls = limitS(pro), s = w.s;
  const usage = { used: w.used, limit: lim || null, reset: w.reset, s: s ? { used: s.used, limit: ls || null, reset: s.reset } : null };
  if (ls && s && s.used >= ls) return [429, { error: limitMsgS(pro), limit: true, usage }];
  if (lim && w.used >= lim) return [429, { error: limitMsg(pro, WINDOW_H), limit: true, usage }];
  return null;
};
const aiUsage = (pro, w) => ({ used: w.used, limit: limitFor(pro) || null, reset: w.reset, s: w.s ? { used: w.s.used, limit: limitS(pro) || null, reset: w.s.reset } : null });

/* Gemeinsame Prüfung für KI-Aufrufe (Anmeldung, Gratis-Budget). Gibt { acct } oder { deny: [status, body] } zurück. */
async function aiGate(req) {
  const user = await userFromReq(req); if (!user) return { deny: [401, { error: "Bitte melde dich an, um Studix AI zu nutzen." }] };
  if (!FREE_TOKENS) return { acct: { id: user.id, pro: false, tier: "free", free: false } };
  const tier = await tierOf(user.id), pro = tier === "pro", w = await aiUsed(user.id);
  if (!w) return { acct: { id: user.id, pro, tier, free: false } };
  const bl = aiBlock(tier, w); if (bl) return { deny: bl };
  return { acct: { id: user.id, pro, tier, free: true } };   // free = Verbrauch wird mitgezählt (auch bei Pro, dort mit höherem Limit)
}
/* Funktionen nur für Studix Study Pro (Bild-Analyse, Sprache): für Gratis-Konten gesperrt – aber nur, wenn man Pro überhaupt kaufen kann (Stripe eingerichtet) */
async function proFeatureDeny(acct, feature) {
  if (!acct || acct.pro) return null;
  try { if (!(await billingReady())) return null; } catch { return null; }
  return [402, { error: `${feature} ist mit Studix Study Pro verfügbar.`, pro: true }];
}
module.exports = { giftMonth, applyCredits, pendingCredit, canInvite, proFeatureDeny, aiGate, validCustomer, FREE_TOKENS, PRO_TOKENS, limitFor, limitS, limitMsg, WINDOW_H, SESSION_H, FREE_S, PRO_S, aiBlock, aiUsage, aiUsed, aiAdd, liveSubscription, isProLive, tierOf, ESS_TOKENS, ESS_S, grantOf, grantActive, dropGrantCache, dropSubCache, ACTIVE, SB_URL, SB_ANON, SB_SERVICE, stripeKey, plans, currencyFor, currencyOfCountry, CURRENCY, billingReady, sameOrigin, siteUrl, readBody, readJson, stripe, verifyStripeSignature, userFromReq, sb };
