/* Studix – Studix Study Pro (Abo über Stripe Managed Payments). Das Abo wird live aus Stripe gelesen (api/subscription.js) – nichts davon liegt in unserer Datenbank.
   Kauf: api/checkout.js · Zahlungsart/Rechnungen: Stripe-Kundenportal (api/portal.js) · Kündigen/Fortsetzen: api/subscription.js */
const BILL = { cfg: null, row: null, loaded: false };
const isPlus = () => !!BILL.row && ["active", "trialing", "past_due"].includes(BILL.row.status) && (!BILL.row.current_period_end || new Date(BILL.row.current_period_end).getTime() > Date.now() - 3 * 864e5);
async function authHeader() {
  try { const { data } = await CLOUD.sb.auth.getSession(); return data.session ? { authorization: "Bearer " + data.session.access_token } : {}; } catch { return {}; }
}
async function subCall(body) {
  const r = await fetch("/api/subscription", { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Fehler " + r.status); return j.sub || null;
}
/* Abo live aus Stripe laden; invoices=true holt zusätzlich die letzten Rechnungen */
async function plusLoad(invoices = false) {
  if (!CLOUD.sb || !CLOUD.user) { BILL.row = null; BILL.loaded = true; return; }
  try { BILL.row = await subCall({ action: "get", invoices }); } catch {}
  BILL.loaded = true;
}
async function billPost(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !(j.url || j.clientSecret)) throw new Error(j.error || "Fehler " + r.status); return j;
}
const billCall = async (path, body) => (await billPost(path, body)).url;
/* Stripe.js nur laden, wenn gebraucht (vorab im Leerlauf, damit der Checkout sofort da ist) */
let stripeJs = null;
const loadStripeJs = () => stripeJs || (stripeJs = new Promise((ok, no) => { if (window.Stripe) return ok(); const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.onload = () => ok(); s.onerror = () => { stripeJs = null; no(new Error("Stripe konnte nicht geladen werden.")); }; document.head.appendChild(s); }));
const embedClose = () => document.querySelectorAll(".embk").forEach(e => { try { e._ck && e._ck.destroy(); } catch {} e.remove(); });
const proEmbIdle = () => "";
const planDefault = () => BILL.row ? "monthly" : "trial";
async function embedInline(host, clientSecret, pk) {
  await loadStripeJs(); try { host._ck && host._ck.destroy(); } catch {}
  const sec = host.closest(".setsec"); sec && sec.classList.add("paying");
  host.innerHTML = `<div class="proemb-box"><div class="embk-m"><i class="spin"></i></div></div>`;
  const S = Stripe(pk), init = S.initEmbeddedCheckout || S.createEmbeddedCheckoutPage;
  host._ck = await init.call(S, { clientSecret, onComplete: () => { try { host._ck.destroy(); } catch {} host._ck = null; host.innerHTML = ""; sec && sec.classList.remove("paying"); plusAfter(); } });
  const mnt = host.querySelector(".embk-m"); mnt.innerHTML = ""; host._ck.mount(mnt);
}
/* Bezahlformular für den gewählten Plan (trial | monthly | yearly) rechts einblenden – beim Öffnen sofort, beim Planwechsel neu */
async function plusAuto(force) {
  const host = document.getElementById("pro-emb"), c = BILL.cfg;
  if (!host || host._busy || isPlus() || !(c && c.pk && c.enabled && c.monthly && CLOUD.user && BILL.loaded)) return;
  if (host._ck && !force) return;
  if (!window.__plan || (window.__plan === "trial" && BILL.row)) window.__plan = planDefault();
  const plan = window.__plan; host._busy = true; try { host._ck && host._ck.destroy(); } catch {} host._ck = null;
  const sec = host.closest(".setsec"); sec && sec.classList.add("paying");
  host.innerHTML = `<div class="proemb-box"><div class="embk-m"><i class="spin"></i></div></div>`;
  try { const j = await billPost("/api/checkout", { plan, country: proCountry(), embedded: true }); if (j.clientSecret && document.getElementById("pro-emb") === host && window.__plan === plan) await embedInline(host, j.clientSecret, j.pk || c.pk); else if (j.url) location.href = j.url; }
  catch (e) { host.innerHTML = `<div class="proemb-idle"><p>${esc(e.message || "Die Bezahlung konnte nicht geladen werden.")}</p><button class="btn" type="button" id="pe-retry">Erneut versuchen</button></div>`; host.querySelector("#pe-retry").onclick = () => plusAuto(true); }
  finally { host._busy = false; }
}
async function embedCheckout(clientSecret, pk) {
  const host = document.getElementById("pro-emb"); if (host && host.offsetParent) return embedInline(host, clientSecret, pk);
  await loadStripeJs(); embedClose();
  const wrap = document.createElement("div"); wrap.className = "embk"; wrap.innerHTML = `<div class="embk-c"><button class="embk-x" type="button" aria-label="Schließen">&times;</button><div class="embk-m"><i class="spin"></i></div></div>`;
  document.body.appendChild(wrap); document.body.classList.add("noscroll");
  const off = () => { try { wrap._ck && wrap._ck.destroy(); } catch {} wrap.remove(); document.body.classList.remove("noscroll"); };
  wrap.querySelector(".embk-x").onclick = off; wrap.addEventListener("mousedown", e => { if (e.target === wrap) off(); });
  const S = Stripe(pk), init = S.initEmbeddedCheckout || S.createEmbeddedCheckoutPage;
  wrap._ck = await init.call(S, { clientSecret, onComplete: () => { off(); plusAfter(); } });
  wrap.querySelector(".embk-m").innerHTML = ""; wrap._ck.mount(wrap.querySelector(".embk-m"));
}
if ("requestIdleCallback" in window) requestIdleCallback(() => { try { if (BILL.cfg && BILL.cfg.pk) loadStripeJs(); } catch {} }, { timeout: 6000 });
/* Sofortige Rückmeldung, solange Stripe die Seite vorbereitet */
function busy(msg) { const e = document.createElement("div"); e.className = "busy"; e.setAttribute("role", "status"); e.innerHTML = `<div class="busy-c"><i class="spin"></i><b>${msg}</b><small>Das dauert nur einen Moment.</small></div>`; document.body.appendChild(e); return () => e.remove(); }
addEventListener("pageshow", () => document.querySelectorAll(".busy").forEach(e => e.remove()));
const plusBuy = async plan => {
  window.__plan = plan; const done = busy("Sichere Bezahlung wird vorbereitet …");
  try {
    const pk = BILL.cfg && BILL.cfg.pk, j = await billPost("/api/checkout", { plan, country: proCountry(), ...(pk ? { embedded: true } : {}) });
    if (j.clientSecret) { await embedCheckout(j.clientSecret, j.pk || pk); done(); } else location.href = j.url;
  } catch (e) { done(); toast(e.message); }
};
const plusManage = async flow => { const done = busy(flow === "cancel" ? "Kündigung wird vorbereitet …" : "Stripe-Portal wird geöffnet …"); try { location.href = await billCall("/api/portal", flow ? { flow } : {}); } catch (e) { done(); toast(e.message); } };
const daysLeft = d => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 864e5));
const dLabel = n => n === 1 ? "1 Tag" : n + " Tage";
const dIn = n => n === 1 ? "1 Tag" : n + " Tagen";
const isGift = () => isPlus() && !!BILL.row.grant;   // Pro geschenkt (Einladung / Early Backer): keine Testversion, kein Abo bei Stripe
const isTrial = () => isPlus() && BILL.row.status === "trialing" && !BILL.row.grant;
const isEss = () => isPlus() && BILL.row.tier === "essential";   // Studix Essential (günstiger, halbes KI-Budget)
const isPro = () => isPlus() && !isEss();
/* Workspace und Live-Zusammenarbeit (gemeinsam Dateien bearbeiten): nur mit Essential oder Pro – solange man ein Abo überhaupt kaufen kann */
const teamPending = () => !!(BILL.cfg && BILL.cfg.enabled && CLOUD.user && !BILL.loaded);
const teamLocked = () => !!(BILL.cfg && BILL.cfg.enabled && CLOUD.user && BILL.loaded && !isPlus());
const teamHint = () => BILL.cfg && BILL.cfg.essential ? ` Studix Essential gibt es ab ${money(BILL.cfg.essential)} pro Monat.` : "";
function teamUpsell(what) {
  const { el, close } = modal(`<h3>Mit Essential oder Pro</h3><p class="note">${esc(what)} gibt es mit Studix Essential und Studix Study Pro – nicht im Gratis-Konto.${esc(teamHint())}</p><div class="row end"><button class="btn ghost" data-c>Später</button><button class="btn primary" id="tu-go">Pläne ansehen</button></div>`);
  $("[data-c]", el).onclick = close; $("#tu-go", el).onclick = () => { close(); window.__setTab = "pro"; go("settings"); };
}
const essFeatures = () => [`Studix AI mit bis zu ${aiuNum(AIQ.ess)} Token pro Woche und ${aiuNum(AIQ.essS)} pro 5 Stunden – halb so viel wie Pro`, "Unbegrenzt Dokumente & Whiteboards", "Workspace & Live-Zusammenarbeit", "Längere Antworten", "Jederzeit kündbar"];
const money = (c, cur) => `${new Intl.NumberFormat("de-CH", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(c / 100)} ${curName(String(cur || (BILL.cfg && BILL.cfg.currency) || "eur").toLowerCase())}`;
const dateDE = d => new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
const dateShort = d => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const SUB_STATUS = { trialing: "Testversion", active: "Aktiv", past_due: "Zahlung überfällig", canceled: "Beendet", unpaid: "Unbezahlt", incomplete: "Unvollständig", incomplete_expired: "Abgelaufen", paused: "Pausiert" };
const INV_STATUS = { paid: "Bezahlt", open: "Offen", draft: "Entwurf", void: "Storniert", uncollectible: "Uneinbringlich" };
const cardName = b => ({ visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", jcb: "JCB", diners: "Diners Club", unionpay: "UnionPay" })[b] || (b ? b[0].toUpperCase() + b.slice(1) : "Karte");

const proFeatures = () => [`Studix AI mit bis zu ${aiuNum(AIQ.pro)} Token pro Woche und ${aiuNum(AIQ.proS)} pro 5 Stunden (Gratis: bis zu ${aiuNum(AIQ.free)} / ${aiuNum(AIQ.freeS)}) – ohne Garantie, kann eingeschränkt werden`, "Unbegrenzt Dokumente & Whiteboards", "Workspace & Live-Zusammenarbeit", "Bild-Analyse & Sprachgespräch", "Längere Antworten", "Alle kommenden Pro-Funktionen", "Du unterstützt die Weiterentwicklung von Studix"];
/* Was ist in Gratis und in Pro enthalten – Tabelle (Einstellungen → Pro und Startseite) */
function planCompareHtml() {
  const ck = `<span class="pc-y">${ic("check")}</span>`, no = `<span class="pc-n">–</span>`;
  const ess = !!(BILL.cfg && BILL.cfg.essential), X = (a, e, b) => ess ? [a, e, b] : [a, b];
  const rows = [["Dokumente <small>Notizen, Dateien &amp; PDFs</small>", ...X(`bis zu <b>${FREE_LIMITS.docs}</b>`, "Unbegrenzt", "Unbegrenzt")], ["Whiteboards &amp; Zeichnungen", ...X(`bis zu <b>${FREE_LIMITS.boards}</b>`, "Unbegrenzt", "Unbegrenzt")], ["Karteikarten &amp; Quiz", ...X(ck, ck, ck)], ["Planer, Noten, Prüfungen &amp; Fokus-Timer", ...X(ck, ck, ck)], ["Sync auf allen Geräten", ...X(ck, ck, ck)], ["Workspace &amp; Live-Zusammenarbeit <small>Dateien gemeinsam in Echtzeit bearbeiten</small>", ...X(no, ck, ck)],
    ["KI-Modelle <small>Google Gemini nur mit Essential und Pro</small>", ...X("Gemma 4 &amp; Groq", "Gemini, Gemma 4 &amp; Groq", "Gemini, Gemma 4 &amp; Groq")],
    [`Studix AI Limit <small>alle Modelle zählen 1× – Wochenlimit und 5-Stunden-Limit, jeweils ab deiner ersten Anfrage</small>`, ...X(`<b>${aiuNum(AIQ.free)}</b> / Woche<br><b>${aiuNum(AIQ.freeS)}</b> / 5 Std.`, `<b>${aiuNum(AIQ.ess)}</b> / Woche<br><b>${aiuNum(AIQ.essS)}</b> / 5 Std.`, `<b>${aiuNum(AIQ.pro)}</b> / Woche<br><b>${aiuNum(AIQ.proS)}</b> / 5 Std.`)], ["Bild-Analyse &amp; Sprachgespräch", ...X(no, no, ck)], ["Längere Antworten", ...X(no, ck, ck)], ["Neue Pro-Funktionen zuerst", ...X(no, no, ck)]];
  return `<div class="pcm"><h3>Was ist inbegriffen</h3><div class="pc-t" role="table"><div class="pc-h${ess ? " c3" : ""}" role="row"><span></span><b>Gratis</b>${ess ? "<b>Essential</b>" : ""}<b>Pro</b></div>${rows.map(([t, ...v]) => `<div class="pc-r${ess ? " c3" : ""}" role="row"><span>${t}</span>${v.map(x => `<span>${x}</span>`).join("")}</div>`).join("")}</div><p class="note">Studix-Token entsprechen etwa einem Zehntel der echten Modell-Token. Alle Modelle zählen 1×.</p></div>`;
}
/* Popup, wenn ein Gratis-Limit erreicht ist oder eine Pro-Funktion genutzt wird */
function proUpsell(msg, title) {
  const { el, close } = modal(`<h3>${esc(title || "Mehr mit Studix Study Pro")}</h3><p class="note">${esc(msg || "Diese Funktion gibt es mit Studix Study Pro.")}</p><ul class="prolist">${proFeatures().map(x => `<li>${ic("check")}${x}</li>`).join("")}</ul><div class="row end"><button class="btn ghost" data-c>Später</button><button class="btn primary" id="up-go">Pläne ansehen</button></div>`);
  $("[data-c]", el).onclick = close; $("#up-go", el).onclick = () => { close(); window.__setTab = "pro"; go("settings"); };
}
/* Upgrade-Hinweis genau dann, wenn der Mehrwert spürbar ist (50. Karteikarte, Lernserie, Teilen, KI-Limit) – nie beim Login.
   Nur für Gratis-Konten, jede Art höchstens einmal und insgesamt höchstens einmal pro Tag. */
function proNudge(kind, title, msg) {
  if (!freePlan() || !CLOUD.user || document.querySelector("#modal-root .mask")) return false;
  let st = {}; try { st = JSON.parse(localStorage.getItem("studix-nudge") || "{}"); } catch {}
  if (st[kind] || (st._last && Date.now() - st._last < 864e5)) return false;
  st[kind] = st._last = Date.now(); try { localStorage.setItem("studix-nudge", JSON.stringify(st)); } catch {}
  proUpsell(msg, title); return true;
}
/* Popup „Pro aktiviert“ – nach dem Einlösen eines Codes (direkt nach der Anmeldung oder in den Einstellungen) */
function proGiftPopup(until, extra) {
  const mo = Math.max(1, Math.round((new Date(until).getTime() - Date.now()) / 2592e6)), el = document.createElement("div"); el.className = "wsp";
  el.innerHTML = `<div class="wsp-in"><svg class="wsp-ck" viewBox="0 0 96 96" width="96" height="96"><circle class="wsp-c" cx="48" cy="48" r="42" pathLength="100"/><path class="wsp-v" d="M30 50l13 13 24-28" pathLength="100"/></svg>
    <h1>Pro aktiviert 🎉</h1><p class="wsp-s">Studix Study Pro ist für ${mo === 1 ? "1 Monat" : mo + " Monate"} freigeschaltet – bis ${dateDE(until)}.</p>
    <div class="wsp-card"><div class="wsp-row"><span class="obx-ico">${ic("spark")}</span><div><b>Alles von Pro, sofort</b><small>Studix AI mit ${aiuNum(AIQ.pro)} Token pro Woche, längere Antworten, Bild-Analyse und Sprache.</small></div></div>
      <div class="wsp-row"><span class="obx-ico">${ic("check")}</span><div><b>Nichts zu erledigen</b><small>Keine Zahlungsdaten, kein Abo – danach gilt automatisch wieder dein Plan.${extra ? " " + esc(extra) : ""}</small></div></div></div>
    <div class="wsp-act"><button class="obx-go" id="wsp-go" type="button">Los geht’s</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("on"));
  const close = () => { el.classList.remove("on"); setTimeout(() => el.remove(), 350); }; $("#wsp-go", el).onclick = close; try { LPL.sync(); } catch {}
}
/* Lernserie erreicht (3 / 7 / 14 Tage): beim Öffnen des Dashboards */
function streakNudge() {
  if (EMBED_MODE) return; const n = typeof streak === "function" ? streak() : 0, t = n >= 14 ? 14 : n >= 7 ? 7 : n >= 3 ? 3 : 0; if (!t) return;
  proNudge("streak" + t, `${n} Tage in Folge – starke Serie! 🔥`, "Du bleibst dran. Mit Essential oder Pro bekommst du mehr Studix AI, um dein Lernen noch schneller zu machen.");
}
/* ===== Freunde einladen: beide bekommen 1 Monat Pro + 2 Guthaben (nur mit Essential/Pro; im Gratis-Konto ausgegraut) ===== */
async function inviteModal() {
  if (!CLOUD.user) { toast("Melde dich an, um Freunde einzuladen."); return cloudLoginModal(); }
  const perk = `<div class="inv-perk"><span>${ic("gift")}</span><div><b>Ihr bekommt beide:</b><ul><li>1 Monat Studix Study Pro geschenkt</li><li>${money(200)} Guthaben auf die nächste Zahlung</li></ul></div></div>`;
  const { el, close } = modal(`<h3>Freunde einladen</h3><div id="inv-body"><p class="note">Lädt …</p></div>`, "invmodal"), box = $("#inv-body", el);
  const locked = (pend) => {
    box.innerHTML = `<div class="inv-lock">${perk}<div class="inv-off" aria-disabled="true"><div class="co-link"><input class="field" readonly value="studix.space/?ref=XXXXXXXX" disabled><button class="btn" disabled>Kopieren</button></div></div>
      <p class="inv-note"><span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg></span>Freunde einladen geht nur mit Essential und Pro.</p>${pend ? `<p class="note">Dein Guthaben von ${money(pend)} wird bei deiner ersten Zahlung verrechnet.</p>` : ""}
      <div class="row end"><button class="btn ghost" data-c>Schließen</button><button class="btn primary" id="inv-up">Pläne ansehen</button></div></div>`;
    $("[data-c]", box).onclick = close; $("#inv-up", box).onclick = () => { close(); window.__setTab = "pro"; go("settings"); };
  };
  if (freePlan()) { locked(0); }
  try {
    const r = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ action: "ref_info" }) }), j = await r.json().catch(() => ({}));
    if (!r.ok) { if (!freePlan()) box.innerHTML = `<p class="note">${esc(j.error || "Einladungen sind gerade nicht verfügbar.")}</p><div class="row end"><button class="btn primary" data-c>Schließen</button></div>`, $("[data-c]", box).onclick = close; return; }
    if (j.locked) return locked(j.pending_cents);
    const left = Math.max(0, (j.max || 12) - (j.invited || 0));
    box.innerHTML = `${perk}<p class="note">Teile deinen Link oder Code. Sobald sich dein Freund neu registriert und den Code einlöst, bekommt ihr beide das Geschenk.</p>
      <div class="co-link"><input class="field" readonly value="${esc(j.link)}" id="inv-l"><button class="btn primary" id="inv-cp">Kopieren</button></div>
      <div class="inv-code"><small>Dein Code</small><b>${esc(j.code)}</b></div>${navigator.share ? `<button class="btn ghost small" id="inv-sh" type="button">Teilen …</button>` : ""}
      <p class="inv-stat"><b>${j.invited || 0}</b> eingeladen · noch ${left} möglich${j.pending_cents ? ` · Guthaben ${money(j.pending_cents)} wird bei der nächsten Zahlung verrechnet` : ""}</p>
      <div class="row end"><button class="btn ghost" data-c>Schließen</button></div>`;
    $("[data-c]", box).onclick = close;
    $("#inv-cp", box).onclick = async () => { try { await navigator.clipboard.writeText(j.link); toast("Link kopiert"); } catch { $("#inv-l", box).select(); } };
    $("#inv-sh", box)?.addEventListener("click", () => navigator.share({ title: "Studix", text: "Komm zu Studix – wir bekommen beide 1 Monat Pro geschenkt:", url: j.link }).catch(() => {}));
  } catch { if (!freePlan()) { box.innerHTML = `<p class="note">Keine Verbindung. Versuche es noch einmal.</p>`; } }
}
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-invite]")) { e.preventDefault(); inviteModal(); } });
/* Link „Was ist inbegriffen?“ unter der Beschreibung – öffnet die Tabelle als Popup */
const planCompareLink = () => `<button type="button" class="pc-link" data-pc>Was ist inbegriffen?</button>`;
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-pc]")) { e.preventDefault(); modal(planCompareHtml(), "pcmodal"); } });

function plusPanelHtml() { return plusPanelCore().replace(/<\/div>\s*$/, planCompareLink() + "</div>"); }
function plusPanelCore() {
  const c = BILL.cfg, r = BILL.row, list = `<ul class="prolist">${proFeatures().map(x => `<li>${ic("check")}${x}</li>`).join("")}</ul>`;
  const eligible = !r, trialD = (c && c.trial) || 14;
  const E = isEss(), head = state => `<div class="prohead"><div><span class="probadge">${E ? "Essential" : "Pro"}</span><h2>${E ? "Studix Essential" : "Studix Study Pro"}</h2></div>${state ? `<span class="prostate">${state}</span>` : ""}</div>`;
  if (CLOUD.user && c && c.enabled && !BILL.loaded) return `<div class="panel propanel">${head("")}<p class="note">Abo wird bei Stripe geladen …</p></div>`;
  const gift = isGift(), cancelling = isPlus() && r.cancel_at_period_end && !gift;
  if (c && c.pk && c.monthly && c.enabled && cloudOn() && CLOUD.user && (!isPlus() || cancelling || gift)) {   // Plan-Auswahl links, Bezahlformular rechts
    const m = c.monthly, y = c.yearly, off = cancelling, def = r ? "monthly" : "trial", cur = off ? "" : (window.__plan && !(window.__plan === "trial" && r) ? window.__plan : def), save = y ? Math.max(0, m * 12 - y) : 0, pct = y && m ? Math.round(save / (m * 12) * 100) : 0, esave = c.essential && c.essentialYearly ? Math.max(0, c.essential * 12 - c.essentialYearly) : 0, epct = esave ? Math.round(esave / (c.essential * 12) * 100) : 0;
    const P = [!r ? ["trial", `${trialD} Tage gratis testen`, `Danach ${money(m)} pro Monat. Nur einmal pro Konto möglich – jederzeit vorher kündbar.`, "Gratis"] : null,
      c.essential ? ["essential", "Essential monatlich", `Halb so viel Studix AI wie Pro (${aiuNum(AIQ.ess)} Token pro Woche), ohne Bild-Analyse und Sprache.`, `${money(c.essential)} / Monat`] : null,
      c.essential && c.essentialYearly ? ["essentialYearly", "Essential jährlich", esave > 0 ? `Du sparst ${epct} % – nur ${money(Math.round(c.essentialYearly / 12))} pro Monat.` : "Ein Jahr Studix Essential.", `${money(c.essentialYearly)} / Jahr`] : null,
      ["monthly", c.essential ? "Pro monatlich" : "Monatsabo", "Jederzeit kündbar, monatlich flexibel.", `${money(m)} / Monat`], y ? ["yearly", c.essential ? "Pro jährlich" : "Jahresabo", save ? `Du sparst ${pct} % (${money(save)}) – nur ${money(Math.round(y / 12))} pro Monat.` : "Ein Jahr Studix Study Pro.", `${money(y)} / Jahr`] : null].filter(Boolean);
    const days = cancelling ? daysLeft(r.current_period_end) : 0;
    const top = gift ? `<div class="pp-run"><b>Pro geschenkt bis ${dateDE(r.current_period_end)}</b><small>Danach gilt wieder dein Gratis-Plan. Du kannst jetzt schon einen Plan wählen – er startet sofort.</small></div>` : cancelling ? `<div class="pp-run"><b>Aktives Abo läuft in ${dIn(days)} ab</b><small>Zugang bis ${dateDE(r.current_period_end)}. Danach kannst du hier ein neues Abo abschliessen.</small><button class="btn" type="button" id="pl-resume">Abo wieder aktivieren</button></div>`
      : r ? (r.grant ? `<p class="pp-ended">Dein geschenktes Pro ist abgelaufen.</p>` : `<p class="pp-ended">Dein letztes Abo ist beendet${r.ended_at || r.current_period_end ? ` (${dateDE(r.ended_at || r.current_period_end)})` : ""}. Schön, dass du zurück bist.</p>`) : "";
    return `<div class="propanel proside${off ? " is-off" : ""}"><span class="probadge">Pro</span><h2>Studix Study Pro</h2>${top}<p class="ps-lead">${off ? "Neue Pläne sind erst nach Ablauf wählbar." : c.essential ? "Essential für den Einstieg, Pro mit allem. Mehrwertsteuer ist immer inklusive." : "Wähle deinen Plan. Mehrwertsteuer ist immer inklusive."}</p>
      <div class="pp-plans" role="radiogroup">${P.map(([k, t, d, pr], i) => `<button type="button" class="pp-card${k === cur ? " on" : ""}" data-plan="${k}" role="radio" aria-checked="${k === cur}" ${off ? "disabled" : ""} style="--d:${i}">${k === "trial" ? `<span class="pp-gift">${ic("gift")}</span>` : `<i class="pp-dot"></i>`}<span class="pp-t"><b>${t}</b><small>${d}</small></span><span class="pp-pr">${pr}</span>${k === "trial" ? `<em>Neu</em>` : k === "yearly" && pct ? `<em>−${pct} %</em>` : k === "essentialYearly" && epct ? `<em>−${epct} %</em>` : ""}</button>`).join("")}</div>
      <p class="ps-fine">Bezahlung sicher über Stripe (Karte, Apple Pay, Google Pay, Link u. a.). Verkäufer und Rechnungssteller ist Stripe („Sold through Link“). Mit dem Kauf gelten <a href="legal.html#agb" target="_blank" rel="noopener">AGB</a> und <a href="legal.html#widerruf" target="_blank" rel="noopener">Widerrufsbelehrung</a>.</p></div>`;
  }
  if (isPlus()) {
    const trialing = r.status === "trialing", left = daysLeft(r.current_period_end), cancelled = r.cancel_at_period_end;
    const trialLen = (c && c.trial) || 14, pct = Math.min(100, Math.max(4, Math.round((1 - left / trialLen) * 100)));
    const unit = r.interval === "year" ? "Jahr" : "Monat", price = r.amount != null ? `${money(r.amount, r.currency)} / ${unit} · ${r.tax_behavior === "exclusive" ? "zzgl." : "inkl."} MwSt.` : "–";
    const title = cancelled ? `Gekündigt – Zugang bis ${dateDE(r.current_period_end)}` : trialing ? `Testversion endet in ${dIn(left)}` : r.status === "past_due" ? "Zahlung überfällig" : "Aktives Abo";
    const sub = cancelled ? "Danach wird nichts mehr berechnet. Du kannst das Abo bis dahin jederzeit wieder aktivieren." : trialing ? `Die Testversion endet am ${dateDE(r.current_period_end)}. Danach ${price}, wenn du nicht vorher kündigst.` : r.status === "past_due" ? "Die letzte Zahlung ist fehlgeschlagen – bitte aktualisiere deine Zahlungsart." : `Nächste Zahlung am ${dateDE(r.current_period_end)}: ${price}.`;
    const kv = [["Status", `${SUB_STATUS[r.status] || r.status}${cancelled ? " (gekündigt)" : ""}`], ["Plan", `${E ? "Studix Essential" : "Studix Study Pro"} · ${r.interval === "year" ? "jährlich" : "monatlich"}`], ["Preis", price], ["Abo gestartet", r.created ? dateDE(r.created) : "–"],
      trialing ? ["Testversion endet", dateDE(r.trial_end || r.current_period_end)] : null, [cancelled ? "Zugang bis" : "Nächste Zahlung", r.current_period_end ? dateDE(r.current_period_end) : "–"],
      ["Zahlungsmittel", r.card ? `${cardName(r.card.brand)} •••• ${r.card.last4} · gültig bis ${String(r.card.exp_month).padStart(2, "0")}/${String(r.card.exp_year).slice(-2)}` : "Bei Stripe hinterlegt"], ["Abo-ID", `<code>${esc(r.id)}</code>`]].filter(Boolean);
    const inv = Array.isArray(r.invoices) ? (r.invoices.length ? `<div class="invl"><h3>Rechnungen</h3>${r.invoices.map(i => `<div class="inv"><span>${i.created ? dateShort(i.created) : ""}</span><span>${esc(i.number || "Rechnung")}</span><b>${money(i.total, i.currency)}</b><em class="${i.status === "paid" ? "ok" : ""}">${INV_STATUS[i.status] || i.status}</em>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">Ansehen</a>` : "<span></span>"}</div>`).join("")}</div>` : `<div class="invl"><h3>Rechnungen</h3><p class="note">Noch keine Rechnung – die erste kommt nach der Testversion.</p></div>`) : "";
    return `<div class="panel propanel">${head(cancelled ? "Gekündigt" : trialing ? "Testversion" : r.status === "past_due" ? "Überfällig" : "Aktiv")}<div class="subbox"><b>${title}</b><p>${sub}</p>${trialing && !cancelled ? `<div class="trialbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="trialnums"><span>Tag ${Math.min(trialLen, trialLen - left + 1)} von ${trialLen}</span><span>noch ${dLabel(left)}</span></div>` : ""}</div>
      <div class="kvlist">${kv.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>${inv}
      <div class="row subacts">${cancelled ? `<button class="btn primary" id="pl-resume">Abo wieder aktivieren</button>` : `<button class="btn" id="pl-cancel">${trialing ? "Testversion beenden / Abo kündigen" : "Abo kündigen"}</button>`}${cancelled || trialing ? "" : E ? `<button class="btn primary" id="pl-up">Auf Pro wechseln</button>` : c && (r.interval === "year" ? c.essentialYearly : c.essential) ? `<button class="btn" id="pl-down">Zu Essential wechseln</button>` : ""}<button class="btn" id="pl-pay">Zahlungsart ändern</button><button class="btn" id="pl-manage">Alle Rechnungen &amp; Belege</button><button class="btn ghost" id="pl-reload" type="button">${ic("rot")}Aktualisieren</button></div>
      <p class="note">${cancelled ? "" : trialing ? "Kündigst du während der Testversion, wird dir nichts berechnet und du behältst Pro bis zum Ende der Testversion." : (E ? "Du behältst Essential bis zum Ende des bezahlten Zeitraums." : "Du behältst Pro bis zum Ende des bezahlten Zeitraums.")} Alle Angaben kommen live von Stripe.</p></div>`;
  }
  if (!c || !c.enabled || !cloudOn()) return `<div class="panel propanel">${head("Bald verfügbar")}<p class="note">Mit Studix Study Pro bekommst du ${aiuNum(AIQ.pro)} statt ${aiuNum(AIQ.free)} Token pro Woche für Studix AI.</p>${list}</div>`;
  if (!CLOUD.user) return `<div class="panel propanel">${head("")}<p class="note">Melde dich unter „Konto“ an, um Studix Study Pro zu abonnieren.</p>${list}</div>`;
  const y = c.yearly, m = c.monthly, save = y && m ? Math.round((1 - y / (m * 12)) * 100) : 0;
  return `<div class="panel propanel">${head(r ? SUB_STATUS[r.status] || "" : "")}<p class="note">${eligible ? `<b>${trialD} Tage kostenlos testen</b>, danach ${m ? money(m) + " / Monat" : y ? money(y) + " / Jahr" : "der normale Preis"}. ` : ""}Preis inkl. Mehrwertsteuer – in jeder Währung. Jederzeit kündbar.</p>${list}
    <div class="row" style="gap:10px;flex-wrap:wrap">${m ? `<button class="btn primary" id="pl-m">${eligible ? `${ic("gift")}${trialD} Tage gratis testen` : `${money(m)} / Monat`}</button>` : ""}${y ? `<button class="btn ${m ? "" : "primary"}" id="pl-y">${eligible ? `${money(y)} / Jahr · ${trialD} Tage gratis` : `${money(y)} / Jahr${save > 0 ? ` · ${save} % sparen` : ""}`}</button>` : ""}</div>
    <p class="note" style="margin-top:10px">Bezahlung sicher über Stripe (Karte, Apple Pay, Google Pay, Link u. a.). Verkäufer und Rechnungssteller ist Stripe („Sold through Link“). Mit dem Kauf gelten <a href="legal.html#agb" target="_blank" rel="noopener">AGB</a> und <a href="legal.html#widerruf" target="_blank" rel="noopener">Widerrufsbelehrung</a>.</p></div>`;
}
/* Pro-Bereich neu laden (inkl. Rechnungen) und an Ort und Stelle ersetzen */
async function plusRefresh(m, quiet) {
  await plusLoad(true);
  const pp = $(".propanel", m); if (pp) { pp.replaceWith(Object.assign(document.createElement("div"), { innerHTML: plusPanelHtml() }).firstElementChild); plusBindPanel(m); }
  const bn = $(".probanner", m); if (bn) { bn.replaceWith(Object.assign(document.createElement("div"), { innerHTML: proBannerHtml() }).firstElementChild); $("#pro-go", m)?.addEventListener("click", () => window.__showSetTab && window.__showSetTab("pro")); }
  try { refreshNav(); } catch {} if (!quiet) toast("Aktualisiert");
}
function plusBindPanel(m) {
  $$(".pp-card", m).forEach(btn => btn.onclick = () => { if (btn.classList.contains("on") && $("#pro-emb")?._ck) return; window.__plan = btn.dataset.plan; $$(".pp-card", m).forEach(x => { x.classList.toggle("on", x === btn); x.setAttribute("aria-checked", x === btn); }); plusAuto(true); });
  const on = (id, f) => { const b = $(id, m); if (b) b.onclick = f; };
  const act = async (action, ok) => { try { BILL.row = await subCall({ action, invoices: true }); toast(ok); await plusRefresh(m, true); } catch (e) { toast(e.message); } };
  on("#pl-m", () => plusBuy(planDefault())); on("#pl-y", () => plusBuy("yearly")); on("#pl-pay", () => plusManage("payment")); on("#pl-manage", () => plusManage());
  on("#pl-reload", () => plusRefresh(m));
  on("#pl-cancel", async () => { const r = BILL.row, tr = r && r.status === "trialing"; if (await confirmBox(tr ? `Testversion beenden und Abo kündigen? Du behältst Pro bis ${dateDE(r.current_period_end)}, danach wird nichts berechnet.` : `Abo kündigen? Du behältst Pro bis ${dateDE(r.current_period_end)}.`, "Abo kündigen")) act("cancel", "Abo gekündigt – Zugang bleibt bis zum Ende erhalten."); });
  on("#pl-resume", () => act("resume", "Abo wieder aktiviert."));
  on("#pl-up", async () => { if (await confirmBox(`Auf Studix Study Pro wechseln (${BILL.row.interval === "year" ? money(BILL.cfg.yearly) + " / Jahr" : money(BILL.cfg.monthly) + " / Monat"})? Der Aufpreis wird anteilig für den Rest des Zeitraums abgerechnet.`, "Wechseln")) try { BILL.row = await subCall({ action: "switch", plan: BILL.row.interval === "year" ? "yearly" : "monthly", invoices: true }); toast("Du hast jetzt Studix Study Pro."); await plusRefresh(m, true); } catch (e) { toast(e.message); } });
  on("#pl-down", async () => { if (await confirmBox(`Zu Studix Essential (${BILL.row.interval === "year" ? money(BILL.cfg.essentialYearly) + " / Jahr" : money(BILL.cfg.essential) + " / Monat"}) wechseln? Du hast dann halb so viel Studix AI, keine Bild-Analyse und kein Sprachgespräch. Die Differenz wird dir gutgeschrieben.`, "Wechseln")) try { BILL.row = await subCall({ action: "switch", plan: BILL.row.interval === "year" ? "essentialYearly" : "essential", invoices: true }); toast("Du hast jetzt Studix Essential."); await plusRefresh(m, true); } catch (e) { toast(e.message); } });
}
/* Rückkehr aus dem Checkout: ?plus=success – Stripe ist die Quelle, die Suche kann kurz hinterherhinken */
async function plusReturn() {
  const q = new URLSearchParams(location.search), st = q.get("plus"); if (!st) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (st === "cancel") return toast("Bezahlung abgebrochen – es wurde nichts berechnet.");
  return plusAfter();
}
async function plusAfter() {
  window.__setTab = "pro"; toast("Danke! Deine Testversion wird geladen …");
  for (let i = 0; i < 8 && !isPlus(); i++) { await plusLoad(true); if (!isPlus()) await new Promise(r => setTimeout(r, 2000)); }
  if (isPlus()) confetti();
  toast(isPlus() ? (isEss() ? "Studix Essential ist aktiv – viel Erfolg beim Lernen!" : "Studix Study Pro ist aktiv – viel Erfolg beim Lernen!") : "Zahlung eingegangen – das Abo erscheint gleich. Lade die Seite in ein paar Sekunden neu."); try { refreshNav(); } catch {} if (curView === "settings") { window.__setTab = "pro"; renderView(); }
}

/* Pro-Block ganz oben in den Einstellungen */
function proBannerHtml() {
  const c = BILL.cfg, r = BILL.row, can = c && c.enabled && cloudOn();
  const td = (c && c.trial) || 14, price = can ? (c.monthly && c.essential ? `Essential ${money(c.essential)} · Pro ${money(c.monthly)} / Monat` : c.monthly ? `${money(c.monthly)} / Monat` : c.yearly ? `${money(c.yearly)} / Jahr` : "") : "";
  const t = (CLOUD.user && can && !BILL.loaded) ? "Abo wird geladen …" : isPlus()
    ? (isGift() ? `Pro geschenkt – gültig bis ${dateDE(r.current_period_end)}` : r.cancel_at_period_end ? `Gekündigt – Zugang bis ${dateDE(r.current_period_end)}`
      : r.status === "trialing" ? `Testversion endet in ${dIn(daysLeft(r.current_period_end))} (am ${dateDE(r.current_period_end)})`
      : r.current_period_end ? `Aktiv · verlängert sich am ${dateDE(r.current_period_end)}` : "Aktiv")
    : can && price ? `${r ? "" : td + " Tage gratis, danach "}${price}` : `Studix AI mit ${aiuNum(AIQ.pro)} Token pro Woche – bald verfügbar`;
  return `<div class="probanner"><div class="pb-l"><span class="probadge">${isEss() ? "Essential" : isPlus() ? "Pro" : "Gratis"}</span><div><b>${isEss() ? "Studix Essential" : isPlus() ? "Studix Study Pro" : "Gratis-Plan"}</b><small>${t}</small></div></div><button class="btn primary" id="pro-go">${isGift() ? "Pläne ansehen" : isPlus() ? (isTrial() ? "Testversion verwalten" : "Abo verwalten") : can ? (r ? "Studix Study Pro holen" : `${td} Tage gratis testen`) : "Mehr erfahren"}</button></div>`;
}

/* Chip in der Seitenleiste: Testphase bzw. Kündigung immer sichtbar */
function proChipHtml() {   // nur Text, kein Knopf; wird bei eingeklappter Seitenleiste ausgeblendet
  if (!isPlus()) return ""; const r = BILL.row, n = daysLeft(r.current_period_end);
  const txt = r.cancel_at_period_end && !r.grant ? `Gekündigt – Zugang bis ${new Date(r.current_period_end).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}` : "";
  return txt ? `<div class="prostatus nl hide-mob" id="prochip">${txt}</div>` : "";
}

/* ---------- Land / Region → Währung (CHF, EUR, USD) ---------- */
const COUNTRIES = [["CH", "Schweiz"], ["DE", "Deutschland"], ["AT", "Österreich"], ["LI", "Liechtenstein"], ["IT", "Italien"], ["FR", "Frankreich"], ["ES", "Spanien"], ["PT", "Portugal"], ["NL", "Niederlande"], ["BE", "Belgien"], ["LU", "Luxemburg"], ["IE", "Irland"], ["GB", "Vereinigtes Königreich"], ["DK", "Dänemark"], ["SE", "Schweden"], ["NO", "Norwegen"], ["FI", "Finnland"], ["PL", "Polen"], ["CZ", "Tschechien"], ["HU", "Ungarn"], ["GR", "Griechenland"], ["HR", "Kroatien"], ["SI", "Slowenien"], ["SK", "Slowakei"], ["RO", "Rumänien"], ["BG", "Bulgarien"], ["EE", "Estland"], ["LV", "Lettland"], ["LT", "Litauen"], ["MT", "Malta"], ["CY", "Zypern"], ["IS", "Island"], ["TR", "Türkei"], ["US", "USA"], ["CA", "Kanada"], ["AU", "Australien"], ["NZ", "Neuseeland"], ["BR", "Brasilien"], ["IN", "Indien"], ["JP", "Japan"], ["XX", "Anderes Land"]];
const EURO_LAND = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK AD MC SM VA ME AL BA BG CZ DK GB HU IS MK NO PL RO RS SE UA XK TR".split(" ");
const curOf = cc => !cc || cc === "XX" ? "" : cc === "CH" || cc === "LI" ? "chf" : EURO_LAND.includes(cc) ? "eur" : "usd";
const curName = cur => ({ chf: "CHF", eur: "€", usd: "USD" })[cur] || String(cur || "").toUpperCase();
function guessCountry() {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone || "", tz = { "Europe/Zurich": "CH", "Europe/Vaduz": "LI", "Europe/Berlin": "DE", "Europe/Vienna": "AT", "Europe/Rome": "IT", "Europe/Paris": "FR", "Europe/Madrid": "ES", "Europe/Lisbon": "PT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU", "Europe/Dublin": "IE", "Europe/London": "GB" }[z]; if (tz) return tz;
    const r = ((navigator.language || "").split("-")[1] || "").toUpperCase(); if (COUNTRIES.some(c => c[0] === r)) return r; } catch {}
  return "";
}
/* Preise und Währung der gewählten Region in die Konfiguration übernehmen */
function proApply() {
  const c = BILL.cfg; if (!c || !c.opts) return;
  const cc = (typeof D !== "undefined" && D.profile && D.profile.country) || c.country || guessCountry(), want = curOf(cc) || c.currency;
  const av = Object.keys(c.opts.monthly || c.opts.yearly || {}), cur = av.includes(want) ? want : av.includes("eur") ? "eur" : av[0] || c.currency;
  ["monthly", "yearly", "essential", "essentialYearly"].forEach(k => { if (c.opts[k] && c.opts[k][cur] != null) c[k] = c.opts[k][cur]; }); c.currency = cur;
}
const proCountry = () => (D.profile.country || (BILL.cfg && BILL.cfg.country) || guessCountry() || "");
const countryOptions = sel => COUNTRIES.map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${n}</option>`).join("");
const priceHint = cc => { const c = BILL.cfg; if (!c || !c.enabled || !c.opts) return ""; const cur = curOf(cc) || c.currency, o = c.opts.monthly || c.opts.yearly || {}, v = o[cur] ?? o.eur; return v == null ? "" : `${new Intl.NumberFormat("de-CH", { minimumFractionDigits: v % 100 ? 2 : 0 }).format(v / 100)} ${curName(o[cur] != null ? cur : "eur")} ${c.opts.monthly ? "/ Monat" : "/ Jahr"}`; };

/* Pro-Banner beim Namen: Abzeichen + Status-Pille */
const proBadgeHtml = () => (BILL.row?.badge === "early_backer" ? `<span class="probadge early nm" title="Exklusives Abzeichen für die ersten Unterstützer">Early Backer</span>` : "") + (isPlus() ? `<span class="probadge nm">${isEss() ? "Essential" : "Pro"}</span>` : "");
function proPillHtml() {   // „Abo: …“ unter dem Namen im Profil – immer sichtbar
  const r = BILL.row;
  if (!isPlus()) return `<span class="trialpill free">Abo: Gratis</span>`;
  const n = daysLeft(r.current_period_end), name = isEss() ? "Essential" : "Pro", gu = r.gift_until && !r.grant ? ` · Pro geschenkt bis ${dateDE(r.gift_until)}` : "";
  if (r.grant) return `<span class="trialpill">Abo: Pro geschenkt · bis ${dateDE(r.current_period_end)}</span>`;
  return `<span class="trialpill ${r.cancel_at_period_end ? "end" : ""}">${r.cancel_at_period_end ? `Abo: ${name} · gekündigt, Zugang bis ${dateDE(r.current_period_end)}` : r.status === "trialing" ? `Abo: ${name} · Testversion endet in ${dIn(n)}` : `Abo: ${name} · aktiv, verlängert am ${dateDE(r.current_period_end)}`}${gu}</span>`;
}


/* ===== KI-Verbrauch (Token pro Woche, Gratis 12 500 / Pro 120 000) – Ring wie der Kontext-Ring bei Claude ===== */
const AIU = { on: false, pro: false, tier: "free", unl: false, used: 0, limit: 0, reset: "", hours: 168, s: null, sHours: 5 };
const aiuNum = n => Math.round(n).toLocaleString("de-CH").replace(/’/g, "’");
async function aiuLoad() {
  if (typeof CLOUD === "undefined" || !CLOUD.user) return;
  try { const r = await fetch("/api/usage", { method: "POST", headers: await authHeader() }); if (!r.ok) return; const j = await r.json(); Object.assign(AIU, { on: !!j.enabled, pro: !!j.pro, tier: j.tier || (j.pro ? "pro" : "free"), unl: !!j.enabled && j.limit == null, used: j.used || 0, limit: j.limit || 0, reset: j.reset || "", hours: j.hours || 168, s: j.s || null, sHours: j.sHours || 5 }); const tk = { pro: ["pro", "proS"], essential: ["ess", "essS"] }[j.tier] || ["free", "freeS"]; if (j.s && j.s.limit) AIQ[tk[1]] = j.s.limit; if (j.limit) AIQ[tk[0]] = j.limit; aiuPaint(); } catch {}
}
function aiuSet(u) { if (!u) return; if (u.limit == null) AIU.unl = true; else { AIU.unl = false; AIU.used = u.used; AIU.limit = u.limit; if (u.reset !== undefined) AIU.reset = u.reset || ""; AIU.s = u.s || AIU.s; } AIU.on = true; aiuPaint(); }
const aiuPctW = () => AIU.unl || !AIU.limit ? 0 : Math.min(1, AIU.used / AIU.limit);
const aiuPctS = () => AIU.unl || !AIU.s || !AIU.s.limit ? 0 : Math.min(1, AIU.s.used / AIU.s.limit);
const aiuPct = () => Math.max(aiuPctW(), aiuPctS());   // Ring zeigt das knappere Fenster
/* Zeile für ein Fenster (5 Std. / Woche) mit Balken und Reset-Zeit */
function aiuRow(name, used, limit, reset, hours) {
  const pct = limit ? Math.round(Math.min(1, used / limit) * 100) : 0, rs = reset ? new Date(reset) : null, left = rs ? Math.max(0, rs - Date.now()) : 0;
  return `<div class="aiu-row"><p class="aiu-big">${name} <span>${aiuNum(used)} / ${aiuNum(limit)} Token</span></p><div class="aiu-bar"><i style="width:${pct}%"></i></div><p class="aiu-s">${pct >= 100 ? "Limit erreicht." : `${100 - pct} % übrig.`} ${rs ? `Setzt sich in ${aiuLeft(left)} zurück.` : `Startet mit deiner nächsten Anfrage (${hours >= 168 ? "eine Woche" : hours + " Std."}).`}</p></div>`;
}
const aiuRows = () => (AIU.s && AIU.s.limit ? aiuRow(`${AIU.sHours} Stunden`, AIU.s.used, AIU.s.limit, AIU.s.reset, AIU.sHours) : "") + aiuRow(AIU.hours >= 168 ? "Woche" : AIU.hours + " Std.", AIU.used, AIU.limit, AIU.reset, AIU.hours);
function aiuRingHtml() {
  if (!AIU.on) return "";
  return `<button type="button" class="aiu" aria-label="Studix-AI-Verbrauch"><svg viewBox="0 0 24 24" width="24" height="24"><circle class="aiu-t" cx="12" cy="12" r="9"/><circle class="aiu-p" cx="12" cy="12" r="9" pathLength="100" stroke-dasharray="${(aiuPct() * 100).toFixed(1)} 100"/></svg></button>`;
}
function aiuPaint() {
  document.querySelectorAll(".aiu").forEach(b => { const p = b.querySelector(".aiu-p"); if (p) p.setAttribute("stroke-dasharray", (aiuPct() * 100).toFixed(1) + " 100"); b.classList.toggle("hot", aiuPct() >= .85); });
}
function aiuMount(host, after) {
  if (!host) return; host.querySelectorAll(".aiu").forEach(x => x.remove());
  const t = document.createElement("div"); t.innerHTML = aiuRingHtml(); const b = t.firstChild; if (!b) return;
  after ? after.before(b) : host.appendChild(b); b.onclick = e => { e.stopPropagation(); aiuPop(b); };
}
const aiuLeft = ms => { const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.ceil(ms % 36e5 / 6e4); return d ? `${d} Tg. ${h} Std.` : h ? `${h} Std. ${m} Min.` : `${m} Min.`; };
const aiuAt = rs => rs ? (AIU.hours >= 24 ? rs.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" }) + ", " : "") + rs.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) + " Uhr" : "";
const aiuWin = () => AIU.hours >= 168 ? "Wochenlimit" : AIU.hours + " Std.-Fenster";
const aiuUp = () => BILL.cfg && BILL.cfg.enabled && !isPro() ? (BILL.cfg.essential && !isEss() ? `Mehr mit Essential oder Pro (bis ${aiuNum(AIQ.pro)} pro Woche)` : `Mehr mit Pro (${aiuNum(AIQ.pro)} pro Woche)`) : "";
function aiuPop(btn) {
  const old = document.querySelector(".aiu-pop"); if (old) { old.remove(); return; }
  const pct = Math.round(aiuPct() * 100), rs = AIU.reset ? new Date(AIU.reset) : null, left = rs ? Math.max(0, rs - Date.now()) : 0;
  const pop = document.createElement("div"); pop.className = "aiu-pop";
  pop.innerHTML = AIU.unl
    ? `<b>Studix AI</b><p class="aiu-big">Unbegrenzt</p><p class="aiu-s">Für dein Konto gibt es kein Limit.</p>`
    : `<b>Studix AI${AIU.pro ? " · Pro" : AIU.tier === "essential" ? " · Essential" : ""}</b>${aiuRows()}
       <p class="aiu-s">Gemini gibt es mit Essential und Pro, Gemma 4 und Groq auch gratis. Alle Modelle zählen 1×.</p>
       ${aiuUp() ? `<button class="btn small aiu-up" type="button">${aiuUp()}</button>` : ""}`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth; pop.style.top = r.bottom + 8 + "px"; pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)) + "px";
  const up = pop.querySelector(".aiu-up"); if (up) up.onclick = () => { pop.remove(); plusBuy(planDefault()); };
  setTimeout(() => document.addEventListener("click", function h(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("click", h); } }), 0);
}


/* Konfetti über der ganzen App (nach erfolgreichem Abschluss) – schwarz/weiss/grau passend zum Design */
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none"; document.body.appendChild(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr, ctx = cv.getContext("2d"), cols = ["#111111", "#111111", "#444444", "#777777", "#a8a8ae", "#d4d4d9"], P = [];
  const burst = (x, ang, n) => { for (let i = 0; i < n; i++) { const a = ang + (Math.random() - .5) * 1.1, v = (9 + Math.random() * 13) * dpr; P.push({ x, y: H + 10 * dpr, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: (6 + Math.random() * 7) * dpr, h: (4 + Math.random() * 5) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: cols[i % cols.length], round: Math.random() < .25, t: 0 }); } };
  burst(W * .12, -Math.PI / 2 - .55, 90); burst(W * .88, -Math.PI / 2 + .55, 90); setTimeout(() => { burst(W * .3, -Math.PI / 2 - .2, 60); burst(W * .7, -Math.PI / 2 + .2, 60); }, 350);
  for (let i = 0; i < 70; i++) P.push({ x: Math.random() * W, y: -Math.random() * H * .5, vx: (Math.random() - .5) * 2 * dpr, vy: (2 + Math.random() * 3) * dpr, w: (5 + Math.random() * 6) * dpr, h: (4 + Math.random() * 4) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .25, c: cols[i % cols.length], round: Math.random() < .2, t: 0 });
  const g = .42 * dpr, t0 = performance.now();
  (function frame(now) {
    ctx.clearRect(0, 0, W, H); const el = now - t0;
    for (const p of P) { p.vy += g; p.vx *= .992; p.vy *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.t++; const fade = Math.max(0, Math.min(1, (4200 - el) / 900)); if (fade <= 0) continue;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.t * .12 + p.r)) * .8 + .2); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.4, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
    if (el < 4300) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}


/* AI-Verbrauch als Block auf der Profilseite (gleiche Daten wie der Ring) */
function aiuBlockInner() {
  if (!AIU.on) return "";
  const pct = Math.round(aiuPct() * 100), rs = AIU.reset ? new Date(AIU.reset) : null, left = rs ? Math.max(0, rs - Date.now()) : 0;
  const big = AIU.unl ? `<b>Unbegrenzt</b><small>Für dein Konto gibt es kein Limit.</small>` : `<div class="aiu-rows">${aiuRows()}</div>`;
  return `<span class="aiu-lg">${aiuRingHtml().replace('class="aiu"', 'class="aiu" tabindex="-1"')}</span><div class="aiuse-t"><span class="aiuse-h">Studix AI Nutzung${AIU.pro ? " · Pro" : ""}</span>${big}</div>${!AIU.unl && aiuUp() ? `<button class="btn" id="aiuse-up" type="button">${aiuUp()}</button>` : ""}`;
}
function aiuBlockFill(m) {
  const w = $("#aiuse", m); if (!w) return; const h = aiuBlockInner(); w.innerHTML = h; w.hidden = !h;
  const up = $("#aiuse-up", w); if (up) up.onclick = () => window.__showSetTab && window.__showSetTab("pro");
}
