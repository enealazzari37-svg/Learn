/* Studix – Konto & Cloud-Sync (Supabase). Aktiv, sobald supabaseUrl/supabaseKey in config.js stehen. */
const CLOUD = { sb: null, user: null, dirty: new Set(), timer: null, busy: false };
const cloudOn = () => !!(window.LUMI_CONFIG.supabaseUrl && window.LUMI_CONFIG.supabaseKey);
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const syncable = k => !/^blob:/.test(k);
function loadSupabaseLib() {
  return new Promise((res, rej) => {
    if (window.supabase) return res();
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
    s.onload = res; s.onerror = () => rej(new Error("offline")); document.head.appendChild(s);
  });
}
/* jede lokale Änderung wird (entprellt) in die Cloud geschrieben */
(function hookKV() {
  const set = KV.set.bind(KV), del = KV.del.bind(KV);
  KV.set = async (k, v) => { await set(k, v); cloudMark(k); };
  KV.del = async k => { await del(k); cloudMark(k, true); };
  KV._raw = { set, del };
})();
function cloudMark(k, removed) {
  if (!CLOUD.user || !syncable(k)) return;
  CLOUD.dirty.add(JSON.stringify([k, !!removed])); clearTimeout(CLOUD.timer); CLOUD.timer = setTimeout(cloudPush, 1800);
}
/* Das Konto wurde in Supabase gelöscht, der Browser hat aber noch die alte Anmeldung: Speichern scheitert dann mit einem Fremdschlüssel-Fehler (lumi_kv_user_id_fkey) – wir melden ab, statt es endlos zu versuchen */
const cloudAccountMissing = e => !!e && (e.code === "23503" || /lumi_kv_user_id_fkey|foreign key|sub claim|user.*does not exist/i.test(e.message || e.details || ""));
async function cloudAccountGone() {
  CLOUD.dirty.clear(); clearTimeout(CLOUD.timer);
  try { await CLOUD.sb.auth.signOut({ scope: "local" }); } catch {}
  CLOUD.user = null; try { BILL.row = null; } catch {} LS.set("lumi-sync", "0");
  toast("Dein Konto existiert nicht mehr – bitte melde dich neu an oder registriere dich.");
}
async function cloudPush() {
  if (!CLOUD.user || CLOUD.busy || !CLOUD.dirty.size) return; CLOUD.busy = true;
  const items = [...CLOUD.dirty].map(x => JSON.parse(x)); CLOUD.dirty.clear();
  try {
    const up = [], rm = [];
    for (const [k, removed] of items) { if (removed) rm.push(k); else { const v = await KV.get(k); if (v !== undefined) up.push({ user_id: CLOUD.user.id, k, v, updated_at: new Date().toISOString() }); } }
    if (up.length) { const { error } = await CLOUD.sb.from("lumi_kv").upsert(up, { onConflict: "user_id,k" }); if (error) throw error; }
    if (rm.length) { const { error } = await CLOUD.sb.from("lumi_kv").delete().eq("user_id", CLOUD.user.id).in("k", rm); if (error) throw error; }
    LS.set("lumi-sync", String(Date.now())); cloudStatus("ok");
  } catch (e) { if (cloudAccountMissing(e)) { CLOUD.busy = false; return cloudAccountGone(); } items.forEach(i => CLOUD.dirty.add(JSON.stringify(i))); cloudStatus("err"); console.error("Cloud-Sync:", e); setTimeout(cloudPush, 15000); }
  CLOUD.busy = false;
}
/* Die Datenbank gilt immer: Cloud-Daten ersetzen lokale Daten, kein Rückfrage-Popup.
   Nur wenn die Cloud noch leer ist (neues Konto), wird der vorhandene lokale Stand hochgeladen.
   Gehören die lokalen Daten zu einem anderen Konto (lumi-owner), werden sie verworfen und das Konto startet frisch. */
async function cloudPull() {
  const { data, error } = await CLOUD.sb.from("lumi_kv").select("k,v,updated_at"); if (error) throw error;
  const owner = LS.get("lumi-owner"), foreign = !!owner && owner !== CLOUD.user.id;
  if (foreign) { for (const k of await cloudLocalKeys()) await KV._raw.del(k); LS.set("lumi-sync", "0"); }
  LS.set("lumi-owner", CLOUD.user.id);
  const last = foreign ? 0 : +LS.get("lumi-sync") || 0;
  if (!data.length) {
    if (foreign) return true;                                   // neues Konto auf fremdem Gerätestand: leer starten
    /* brandneues Konto (gerade erst angelegt): Onboarding immer zeigen, auch wenn lokal noch ein früherer Stand liegt */
    if (Date.now() - new Date(CLOUD.user.created_at || 0).getTime() < 20 * 60 * 1000 && D.profile.onboarded) { D.profile.onboarded = false; await KV.set("data", D); }
    for (const k of await cloudLocalKeys()) CLOUD.dirty.add(JSON.stringify([k, false])); await cloudPush(); return false;
  }
  const fresh = data.filter(r => !last || new Date(r.updated_at).getTime() > last); if (!fresh.length) return foreign;
  for (const r of fresh) await KV._raw.set(r.k, r.v);
  LS.set("lumi-sync", String(Date.now())); return true;
}
async function cloudLocalKeys() {
  const db = await KV.open(); if (!db) return ["data"];
  return new Promise(res => { const r = db.transaction("kv").objectStore("kv").getAllKeys(); r.onsuccess = () => res(r.result.filter(syncable)); r.onerror = () => res(["data"]); });
}
/* Links aus den Mails zeigen auf studix.space (statt auf supabase.co): …/?token_hash=…&type=signup|recovery|magiclink|email_change
   Das ist besser für den Spam-Filter (Absender- und Link-Domain passen zusammen) und Mail-Scanner verbrauchen den Link nicht. */
async function cloudTokenHash() {
  const q = new URLSearchParams(location.search), th = q.get("token_hash"), type = q.get("type");
  if (!th || !type || !CLOUD.sb) return;
  history.replaceState(null, "", location.pathname + "#/app");
  const { error } = await CLOUD.sb.auth.verifyOtp({ token_hash: th, type });
  if (error) return setTimeout(() => toast("Der Link ist abgelaufen oder wurde schon benutzt – bitte fordere eine neue E-Mail an."), 800);
  if (type === "recovery") setTimeout(recoveryModal, 900); else if (type === "email_change") setTimeout(() => toast("Deine neue E-Mail-Adresse ist bestätigt."), 900);
}
async function cloudInit() {
  if (!cloudOn() || EMBED_MODE) return;   // die Vorschau auf der Startseite hat nie ein Konto
  try { await loadSupabaseLib(); } catch { return; }
  const oauthBack = /access_token=|[?&#]code=/.test(location.hash + location.search) && !/token_hash=/.test(location.search);   // Rueckkehr von Google/Apple
  CLOUD.sb = window.supabase.createClient(window.LUMI_CONFIG.supabaseUrl, window.LUMI_CONFIG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  try { await cloudTokenHash(); } catch {}
  const { data } = await CLOUD.sb.auth.getSession(); CLOUD.user = data.session?.user || null;
  if (oauthBack && CLOUD.user) history.replaceState(null, "", location.pathname + "#/app");
  if (CLOUD.user) { try { const { error } = await CLOUD.sb.auth.getUser(); if (error && ([401, 403, 404].includes(error.status) || /sub claim|does not exist|not found/i.test(error.message || ""))) { await CLOUD.sb.auth.signOut({ scope: "local" }); CLOUD.user = null; } } catch {} }   // gelöschtes Konto: alte Anmeldung verwerfen
  if (CLOUD.user && (cloudUnconfirmed(CLOUD.user) || !(await mfaGate()))) { try { await CLOUD.sb.auth.signOut(); } catch {} CLOUD.user = null; }
  if (CLOUD.user) { try { if (await cloudPull()) { await loadData(); try { migrateFolders(); } catch {} } } catch { cloudStatus("err"); } }
  await accessCheck();
  CLOUD.sb.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY") setTimeout(recoveryModal, 600); const was = CLOUD.user; CLOUD.user = s?.user || null; if (ev === "SIGNED_IN" && !was && CLOUD.user) cloudAfterLogin(); if (ev === "SIGNED_OUT") { BILL.row = null; LS.set("lumi-sync", "0"); $("#app").innerHTML = ""; route(); } });
  addEventListener("online", cloudPush);
}
async function cloudAfterLogin() {
  if (cloudUnconfirmed(CLOUD.user)) { try { await CLOUD.sb.auth.signOut(); } catch {} return; }
  if (!(await mfaGate())) { try { await CLOUD.sb.auth.signOut(); } catch {} return; }
  plusLoad(false).then(() => { try { refreshNav(); if (curView === "settings") renderView(); } catch {} }).catch(() => {});
  try { if (await cloudPull()) { await loadData(); try { migrateFolders(); } catch {} } } catch { cloudStatus("err"); }
  await accessCheck();
  $("#app").innerHTML = ""; route();
}
function cloudStatus() { const e = document.getElementById("cl-st"); if (e) e.textContent = CLOUD.user ? (CLOUD.dirty.size ? "Wird synchronisiert …" : "Synchronisiert") : ""; }
/* E-Mail-Adresse noch nicht bestätigt? (nur für Konten mit E-Mail + Passwort; Google/Apple sind immer bestätigt) */
const cloudUnconfirmed = u => !!(u && !u.email_confirmed_at && !u.confirmed_at && (u.app_metadata?.provider || "email") === "email");
/* Schritt „Bestätige deine E-Mail“ in der Login-Seite (oder im Konto-Fenster): Hinweis, erneut senden, automatisch weiter sobald bestätigt */
async function cloudVerifyView(el, email, pw, done) {
  const page = $(".authmid", el), host = page || el, x = page ? null : $(".x", el);
  if (page) { host.classList.add("av-leave"); await new Promise(r => setTimeout(r, 230)); host.classList.remove("av-leave"); }   // Formular blendet aus, nur links – das Foto rechts bleibt stehen
  host.innerHTML = `<div class="authverify">
    <h1>Bestätige deine E-Mail</h1><p class="authsub">Wir haben dir einen 6-stelligen Code geschickt an</p><span class="av-mail">${esc(email)}</span>
    <div class="otp-row" id="av-c" role="group" aria-label="Bestätigungscode">${[0, 1, 2, 3, 4, 5].map(i => `<input class="otp" inputmode="numeric" pattern="[0-9]*" maxlength="1" ${i ? "" : 'autocomplete="one-time-code"'} aria-label="Ziffer ${i + 1}">`).join("")}</div>
    <p class="note authmsg" id="av-m" aria-live="polite"></p>
    <button class="btn authgo" id="av-ok" type="button">Bestätigen</button>
    <p class="av-hint">Du kannst auch auf den Link in der E-Mail klicken – auch im Spam-Ordner nachsehen.</p>
    <div class="av-row"><button class="link" id="av-re" type="button">E-Mail erneut senden</button><button class="link" id="av-back" type="button">Andere E-Mail verwenden</button></div>
    <button class="link av-link" id="av-lk" type="button">Ich habe stattdessen auf den Link geklickt</button></div>`;
  if (x) host.prepend(x);
  const m = $("#av-m", host), say = (t, k = "") => { m.className = "note authmsg" + (k ? " " + k : ""); m.textContent = t; };
  let stop = false, left = 0, timer = null;
  const alive = () => !stop && document.body.contains(host);
  const tick = () => { const b = $("#av-re", host); if (!b) return; if (left > 0) { b.disabled = true; b.textContent = `Erneut senden in ${left} s`; left--; timer = setTimeout(tick, 1000); } else { b.disabled = false; b.textContent = "E-Mail erneut senden"; } };
  const check = async quiet => {
    const { data, error } = await CLOUD.sb.auth.signInWithPassword({ email, password: pw });
    if (!error && data?.user && !cloudUnconfirmed(data.user)) { stop = true; say("Bestätigt – du wirst angemeldet …", "ok"); done(); return true; }
    if (!error) { try { await CLOUD.sb.auth.signOut(); } catch {} }
    if (!quiet) say("Noch nicht bestätigt – bitte klicke zuerst auf den Link in der E-Mail.", "err"); return false;
  };
  const boxes = $$(".otp", host), getCode = () => boxes.map(i => i.value).join("");
  const verifyCode = async () => {
    const t = getCode(); if (t.length < 6) return say("Gib alle 6 Ziffern des Codes aus der E-Mail ein.", "err");
    say("Code wird geprüft …", "load"); $("#av-ok", host).classList.add("is-loading"); boxes.forEach(i => i.disabled = true);
    const { error } = await CLOUD.sb.auth.verifyOtp({ email, token: t, type: "signup" });
    $("#av-ok", host).classList.remove("is-loading"); boxes.forEach(i => i.disabled = false);
    if (error) { say(/expired|invalid|otp/i.test(error.message) ? "Der Code ist falsch oder abgelaufen. Prüfe die Ziffern oder fordere unten eine neue E-Mail an." : error.message, "err"); $("#av-c", host).classList.add("shake"); setTimeout(() => $("#av-c", host).classList.remove("shake"), 450); boxes.forEach(i => i.value = ""); boxes[0].focus(); return; }
    stop = true; say("Bestätigt – du wirst angemeldet …", "ok"); done();
  };
  const fill = (from, digits) => { digits.split("").slice(0, 6 - from).forEach((d, k) => { boxes[from + k].value = d; }); const nx = Math.min(5, from + digits.length); boxes[nx].focus(); boxes.forEach(i => i.classList.toggle("on", !!i.value)); if (getCode().length === 6) verifyCode(); };
  boxes.forEach((b, i) => {
    b.addEventListener("input", () => { const d = b.value.replace(/\D/g, ""); b.value = ""; if (d) fill(i, d); });
    b.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !b.value && i) { boxes[i - 1].value = ""; boxes[i - 1].classList.remove("on"); boxes[i - 1].focus(); e.preventDefault(); }
      else if (e.key === "Backspace") b.classList.remove("on");
      else if (e.key === "ArrowLeft" && i) boxes[i - 1].focus(); else if (e.key === "ArrowRight" && i < 5) boxes[i + 1].focus();
      else if (e.key === "Enter") { e.preventDefault(); verifyCode(); }
    });
    b.addEventListener("paste", e => { e.preventDefault(); const d = (e.clipboardData?.getData("text") || "").replace(/\D/g, ""); if (d) fill(0, d); });
    b.addEventListener("focus", () => b.select());
  });
  $("#av-ok", host).onclick = verifyCode;
  $("#av-lk", host).onclick = () => { say("Wird geprüft …", "load"); check(false); };
  setTimeout(() => boxes[0].focus(), 60);
  $("#av-re", host).onclick = async () => { const { error } = await CLOUD.sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: location.origin + "/" } }); if (error) return say(/rate|seconds|too many/i.test(error.message) ? "Bitte warte einen Moment, bevor du die E-Mail erneut sendest." : error.message, "err"); say("Die E-Mail ist unterwegs.", "ok"); left = 60; clearTimeout(timer); tick(); };
  $("#av-back", host).onclick = () => { stop = true; clearTimeout(timer); if (page) authScreen("up"); else { $("#modal-root").innerHTML = ""; cloudLoginModal(); } };
  left = 45; tick();
  /* alle paar Sekunden still prüfen, ob der Link inzwischen geklickt wurde (z. B. auf dem Handy) */
  let n = 0; const poll = async () => { if (!alive() || ++n > 120) return; if (await check(true)) return; setTimeout(poll, 5000); }; setTimeout(poll, 5000);
}
function cloudAuthHtml() {
  return `<label class="lbl">E-Mail</label><input class="field" id="cl-e" type="email" autocomplete="email"><label class="lbl">Passwort</label><input class="field" id="cl-p" type="password" autocomplete="current-password" minlength="6">
    <p class="note" id="cl-m" style="min-height:20px"></p><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="cl-in">Anmelden</button><button class="btn" id="cl-up">Registrieren</button><button class="link" id="cl-fp" type="button">Passwort vergessen</button></div>`;
}
function cloudAuthBind(el, done) {
  const msg = t => { const m = $("#cl-m", el); if (!m) return; const k = !t ? "" : /…$/.test(t) ? "load" : /Fast geschafft|erfolgreich|geschickt/i.test(t) ? "ok" : "err"; m.className = "note authmsg" + (k ? " " + k : ""); m.innerHTML = t ? `<span class="am-i">${k === "load" ? `<i class="am-sp"></i>` : k === "ok" ? `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>` : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/></svg>`}</span><span></span>` : ""; if (t) m.lastChild.textContent = t; $$("#cl-in,#cl-up", el).forEach(b => b.classList.toggle("is-loading", k === "load")); }, val = () => [$("#cl-e", el).value.trim(), $("#cl-p", el).value];
  const need = () => { const [e, p] = val(); if (!e || p.length < 6) { msg("E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben."); return null; } return [e, p]; };
  let authBusy = false;   // verhindert doppeltes Absenden (Enter + Klick)
  /* E-Mail muss bestätigt sein: erst nach dem Klick auf den Link in der Mail geht die Anmeldung */
  const verify = (email, pw) => cloudVerifyView(el, email, pw, done);
  const bi = $("#cl-in", el); if (bi) bi.onclick = async () => { if (authBusy) return; const v = need(); if (!v) return; authBusy = true; try { msg("Anmelden …"); const { data, error } = await CLOUD.sb.auth.signInWithPassword({ email: v[0], password: v[1] }); if (error) { if (/confirm/i.test(error.message)) { try { await CLOUD.sb.auth.resend({ type: "signup", email: v[0], options: { emailRedirectTo: location.origin + "/" } }); } catch {} verify(v[0], v[1]); } else msg("Anmeldung fehlgeschlagen – E-Mail oder Passwort falsch."); } else if (cloudUnconfirmed(data?.user)) { try { await CLOUD.sb.auth.signOut(); } catch {} verify(v[0], v[1]); } else done();  } finally { authBusy = false; } };
  const bu = $("#cl-up", el); if (bu) bu.onclick = async () => { if (authBusy) return; const v = need(); if (!v) return; authBusy = true; try { msg("Konto wird erstellt …"); const rc = ($("#cl-rc", el)?.value || "").trim(); try { rc ? localStorage.setItem(RC_KEY, rc) : localStorage.removeItem(RC_KEY); } catch {} const { data, error } = await CLOUD.sb.auth.signUp({ email: v[0], password: v[1], options: { data: rc ? { app: "lumi", ref_code: rc } : { app: "lumi" }, emailRedirectTo: location.origin + "/" } }); if (error) return msg(error.message); if (data.session && !cloudUnconfirmed(data.user)) return done(); if (data.session) { try { await CLOUD.sb.auth.signOut(); } catch {} } verify(v[0], v[1]);  } finally { authBusy = false; } };
  const bf = $("#cl-fp", el); if (bf) bf.onclick = async () => { const [e] = val(); if (!e) return msg("Gib oben deine E-Mail ein."); const { error } = await CLOUD.sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + "/" }); msg(error ? error.message : "E-Mail zum Zurücksetzen ist unterwegs."); };
  $$("input", el).forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ($("#cl-in", el) || $("#cl-up", el)).click(); } }));
  setTimeout(() => $("#cl-e", el)?.focus(), 50);
}
/* Login-Seite: App-Vorschau im Panel links (Demo-Daten, kein Konto) – schräg gestellt, skaliert auf die Panel-Breite */
function authHeroMount(hero) {
  const view = $(".aa-view", hero), fr = $("iframe", hero); if (!view || !fr || innerWidth < 861) return;
  const W = 1280, H = 800, fit = () => { const k = view.clientWidth / W; fr.style.transform = `scale(${k})`; view.style.height = Math.round(H * k) + "px"; };
  new ResizeObserver(fit).observe(view); fit();
  setTimeout(() => { if (document.body.contains(fr)) fr.src = "index.html?embed=1#/app/today"; }, 350);
}
const cloudGate = () => !!(CLOUD.sb && !CLOUD.user);
/* Anmelde-/Registrierseite: Formular links, Foto mit schwebenden Karten rechts */
/* Einladungs-/Early-Access-Code: optional beim Registrieren. Kein Zugangscode mehr nötig, um die App zu nutzen.
   Der Code wird beim Registrieren gemerkt und nach der ersten Anmeldung (E-Mail ist dann bestätigt) einmalig eingelöst. */
const RC_KEY = "studix-refcode", rcDoneKey = () => "studix-rc-done-" + (CLOUD.user?.id || "");
async function accessCheck() {
  if (!CLOUD.user) return;
  let code = ""; try { if (localStorage.getItem(rcDoneKey()) === "1") return; code = localStorage.getItem(RC_KEY) || CLOUD.user.user_metadata?.ref_code || ""; } catch {}
  if (!code) return;
  try {
    const r = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ action: "redeem", code }) }), j = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status >= 500) return;   // später nochmal versuchen
    try { localStorage.setItem(rcDoneKey(), "1"); localStorage.removeItem(RC_KEY); } catch {}
    if (r.ok) { if (j.gift) toast("Early Backer: Pro geschenkt 🎉"); try { await plusLoad(false); } catch {} }
    else toast(j.error || "Dieser Code ist ungültig.");
  } catch {}
}
function authScreen(mode = "in") {
  const app = $("#app"), up = mode === "up", oauth = (window.LUMI_CONFIG.oauth || []).filter(x => x === "google" || x === "apple"); document.title = LPL.tt(up ? "Studix – Konto erstellen" : "Studix – Anmelden");
  app.innerHTML = `<div class="authwrap"><div class="authshell">
    <form class="authform" onsubmit="return false" novalidate><a class="logo authlogo" href="#/"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></a>
      <div class="authmid"><h1>${up ? "Konto erstellen" : "Willkommen zurück"}</h1><p class="authsub">${up ? "Registriere dich kostenlos – deine Daten sind auf allen Geräten gleich. Danach bestätigst du deine E-Mail." : "Melde dich an, um dein Dashboard zu öffnen."}</p>
        <label class="lbl" for="cl-e">E-Mail</label><div class="fld"><svg class="fi" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M4 7.5l8 5.5 8-5.5"/></svg><input class="field pill" id="cl-e" type="email" autocomplete="email" placeholder="du@beispiel.ch"></div>
        <label class="lbl" for="cl-p">Passwort</label><div class="fld pwrap"><svg class="fi" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg><input class="field pill" id="cl-p" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="6" placeholder="Mindestens 6 Zeichen"><button class="pweye" id="cl-eye" type="button" aria-label="Passwort anzeigen">${ic("eye")}</button></div>
        ${up ? `<label class="lbl" for="cl-rc">Einladungscode (optional)</label><div class="fld"><input class="field pill" id="cl-rc" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" style="letter-spacing:.12em;text-transform:uppercase"></div>` : ""}
        <p class="note authmsg" id="cl-m" aria-live="polite"></p>
        <button class="btn authgo" id="${up ? "cl-up" : "cl-in"}">${up ? "Kostenlos registrieren" : "Anmelden"}</button>
        ${oauth.length ? `<div class="authoauth">${oauth.map(o => `<button class="btn ghost" type="button" data-o="${o}">${o === "google" ? `<svg width="18" height="18" viewBox="0 0 48 48" style="margin-right:10px"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.9-4.7l-7.8-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Mit Google fortfahren` : "Mit Apple fortfahren"}</button>`).join("")}</div>` : ""}
        ${up ? "" : `<button class="link" id="cl-fp" type="button">Passwort vergessen?</button>`}</div>
      <p class="authswitch">${up ? "Schon ein Konto?" : "Noch kein Konto?"} <button class="link" id="cl-sw" type="button">${up ? "Jetzt anmelden" : "Jetzt registrieren"}</button></p>
      <div class="authfoot"><span>Mit dem Fortfahren stimmst du den <a href="legal.html#agb">AGB</a> und der <a href="legal.html#datenschutz">Datenschutzerklärung</a> zu.</span><span class="lang-sw inline"><button type="button" data-lang="en">English</button><i>·</i><button type="button" data-lang="de">Deutsch</button></span></div></form>
    <aside class="authhero"><a class="ah-logo" href="#/"><img src="logo-white.svg" width="40" height="40" alt=""><b><span class="wm"><b>S</b>tudi<b>x</b></span></b></a>
      <div class="ah-copy"><h2>Dein Lern- und Workspace an einem Ort.</h2><p>Notizen, Karteikarten, Planer und Studix AI – auf iPad, Handy und PC, auch offline.</p><div class="ah-dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div></div>
      <div class="auth-app" aria-hidden="true"><div class="aa-bar"><i></i><i></i><i></i><span>studix.space</span></div><div class="aa-view"><iframe tabindex="-1" title="Studix App-Vorschau"></iframe></div></div></aside></div></div>`;
  authHeroMount($(".authhero", app));
  const f = $(".authform", app); cloudAuthBind(f, () => {});
  $("#cl-sw", f).onclick = () => authScreen(up ? "in" : "up");
  $("#cl-eye", f).onclick = () => { const i = $("#cl-p", f); i.type = i.type === "password" ? "text" : "password"; };
  $$("[data-o]", f).forEach(b => b.onclick = async () => { const rc = ($("#cl-rc", f)?.value || "").trim(); try { if (rc) localStorage.setItem(RC_KEY, rc); } catch {} const { error } = await CLOUD.sb.auth.signInWithOAuth({ provider: b.dataset.o, options: { redirectTo: location.origin + "/" } }); if (error) $("#cl-m", f).textContent = error.message; });
  LPL.sync();
}
function cloudLoginModal() {
  if (!cloudOn()) return toast("Cloud ist noch nicht eingerichtet.");
  const { el, close } = modal(`<h3>Konto</h3><p class="note">Melde dich an, damit deine Notizen, Aufgaben und Karteikarten auf allen Geräten da sind.</p>${cloudAuthHtml()}`);
  cloudAuthBind(el, close);
}
/* Profil-Menü (Seitenleiste unten): Einstellungen, Passwort zurücksetzen, E-Mail ändern, Konto löschen, Abmelden */
async function cloudSendReset() {
  if (!CLOUD.user) return; const { error } = await CLOUD.sb.auth.resetPasswordForEmail(CLOUD.user.email, { redirectTo: location.origin + "/" });
  toast(error ? "E-Mail konnte nicht gesendet werden: " + error.message : "Wir haben dir eine E-Mail zum Zurücksetzen des Passworts geschickt.");
}
function emailChangeModal() {
  const { el, close } = modal(`<h3>E-Mail-Adresse ändern</h3><p class="note">Aktuell: <b>${esc(CLOUD.user?.email || "")}</b>. Wir schicken dir einen Bestätigungslink – erst danach gilt die neue Adresse.</p>
    <label class="lbl" for="ce-e">Neue E-Mail-Adresse</label><input class="field" id="ce-e" type="email" autocomplete="email" placeholder="neu@beispiel.ch"><p class="note" id="ce-m" aria-live="polite"></p>
    <div class="row end"><button class="btn ghost" data-c>Abbrechen</button><button class="btn primary" id="ce-go">Bestätigung senden</button></div>`);
  const inp = $("#ce-e", el), m = $("#ce-m", el), go = $("#ce-go", el); $("[data-c]", el).onclick = close; setTimeout(() => inp.focus(), 40);
  const send = async () => {
    const v = inp.value.trim(); if (!/^\S+@\S+\.\S+$/.test(v)) return (m.textContent = "Bitte gib eine gültige E-Mail-Adresse ein.");
    if (v.toLowerCase() === (CLOUD.user?.email || "").toLowerCase()) return (m.textContent = "Das ist schon deine aktuelle Adresse.");
    go.disabled = true; m.textContent = "Wird gesendet …";
    const { error } = await CLOUD.sb.auth.updateUser({ email: v }, { emailRedirectTo: location.origin + "/" });
    if (error) { m.textContent = error.message; go.disabled = false; } else { m.textContent = "Fertig – bestätige die Änderung über den Link in der E-Mail an " + v + "."; go.textContent = "Gesendet"; }
  };
  go.onclick = send; inp.onkeydown = e => { if (e.key === "Enter") send(); };
}
function profileMenu(btn) {
  const items = [{ label: "Profil & Einstellungen", icon: "gear", fn: () => { window.__setTab = "gen"; go("settings"); } }];
  if (CLOUD.user) items.push("-", { label: "Passwort zurücksetzen", icon: "shield", fn: cloudSendReset }, { label: "E-Mail ändern", icon: "adduser", fn: emailChangeModal }, "-", { label: "Abmelden", icon: "logout", fn: cloudLogout });
  else if (cloudOn()) items.push("-", { label: "Anmelden / Registrieren", icon: "login", fn: cloudLoginModal });
  menu(btn, items);
}
/* Link aus der Passwort-Zurücksetzen-Mail: neues Passwort festlegen */
function recoveryModal() {
  const { el, close } = modal(`<h3>Neues Passwort festlegen</h3><p class="note">Wähle ein neues Passwort für dein Studix-Konto.</p>
    <label class="lbl" for="rp-p">Neues Passwort</label><input class="field" id="rp-p" type="password" autocomplete="new-password" minlength="6" placeholder="Mindestens 6 Zeichen"><p class="note" id="rp-m" aria-live="polite"></p>
    <div class="row end"><button class="btn primary" id="rp-go">Passwort speichern</button></div>`);
  const inp = $("#rp-p", el), m = $("#rp-m", el), go = $("#rp-go", el); setTimeout(() => inp.focus(), 40);
  const save = async () => {
    if (inp.value.length < 6) return (m.textContent = "Mindestens 6 Zeichen.");
    go.disabled = true; m.textContent = "Wird gespeichert …";
    const { error } = await CLOUD.sb.auth.updateUser({ password: inp.value });
    if (error) { m.textContent = error.message; go.disabled = false; } else { close(); toast("Passwort geändert."); }
  };
  go.onclick = save; inp.onkeydown = e => { if (e.key === "Enter") save(); };
}
async function cloudLogout() {
  try { await cloudPush(); } catch {}
  try { await CLOUD.sb.auth.signOut(); } catch {}
  /* Dashboard komplett verlassen und die Login-Seite zeigen */
  CLOUD.user = null; try { BILL.row = null; } catch {} LS.set("lumi-sync", "0");
  document.getElementById("hdock")?.remove(); $("#modal-root").innerHTML = ""; $("#toast")?.classList.remove("show");
  ["#tutor", "#cpanel", "#tpill"].forEach(q => { const e = $(q); if (e) e.hidden = true; });
  $("#app").innerHTML = ""; $("#app").classList.remove("has-dock"); try { onboardShown = false; } catch {}
  if (location.hash.replace(/^#\/?/, "") !== "app") location.hash = "#/app"; else route();
  setTimeout(() => toast("Abgemeldet"), 50);
}
function cloudPanelHtml() {
  if (!cloudOn()) return `<div class="panel"><h2>${ic("adduser")}Konto &amp; Cloud</h2><p class="note">Die Cloud ist nicht eingerichtet.</p></div>`;
  return CLOUD.user
    ? `<div class="panel"><h2>${ic("adduser")}Konto &amp; Cloud</h2><div class="msstate ok"><b><i class="ldot on"></i>Angemeldet als ${esc(CLOUD.user.email)}</b><span id="cl-st">Synchronisiert</span></div><div class="row" style="gap:8px"><button class="btn" id="cl-sync">Jetzt synchronisieren</button><button class="btn" id="cl-out">Abmelden</button></div><p class="note">Notizen, Zeichnungen, Aufgaben, Karteikarten und Datenbanken werden gesichert. Hochgeladene PDFs/Dateien bleiben vorerst auf dem Gerät.</p></div>
      <div class="panel" id="sec-p"><h2>${ic("shield")}Sicherheit</h2><div class="secrow"><div><b>Zwei-Faktor-Anmeldung</b><small id="mfa-s">Wird geprüft …</small></div><button class="btn" id="mfa-b" hidden></button></div>
        <div class="secrow"><div><b>Passwort</b><small>Wir senden dir eine E-Mail mit einem Link zum Zurücksetzen.</small></div><button class="btn" id="pw-b">Link senden</button></div></div>
      <div class="panel danger-zone"><h2>${ic("trash")}Konto löschen</h2><p class="note">Löscht dein Konto, alle in der Cloud gesicherten Daten und beendet ein laufendes Abo sofort. Das kann nicht rückgängig gemacht werden. Daten auf diesem Gerät bleiben bestehen, bis du sie unter Daten löschst.</p><button class="btn danger" id="acc-del">Konto endgültig löschen</button></div>`
    : `<div class="panel"><h2>${ic("adduser")}Konto &amp; Cloud</h2><p class="note">Mit einem Konto sind deine Daten auf iPad, Handy und PC gleich.</p><button class="btn primary" id="cl-login">Anmelden / Registrieren</button></div>`;
}
function cloudBindPanel(m) {
  $("#cl-login", m) && ($("#cl-login", m).onclick = cloudLoginModal);
  $("#cl-out", m) && ($("#cl-out", m).onclick = cloudLogout);
  $("#acc-del", m) && ($("#acc-del", m).onclick = accountDeleteModal);
  $("#pw-b", m) && ($("#pw-b", m).onclick = async e => { e.currentTarget.disabled = true; const { error } = await CLOUD.sb.auth.resetPasswordForEmail(CLOUD.user.email, { redirectTo: location.origin + "/" }); toast(error ? "E-Mail konnte nicht gesendet werden: " + error.message : "E-Mail zum Zurücksetzen ist unterwegs."); e.currentTarget.disabled = false; });
  if ($("#mfa-b", m)) mfaRefresh(m);
  $("#cl-sync", m) && ($("#cl-sync", m).onclick = async () => { for (const k of await cloudLocalKeys()) CLOUD.dirty.add(JSON.stringify([k, false])); await cloudPush(); toast("Synchronisiert"); });
}


/* ===== Zwei-Faktor-Anmeldung (Authenticator-App, Supabase MFA/TOTP) ===== */
async function mfaFactors() { try { const { data } = await CLOUD.sb.auth.mfa.listFactors(); return (data?.totp || []).filter(f => f.status === "verified"); } catch { return []; } }
async function mfaRefresh(m) {
  const f = await mfaFactors(), s = $("#mfa-s", m), b = $("#mfa-b", m); if (!s || !b) return;
  b.hidden = false; s.textContent = f.length ? "Aktiv – beim Anmelden fragen wir zusätzlich einen Code aus deiner Authenticator-App ab." : "Aus – schütze dein Konto mit einem Code aus einer Authenticator-App (z. B. Google Authenticator, Apple Passwörter, 1Password).";
  b.textContent = f.length ? "Deaktivieren" : "Einrichten"; b.className = "btn" + (f.length ? "" : " primary");
  b.onclick = async () => {
    if (f.length) { if (!(await confirmBox("Zwei-Faktor-Anmeldung wirklich deaktivieren?", "Deaktivieren"))) return; for (const x of f) { const { error } = await CLOUD.sb.auth.mfa.unenroll({ factorId: x.id }); if (error) return toast(error.message); } toast("Zwei-Faktor-Anmeldung deaktiviert."); mfaRefresh(m); }
    else mfaSetupModal(() => mfaRefresh(m));
  };
}
async function mfaSetupModal(done) {
  const { data, error } = await CLOUD.sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Studix " + new Date().toLocaleDateString("de-CH") });
  if (error) return toast("Einrichten nicht möglich: " + error.message);
  const { el, close } = modal(`<h3>Zwei-Faktor-Anmeldung einrichten</h3><p class="note">1. Scanne den QR-Code mit deiner Authenticator-App.<br>2. Gib den 6-stelligen Code ein, den die App anzeigt.</p>
    <div class="mfa-qr"><img src="${data.totp.qr_code}" alt="QR-Code" width="180" height="180"></div><details class="msh"><summary>Code lieber eintippen?</summary><p class="note"><code>${esc(data.totp.secret)}</code></p></details>
    <input class="field mfa-code" id="mfa-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"><p class="note" id="mfa-m"></p><div class="row end"><button class="btn ghost" data-c>Abbrechen</button><button class="btn primary" id="mfa-v">Bestätigen</button></div>`);
  let ok = false; const cancel = async () => { if (!ok) { try { await CLOUD.sb.auth.mfa.unenroll({ factorId: data.id }); } catch {} } close(); };
  $("[data-c]", el).onclick = cancel; $(".x", el).onclick = cancel; setTimeout(() => $("#mfa-c", el).focus(), 40);
  const go = async () => { const code = $("#mfa-c", el).value.trim(); if (code.length !== 6) return; $("#mfa-m", el).textContent = "Prüfe …"; const { error: e2 } = await CLOUD.sb.auth.mfa.challengeAndVerify({ factorId: data.id, code }); if (e2) { $("#mfa-m", el).textContent = "Der Code stimmt nicht. Versuche es mit dem aktuellen Code noch einmal."; return; } ok = true; close(); toast("Zwei-Faktor-Anmeldung ist aktiv."); done && done(); };
  $("#mfa-v", el).onclick = go; $("#mfa-c", el).addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); if (e.target.value.length === 6) go(); });
}
/* Nach dem Passwort: wenn ein zweiter Faktor aktiv ist, Code abfragen */
async function mfaGate() {
  try {
    const { data } = await CLOUD.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2")) return true;
    const f = await mfaFactors(); if (!f.length) return true;
    return await new Promise(res => {
      const { el, close } = modal(`<h3>Bestätigung nötig</h3><p class="note">Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p><input class="field mfa-code" id="mfa-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"><p class="note" id="mfa-m"></p><div class="row end"><button class="btn ghost" data-c>Abbrechen</button><button class="btn primary" id="mfa-v">Weiter</button></div>`);
      let done = false; const fin = v => { if (done) return; done = true; close(); res(v); };
      $("[data-c]", el).onclick = () => fin(false); $(".x", el).onclick = () => fin(false); setTimeout(() => $("#mfa-c", el).focus(), 40);
      const go = async () => { const code = $("#mfa-c", el).value.trim(); if (code.length !== 6) return; $("#mfa-m", el).textContent = "Prüfe …"; const { error } = await CLOUD.sb.auth.mfa.challengeAndVerify({ factorId: f[0].id, code }); if (error) { $("#mfa-m", el).textContent = "Der Code stimmt nicht."; $("#mfa-c", el).value = ""; return; } fin(true); };
      $("#mfa-v", el).onclick = go; $("#mfa-c", el).addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); if (e.target.value.length === 6) go(); });
    });
  } catch { return true; }
}

/* ===== Konto löschen ===== */
function accountDeleteModal() {
  const email = CLOUD.user?.email || "";
  const { el, close } = modal(`<h3>Konto endgültig löschen?</h3><p class="note">Das löscht dein Konto und alle Cloud-Daten und beendet ein laufendes Abo sofort (ohne Rückerstattung des laufenden Zeitraums). Das kann nicht rückgängig gemacht werden.</p>
    <label class="lbl">Zur Bestätigung deine E-Mail-Adresse eingeben</label><input class="field" id="del-e" type="email" placeholder="${esc(email)}" autocomplete="off"><p class="note" id="del-m"></p>
    <div class="row end"><button class="btn ghost" data-c>Abbrechen</button><button class="btn danger" id="del-go" disabled>Konto löschen</button></div>`);
  const inp = $("#del-e", el), go = $("#del-go", el); $("[data-c]", el).onclick = close; setTimeout(() => inp.focus(), 40);
  inp.oninput = () => { go.disabled = inp.value.trim().toLowerCase() !== email.toLowerCase(); };
  go.onclick = async () => {
    go.disabled = true; $("#del-m", el).textContent = "Konto wird gelöscht …";
    try {
      const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ action: "delete", confirm: inp.value.trim() }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Fehler " + r.status);
      close(); toast("Dein Konto wurde gelöscht."); try { await CLOUD.sb.auth.signOut({ scope: "local" }); } catch {} setTimeout(() => location.assign("/"), 900);
    } catch (e) { $("#del-m", el).textContent = e.message; go.disabled = false; }
  };
}
