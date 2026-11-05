"use strict";
/* Studix – router, landing page, boot */
const landingEl = $("#landing"), appEl = $("#app");
let onboardShown = false;
const EMBED = /[?&]embed=1/.test(location.search); if (EMBED) document.documentElement.classList.add("embed");

function renderView() {
  LEAVE.splice(0).forEach(f => { try { f(); } catch {} });
  const [, v = "today", x, y] = location.hash.replace(/^#\/?/, "").split("/");
  curView = V[v] ? v : "today";
  buildShell(); const dock = curView === "today"; $("#app").classList.toggle("has-dock", dock); if (!dock) window.__dockFresh = false; refreshNav(); timerPaint(); try { mobileChrome(); } catch {}
  const m = $("#main"); m.className = "main"; m.removeAttribute("style"); window.scrollTo(0, 0); m.scrollTop = 0; setScroller(m);
  $("#cpanel") && curView === "ai" && ($("#cpanel").hidden = true);
  if (curView === "today" && !EMBED) setTimeout(() => { try { streakNudge(); } catch {} }, 2500);
  try { const r = V[curView](m, x, y); if (r?.catch) r.catch(e => console.error(e)); } catch (e) { console.error(e); m.innerHTML = `<div class="page"><div class="emptybox"><h3>Ups, da ist etwas schiefgelaufen</h3><p>${esc(e.message)}</p><button class="btn" data-go="today">Zur Startseite</button></div></div>`; bindCommon(m); }
}
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (EMBED && !h.startsWith("app")) { location.hash = "#/app/today"; return; }
  if (!h.startsWith("app") || (!EMBED && cloudGate())) document.getElementById("hdock")?.remove();   // Chat-Leiste der Startseite nicht auf Landing/Login stehen lassen
  if (!h.startsWith("app")) { landingEl.hidden = false; appEl.hidden = true; document.title = LPL.title(); if (!landingEl.dataset.r) renderLanding(); LPL.sync(); window.scrollTo(0, 0); return; }
  landingEl.hidden = true; appEl.hidden = false; document.title = "Studix"; LPL.mount();
  if (!EMBED && cloudGate()) return authScreen(pendingRef() ? "up" : "in");
  if (!EMBED && !D.profile.onboarded && !onboardShown) { onboardShown = true; buildShell(); renderView(); onboarding(); return; }
  renderView();
}
addEventListener("hashchange", route);
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".pr-sw button"); if (!b) return; const pn = b.closest(".pr-panel"); pn.dataset.per = b.dataset.per; pn.querySelectorAll(".pr-sw button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); });
addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !e.shiftKey && location.hash.startsWith("#/app")) { e.preventDefault(); go("search"); } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && location.hash.startsWith("#/app") && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && !e.target.isContentEditable) { e.preventDefault(); go("search"); } });

/* ---------- landing ---------- */
function pricingHtml(go) {
  const c = BILL.cfg; if (!c || !c.enabled) return "";
  const eur = v => `${new Intl.NumberFormat("de-CH", { minimumFractionDigits: v % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(v / 100)} ${({ chf: "CHF", eur: "€", usd: "USD" })[(c.currency || "eur").toLowerCase()] || ""}`, li = a => a.map(x => `<li>${ic("check")}${x}</li>`).join("");
  const tick = `<i class="cb a"></i><i class="cb b"></i><i class="cb c"></i><i class="cb d"></i>`;
  const pctY = c.yearly && c.monthly ? Math.round((1 - c.yearly / (c.monthly * 12)) * 100) : 0;
  /* Preis mit Monats-/Jahresansicht (Umschalter oben): beide Texte stehen im Code, CSS zeigt den gewählten */
  const priceMY = (m, y) => !m ? price(y, "/ Jahr") : !y ? price(m, "/ Monat") : `<p class="pr"><b class="pm">${eur(m)}</b><small class="pm"> / Monat</small><b class="py">${eur(y)}</b><small class="py"> / Jahr</small></p><p class="note pm">Monatlich kündbar.</p><p class="note py">Nur ${eur(Math.round(y / 12))} pro Monat${m * 12 > y ? ` – du sparst ${Math.round((1 - y / (m * 12)) * 100)} %` : ""}.</p>`;
  const price = (v, per) => `<p class="pr"><b>${eur(v)}</b>${per ? `<small> ${per}</small>` : ""}</p>`;
  const free = [`Bis zu ${FREE_LIMITS.docs} Dokumente, ${FREE_LIMITS.boards} Whiteboards`, "Karteikarten &amp; Quiz", "Planer, Noten, Fokus-Timer", `Studix AI: bis zu ${aiuNum(AIQ.free)} Token pro Woche*`, "Sync auf allen Geräten"];
  const ess = ["Alles aus Gratis", `Studix AI: bis zu ${aiuNum(AIQ.ess)} Token pro Woche* – halb so viel wie Pro`, "Unbegrenzt Dokumente &amp; Whiteboards", "Längere Antworten", "Workspace &amp; Live-Zusammenarbeit", "Jederzeit kündbar"];
  const pro = ["Alles aus Gratis", `${c.trial || 14} Tage kostenlos testen`, `Studix AI: bis zu ${aiuNum(AIQ.pro)} Token pro Woche*`, "Unbegrenzt Dokumente &amp; Whiteboards", "Workspace &amp; Live-Zusammenarbeit", "Bild-Analyse &amp; Sprachgespräch", "Längere Antworten", "Neue Pro-Funktionen zuerst", "Jederzeit kündbar"];
  return `<section class="sec" id="pricing"><p class="pr-k">Preise</p><h2>Einfache Preise.</h2><p class="lead">Starte kostenlos – upgrade, wenn du mehr Studix AI willst.</p>
  <div class="pr-steps">${[["adduser", "Kostenlos starten", "Konto anlegen und sofort loslegen."], ["spark", "Pro testen", `${c.trial || 14} Tage gratis, ohne Risiko.`], ["check", "Jederzeit kündbar", "Keine Bindung, keine Kosten danach."]].map(([i, h, p]) => `<div><span class="hf-i">${ic(i)}</span><div><b>${h}</b><small>${p}</small></div></div>`).join("")}</div>
  <div class="pr-panel" data-per="month">${tick}
    ${c.yearly ? `<div class="pr-sw" role="tablist" aria-label="Abrechnung"><button type="button" class="on" data-per="month" role="tab" aria-selected="true">Monatlich</button><button type="button" data-per="year" role="tab" aria-selected="false">Jährlich${pctY ? ` <em>−${pctY} %</em>` : ""}</button></div>` : ""}
    <div class="pr-3" style="--n:${c.essential ? 3 : 2}">
      <div class="pr-card"><div class="pr-col"><span class="pr-l">Gratis</span>${price(0)}<p class="note">Für immer kostenlos.</p><a class="btn" ${go}>Kostenlos starten</a></div><ul class="pr-ul">${li(free)}</ul></div>
      ${c.essential ? `<div class="pr-card"><div class="pr-col"><span class="pr-l">Studix Essential</span>${priceMY(c.essential, c.essentialYearly)}<a class="btn" ${go}>Essential wählen</a></div><ul class="pr-ul">${li(ess)}</ul></div>` : ""}
      <div class="pr-card pr-hot"><div class="pr-col"><span class="pr-l">Studix Study Pro</span>${priceMY(c.monthly, c.yearly)}<a class="btn accent" ${go}>${c.trial || 14} Tage gratis testen</a></div><ul class="pr-ul">${li(pro)}</ul></div>
    </div></div>
  <p class="pr-f">${planCompareLink()}<span>Preise inkl. gesetzlicher Mehrwertsteuer deines Landes – sie wird beim Bezahlen automatisch berechnet.</span></p>
  <p class="pr-n">* Das Studix-AI-Kontingent ist keine zugesicherte Leistung: Es gibt keine Garantie, dass du es immer in dieser Höhe oder überhaupt nutzen kannst. Menge, Modelle und Verfügbarkeit hängen von externen Anbietern ab und können angepasst, zeitweise eingeschränkt oder ausgesetzt werden – auch mit Studix Study Pro. Deine gesetzlichen Rechte (z. B. Kündigung) bleiben unberührt.</p>
  <p class="pr-n">Soweit gesetzlich zulässig, haften wir nicht für technische Fehler der KI, die Nichtbereitstellung von Servern (auch von Drittanbietern), die Datensicherung und Datenverlust. Sichere wichtige Inhalte regelmässig über den Export. Zwingende Haftung bleibt unberührt, Näheres in den <a href="legal.html#agb">AGB</a>.</p></section>`;
}
const EMBED_TABS = [["Dashboard", "today", "home"], ["Dokumente", "docs", "folder"], ["Karteikarten", "cards", "cards"], ["Planer", "planner", "cal"], ["Studix AI", "ai", "spark"]];
function mountEmbed(root) {
  const fr = $("iframe", root), box = $(".emb-view", root), tabs = $$(".emb-tab", root), W = 1280, H = 780;
  const fit = () => { const w = box.clientWidth, k = w / W; fr.style.height = H + "px"; box.style.height = Math.round(H * k) + "px"; fr.style.transform = `scale(${k})`; };
  new ResizeObserver(fit).observe(box); fit();
  const mark = () => { let v = ""; try { v = (fr.contentWindow.location.hash.replace(/^#\/?/, "").split("/")[1] || "today"); } catch {} tabs.forEach(t => t.classList.toggle("on", t.dataset.v === v || (v === "doc" && t.dataset.v === "docs") || (v === "deck" && t.dataset.v === "cards"))); };
  /* Die Vorschau bedient niemand selbst: Sofia klickt sich automatisch durch die App, Lena und Marc sind nur im geteilten Dokument zu sehen */
  const live = $(".emb-live", root), sofia = $(".cur.u3", root); let tour = 0, alive = true, tid = 0;
  const wait = ms => new Promise(r => { tid = setTimeout(r, ms); });
  const q = s => { try { return fr.contentDocument.querySelector(s); } catch { return null; } };
  const hashGo = v => { try { fr.contentWindow.location.hash = "#/app/" + v; } catch { fr.src = "index.html?embed=1#/app/" + v; } };
  const moveTo = (sel, fx = .5, fy = .5) => { const e = q(sel), k = box.clientWidth / W; if (!e) return false; const r = e.getBoundingClientRect(); sofia.style.left = (r.left + r.width * fx) * k + "px"; sofia.style.top = (r.top + r.height * fy) * k + "px"; return true; };
  const ripple = () => { sofia.classList.remove("clk"); void sofia.offsetWidth; sofia.classList.add("clk"); };
  /* Echter Klick in der App: Cursor fährt hin, klickt, die App reagiert */
  const press = async (sel, fb) => { const ok = moveTo(sel, .4, .5); await wait(1300); ripple(); await wait(220); const e = q(sel); if (e) e.click(); else if (fb) hashGo(fb); await wait(900); return ok; };
  const type = async (body, txt) => { for (const ch of txt) { fr.contentDocument.execCommand("insertText", false, ch); await wait(70 + Math.random() * 50); } };
  const write = async () => {
    const d = fr.contentDocument, body = q("#body"); if (!body) return; const orig = body.innerHTML;
    live.classList.add("collab"); moveTo("#body h1", .5, .5); await wait(1500);
    body.focus({ preventScroll: true }); const s = d.getSelection(), r = d.createRange(); r.selectNodeContents(body); r.collapse(false); s.removeAllRanges(); s.addRange(r);
    d.execCommand("insertParagraph"); moveTo("#body p:last-child", .3, .6);
    const txt = "Merke: ATP ist die Energiewährung der Zelle."; await type(body, txt); await wait(700);
    /* Wort „Energiewährung“ markieren und anstreichen */
    const tn = s.anchorNode, at = txt.indexOf("Energiewährung"); if (tn && tn.nodeType === 3 && tn.length >= at + 14) { const w = d.createRange(); w.setStart(tn, tn.length - txt.length + at); w.setEnd(tn, tn.length - txt.length + at + 14); s.removeAllRanges(); s.addRange(w); ripple(); d.execCommand("hiliteColor", false, "#ffe58a"); d.execCommand("underline"); await wait(2200); }
    s.removeAllRanges(); await wait(1200); body.innerHTML = orig; body.dispatchEvent(new Event("input", { bubbles: true })); body.blur(); live.classList.remove("collab");
  };
  const run = async () => {
    const mine = ++tour; await wait(2200);
    while (alive && mine === tour) {
      await press('.nav-i[data-go="docs"]', "docs"); await wait(900);
      if (!q('[data-d="d1"]')) await press(".fcard, .folder, .fol", null);
      await press('[data-d="d1"]', "doc/d1"); await wait(900); if (!q("#body")) hashGo("doc/d1"); await wait(900);
      await write(); if (!(alive && mine === tour)) break;
      await press('.nav-i[data-go="today"]'); await wait(2800);
      await press('.nav-i[data-go="exams"]'); await wait(2600);
      await press('.nav-i[data-go="planner"]'); await wait(2600);
      await press('.nav-i[data-go="grades"]'); await wait(2400);
      hashGo("cards"); moveTo("#main", .5, .4); await wait(2600);
      await press('.nav-i[data-go="ai"]'); await wait(3000);
      await press('.nav-i[data-go="today"]'); await wait(2000);
    }
  };
  const vis = new IntersectionObserver(es => es.forEach(e => { alive = e.isIntersecting; if (alive) run(); else { clearTimeout(tid); tour++; } }), { threshold: .2 }); vis.observe(root);
  /* Hell/Dunkel der Vorschau folgt immer dem Thema der Seite (auch wenn es nach dem Laden gewechselt wird) */
  const theme = () => { try { fr.contentDocument.documentElement.dataset.theme = themeNow(); } catch {} };
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  fr.addEventListener("load", () => { theme(); mark(); try { fr.contentWindow.addEventListener("hashchange", mark); } catch {} });
}
/* MacBook auf der Startseite: ein weicher orangefarbener Zeiger bedient die echte App – er fährt auch aus dem Gerät heraus und wieder hinein, klickt Knöpfe und tippt in Textfelder */
function mountMac(root) {
  if (!root) return;
  const sec = root.closest(".mac-sec"), scr = $(".mbp-scr", root), fr = $("iframe", root), W = 1440, H = 932;
  const fit = () => { fr.style.transform = `scale(${scr.clientWidth / W})`; };
  new ResizeObserver(fit).observe(scr); fit();
  const theme = () => { try { fr.contentDocument.documentElement.dataset.theme = themeNow(); } catch {} };
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  fr.addEventListener("load", theme);
  /* Zeiger */
  const cur = document.createElement("div"); cur.className = "mcur";
  cur.innerHTML = `<svg viewBox="0 0 28 32" aria-hidden="true"><path d="M5.6 4.4l15.8 10.1a.9.9 0 0 1-.3 1.6l-6.6 1.5-3.5 5.8a.9.9 0 0 1-1.6-.2z" fill="#ff6a1a" stroke="#ff6a1a" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/></svg><i class="mcur-r"></i>`;
  sec.appendChild(cur);
  let cx = 0, cy = 0, alive = false, run = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const secBox = () => sec.getBoundingClientRect();
  let tilt = 0, tgt = 0; const svgEl = $("svg", cur);
  const place = (x, y) => { const vx = x - cx; cx = x; cy = y; const b = secBox(); cur.style.transform = `translate(${x - b.left}px,${y - b.top}px)`; tgt = Math.max(-16, Math.min(16, vx * 1.1)); tilt += (tgt - tilt) * .12; svgEl.style.rotate = tilt.toFixed(2) + "deg"; };
  /* Zeiger dreht sich weich zurück, wenn er stillsteht */
  const relax = () => { if (Math.abs(tilt) > .05 || Math.abs(tgt) > .05) { tgt *= .9; tilt += (tgt - tilt) * .12; svgEl.style.rotate = tilt.toFixed(2) + "deg"; } requestAnimationFrame(relax); }; requestAnimationFrame(relax);
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const move = (x, y, dur) => new Promise(res => {
    const x0 = cx, y0 = cy, dx = x - x0, dy = y - y0, d = Math.hypot(dx, dy) || 1, bend = Math.min(90, d * .16) * (Math.random() < .5 ? -1 : 1);
    const mx = x0 + dx / 2 - dy / d * bend, my = y0 + dy / 2 + dx / d * bend, T = dur || Math.min(1500, 380 + d * .95), t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / T), e = ease(p), u = 1 - e; place(u * u * x0 + 2 * u * e * mx + e * e * x, u * u * y0 + 2 * u * e * my + e * e * y); p < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
  /* Element in der App → Seitenkoordinaten */
  const doc = () => { try { return fr.contentDocument; } catch { return null; } };
  const q = sel => { const d = doc(); if (!d) return null; if (typeof sel === "string" && sel.startsWith("text:")) { const t = sel.slice(5); return [...d.querySelectorAll("button,a,.popmenu *")].find(e => e.children.length < 3 && e.textContent.trim().startsWith(t)) || null; } return d.querySelector(sel); };
  const pt = (el, fx = .5, fy = .5) => { const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect(), k = s.width / W; return [s.left + (r.left + r.width * fx) * k, s.top + (r.top + r.height * fy) * k]; };
  const out = async (side = 0) => { const b = secBox(), s = scr.getBoundingClientRect(), vw = innerWidth; const pts = [[Math.min(vw - 40, s.right + 90), s.top + s.height * .35], [Math.min(vw - 40, s.right + 70), s.bottom + 30], [Math.max(40, s.left - 70), s.top + s.height * .6]]; const [x, y] = pts[side % pts.length]; await move(x, y); };
  const click = async sel => { const el = typeof sel === "string" ? q(sel) : sel; if (!el) return false; const [x, y] = pt(el, .35 + Math.random() * .3, .5); await move(x + (Math.random() * 4 - 2), y); await wait(260 + Math.random() * 220); cur.classList.add("dn"); await wait(110); try { el.click(); } catch {} cur.classList.remove("dn"); cur.classList.remove("rp"); void cur.offsetWidth; cur.classList.add("rp"); await wait(520); return true; };
  const type = async (sel, text, o = {}) => {
    const el = typeof sel === "string" ? q(sel) : sel; if (!el) return false; const d = doc();
    if (!o.noClick) await click(el); try { el.focus({ preventScroll: true }); } catch {}
    for (const ch of text) { if (!alive) return false; try { d.execCommand("insertText", false, ch); } catch {} await wait(55 + Math.random() * 70 + (",. –".includes(ch) ? 90 : 0)); }
    await wait(350); return true;
  };
  const key = (el, k) => { try { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); } catch {} };
  const go = async v => { try { fr.contentWindow.location.hash = "#/app/" + v; } catch {} await wait(1100); };
  const tour = async mine => {
    const ok = () => alive && mine === run;
    await wait(1200);
    while (ok()) {
      try { fr.contentWindow.location.hash = "#/app/today"; } catch {} await wait(1400);
      const s0 = scr.getBoundingClientRect(); place(Math.min(innerWidth - 40, s0.right + 120), s0.top + s0.height * .3); cur.classList.add("on");
      /* 1. Neues Dokument anlegen und schreiben */
      await click('.nav-i[data-go="docs"]'); if (!ok()) break; await wait(700);
      await click("#nw"); if (!ok()) break; await wait(500);
      await click("text:Dokument (A4)"); if (!ok()) break; await wait(700);
      await type("#nd-n", "Zellatmung – Zusammenfassung"); if (!ok()) break;
      await click("#nd-go"); if (!ok()) break; await wait(1500);
      const body = q("#body");
      if (body) { await click(body); const d = doc(); const r = d.createRange(); r.selectNodeContents(body); r.collapse(false); const sl = d.getSelection(); sl.removeAllRanges(); sl.addRange(r); await type(body, "In den Mitochondrien entsteht ATP – die Energie der Zelle.", { noClick: true }); }
      if (!ok()) break;
      /* kurz aus dem Gerät hinaus, dann wieder hinein */
      await out(0); await wait(900); if (!ok()) break;
      /* 2. Aufgabe auf der Startseite eintragen */
      await click('.nav-i[data-go="today"]'); if (!ok()) break; await wait(900);
      const ti = q("#todo-i"); if (ti) { await type(ti, "Referat vorbereiten"); key(ti, "Enter"); try { ti.form.requestSubmit(); } catch {} await wait(1100); }
      if (!ok()) break;
      /* 3. Planer und Karteikarten ansehen */
      await click('.nav-i[data-go="planner"]'); if (!ok()) break; await wait(1800);
      await out(1); await wait(700); if (!ok()) break;
      await click('.nav-i[data-go="exams"]'); if (!ok()) break; await wait(1800);
      /* 4. Frage an Studix AI */
      await click('.nav-i[data-go="ai"]'); if (!ok()) break; await wait(1200);
      const ai = q("input.tin"); if (ai) { await type(ai, "Erkläre mir die Zellatmung"); await wait(900); try { ai.value = ""; ai.dispatchEvent(new Event("input", { bubbles: true })); } catch {} }
      if (!ok()) break;
      await out(2); await wait(1400);
      /* zurücksetzen: angelegtes Demo-Dokument wieder entfernen */
      try { fr.contentWindow.eval('D.docs = D.docs.filter(x => x.title !== "Zellatmung – Zusammenfassung"); D.tasks = D.tasks.filter(x => x.title !== "Referat vorbereiten");'); } catch {}
      await go("today"); await wait(800);
    }
  };
  const start = () => { if (alive) return; alive = true; tour(++run); };
  const stop = () => { alive = false; run++; cur.classList.remove("on"); };
  const begin = () => new IntersectionObserver(es => es.forEach(x => (x.isIntersecting && !document.hidden) ? start() : stop()), { threshold: .45 }).observe(root);
  fr.contentDocument && fr.contentDocument.readyState === "complete" ? begin() : fr.addEventListener("load", begin, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
}
/* Linienraster über Bento und Preise: alle Linien und Marken aus der echten Geometrie – Marken sitzen immer genau auf Kreuzungen (+) bzw. Anschlüssen (T) */
function mountFrame(root) {
  const how = $("#how", root), pr = $("#pricing", root), grid = $(".bento3", root); if (!how || !grid) return;
  const ov = document.createElement("div"); ov.className = "gfr"; ov.setAttribute("aria-hidden", "true"); root.appendChild(ov);
  const upd = () => {
    const rt = root.getBoundingClientRect(), R = e => e.getBoundingClientRect(), ca = R($(".b-a", grid)), cb = R($(".b-b", grid)), cd = R($(".b-d", grid)), g = R(grid), a = R(how), p = R(pr || how);
    const X = v => Math.round(v - rt.left), Y = v => Math.round(v - rt.top);
    const xl = X(a.left) + 2, xr = X(a.right) - 2, x1 = X(cb.left), x2 = X(cd.left);
    const faq = $("#faq .faq", root), fr = faq ? R(faq) : null, y0 = Y(a.top), yb0 = Y(g.top), ybm = Y(ca.bottom), yb1 = Y(g.bottom), ype = Y(p.bottom), yf0 = fr ? Y(fr.top) : 0, ye = fr ? Y(fr.bottom) : ype, ytop = y0 - 160;
    let h = "";
    const V = (x, ya, yb, c = "") => h += `<i class="v ${c}" style="left:${x}px;top:${ya}px;height:${yb - ya}px"></i>`;
    const H = y => h += `<i class="h" style="top:${y}px"></i>`;
    const K = (x, y, c) => h += `<i class="k ${c}" style="left:${x}px;top:${y}px"></i>`;
    const fv = $(".flow-v", root), yfb = fv ? Y(R(fv).bottom) : ytop;   /* Unterkante des Workflow-Blocks: waagrechte Linie, die rechte senkrechte Linie startet dort mit einem T */
    const lapE = $(".mbp-front", root), yLb0 = lapE ? Y(R(lapE).bottom) : 0;
    const stp = $("#steps", root), gap = !!stp && yfb > 0 && y0 > yfb;   /* Abschnitt „Auf allen Plattformen“: neben dem Handy keine linke Linie – sie endet genau an der Rasterlinie darüber (T) und beginnt genau an der darunter (T) */
    if (gap) { V(xl, 0, yfb); V(xl, y0, ye); } else V(xl, 0, ye);   /* linke Linie läuft über die ganze Seite bis nach oben */
    if (yLb0 && yLb0 < yfb) { V(xr, 0, yLb0); V(xr, yfb, ye); } else V(xr, 0, ye);   /* rechts: endet auf der Laptop-Linie, im Workflow-Abschnitt keine Linie, danach weiter */ V(x1, yb0, ybm); V(x2, ybm, yb1);
    [yfb, y0, yb0, ybm, yb1, ye].forEach(H); K(xl, yfb, gap ? "tu" : "p"); K(xr, yfb, yLb0 && yLb0 < yfb ? "td" : "p"); if (fr) { H(yf0); K(xl, yf0, "p"); K(xr, yf0, "p"); }
    [y0, yb0, ybm, yb1, ye].forEach(y => { K(xl, y, gap && y === y0 ? "td" : "p"); K(xr, y, "p"); });
    K(x1, yb0, "td"); K(x1, ybm, "tu"); K(x2, ybm, "td"); K(x2, yb1, "tu");
    /* Oben: waagrechte Linien (unter der Navigation, über den vier Funktionen, unter dem Laptop – er steht genau darauf) */
    const hero = $(".hero3", root), hf = $(".hfeat", root), lap = $(".mbp-front", root);
    if (hero && hf && lap) {
      const hr = R(hero), fr0 = R(hf), lr = R(lap), yH0 = Y(hr.top) + 96, yH1 = Y(fr0.top) - 28, yLb = yLb0;
      [yH0, yH1, yLb].forEach(y => { H(y); K(xl, y, "p"); K(xr, y, y === yLb && yLb < yfb ? "tu" : "p"); });
    }
    ov.innerHTML = h;
  };
  $$("#faq details", root).forEach(d => d.addEventListener("toggle", () => setTimeout(upd, 30)));
  new ResizeObserver(upd).observe(document.body); addEventListener("load", upd); upd(); setTimeout(upd, 1200); setTimeout(upd, 3500);
}
/* Maskottchen unten rechts: ruht als kleiner Stapel („Hey.“), öffnet sich beim Darüberfahren (Animation startet, hält offen an) und geht beim Wegscrollen wieder zu; Klick führt zur Anmeldung. Nur am PC (Maus, breiter Bildschirm). */
async function mountMascot(root) {
  if (!matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1025px)").matches) return;   // nur am PC/Mac mit Maus – nicht auf iPad und Handy
  let txt = ""; try { const r = await fetch("float-anim.svg"); if (!r.ok) return; txt = await r.text(); } catch { return; }
  if (!/^\s*<svg[\s>]/.test(txt) || /<script/i.test(txt)) return;
  const a = document.createElement("a"); a.className = "lp-mascot"; a.href = "#/app"; a.setAttribute("aria-label", "Zur Anmeldung – Studix starten");
  a.innerHTML = `<div class="lp-m-in">${txt}</div>`; root.appendChild(a);
  const svg = $("svg", a); if (!svg) return;
  const R = [450, 370, 560, 260], B = [330, 160, 740, 720], calm = matchMedia("(prefers-reduced-motion: reduce)").matches;   // R = Ruhe (nur die Pillen), B = ganze Animation
  let cur = R.slice(), raf = 0, open = false, openY = 0, poll = 0;
  const setVB = v => svg.setAttribute("viewBox", v.map(x => x.toFixed(1)).join(" "));
  svg.setAttribute("preserveAspectRatio", "xMaxYMax meet"); setVB(R);
  const stopAnim = () => { clearInterval(poll); try { svg.pauseAnimations(); svg.setCurrentTime(0); } catch {} };
  stopAnim();
  const go = to => {
    cancelAnimationFrame(raf); const from = cur.slice(), t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 420), e = 1 - Math.pow(1 - k, 3); cur = from.map((f, i) => f + (to[i] - f) * e); setVB(cur); if (k < 1) raf = requestAnimationFrame(step); else if (to === R) stopAnim(); };
    raf = requestAnimationFrame(step);
  };
  /* Hover öffnet und startet die Animation; sie hält im geöffneten Bild an (Pause) und bleibt offen, bis man wegscrollt */
  const openUp = () => {
    if (open) return; open = true; openY = scrollY; a.classList.add("on");
    if (!calm) { try { svg.unpauseAnimations(); } catch {} clearInterval(poll); poll = setInterval(() => { try { if (svg.getCurrentTime() >= 2.7) { svg.pauseAnimations(); clearInterval(poll); } } catch { clearInterval(poll); } }, 80); }
    else { try { svg.setCurrentTime(2.7); } catch {} }
    go(B);
  };
  const closeUp = () => { if (!open) return; open = false; a.classList.remove("on"); clearInterval(poll); go(R); };
  a.addEventListener("pointerenter", openUp); a.addEventListener("focus", openUp);
  addEventListener("scroll", () => { if (open && Math.abs(scrollY - openY) > 60) closeUp(); }, { passive: true });
}
/* Animiertes Gitter (wie Magic UI „AnimatedGridPattern“): Quadrate blenden zufällig auf Gitterfeldern ein und aus */
function mountGrid(hero) {
  const box = $(".agp", hero), emb = $("#emb", hero), N = 30, SZ = 40, NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
  svg.innerHTML = `<defs><pattern id="agp-p" width="${SZ}" height="${SZ}" patternUnits="userSpaceOnUse" x="-1" y="-1"><path d="M.5 ${SZ}V.5H${SZ}" fill="none" stroke="currentColor" stroke-opacity=".3"/></pattern></defs><rect width="100%" height="100%" fill="url(#agp-p)"/><g class="agp-sq"></g>`;
  box.appendChild(svg); const g = $(".agp-sq", svg); let cols = 1, rows = 1;
  const place = r => { r.setAttribute("x", Math.floor(Math.random() * cols) * SZ - 1 + 1); r.setAttribute("y", Math.floor(Math.random() * rows) * SZ - 1 + 1); };
  const sqs = Array.from({ length: N }, (_, i) => { const r = document.createElementNS(NS, "rect"); r.setAttribute("width", SZ - 1); r.setAttribute("height", SZ - 1); r.style.animationDelay = (i * .12).toFixed(2) + "s"; r.addEventListener("animationiteration", () => place(r)); g.appendChild(r); return r; });
  const size = () => { const top = emb.offsetTop, h = Math.round(top + emb.offsetHeight / 2); box.style.height = h + "px"; cols = Math.max(1, Math.ceil(box.clientWidth / SZ)); rows = Math.max(1, Math.ceil(h / SZ)); sqs.forEach(place); };
  new ResizeObserver(size).observe(hero); size();
}
/* Bento-Raster (nach Magic UI): Dateien-Marquee, animierte Erinnerungsliste, Strahlen zu den KI-Anbietern, Kalender */
const BENTO_FILES = [["Zellatmung.note", "In den Mitochondrien wird Glukose mit Sauerstoff zu CO₂ und Wasser abgebaut – dabei entsteht ATP."], ["Vokabeln Unit 4.deck", "48 Karten · 18 heute fällig. Spaced Repetition zeigt sie genau dann, wenn du sie fast vergessen hast."], ["Skript Analysis.pdf", "Grenzwerte, Ableitungen und Integrale – mit Markierungen und Notizen direkt im PDF."], ["Skizze Zelle.draw", "Zeichnung mit Stift, Marker und Formen – im selben Dokument wie deine Notizen."], ["Referat Geschichte.note", "Gliederung, Quellen und Stichpunkte – Studix AI fasst dir alles in fünf Punkten zusammen."]];
const BENTO_LIST = [["cal", "#2563eb", "Mathe-Klausur in 6 Tagen", "Prüfungen"], ["cards", "#0e9f6e", "18 Karteikarten fällig", "Lernen"], ["check", "#ff6a3d", "Aufgaben S. 54 morgen fällig", "Planer"], ["spark", "#5b3df5", "Quiz aus deinen Notizen bereit", "Studix AI"], ["note", "#d6431f", "Referat Biologie: Entwurf speichern", "Dokumente"], ["cal", "#8b5cf6", "Fokus-Block 25 Min. abgeschlossen", "Fokus"]];
/* Zusätzliche Landing-Abschnitte (Farbe, Bewegung, mehr Inhalt) */
const LP_SUBJ = [["Mathe", "#2563eb"], ["Biologie", "#0e9f6e"], ["Deutsch", "#ff6a3d"], ["Geschichte", "#a16207"], ["Chemie", "#8b5cf6"], ["Physik", "#0891b2"], ["Englisch", "#e11d48"], ["Informatik", "#4f46e5"], ["Recht", "#475569"], ["Medizin", "#db2777"], ["Wirtschaft", "#d97706"], ["Kunst", "#16a34a"]];
function extraHtml(go) {
  const chips = [...LP_SUBJ, ...LP_SUBJ].map(([n, c]) => `<span class="mq-chip" style="--c:${c}"><i></i>${n}</span>`).join("");
  const tiles = [
    ["#ffe9d6", "#ff6a3d", "note", "Notizen, die mitwachsen", "Schreib wie in einem Dokument: Überschriften, Tabellen, Formeln, Bilder – oder zeichne direkt dazu.", `<div class="xv xv-note"><b></b><i></i><i></i><i class="s"></i><u></u></div>`],
    ["#dff5ea", "#0e9f6e", "cards", "Karteikarten, die sitzen", "Wiederholt genau dann, wenn du kurz vorm Vergessen bist. Aus jeder Notiz in einem Klick.", `<div class="xv xv-cards"><span>Was ist ATP?</span><span>Energieträger der Zelle</span></div>`],
    ["#e0eaff", "#2563eb", "cal", "Planer ohne Chaos", "Stundenplan, Aufgaben, Prüfungen und Kalender an einem Ort – mit Erinnerungen vor der Deadline.", `<div class="xv xv-plan">${["Mo", "Di", "Mi", "Do", "Fr"].map((d, i) => `<em style="--h:${[60, 85, 45, 95, 70][i]}%">${d}</em>`).join("")}</div>`],
    ["#f0e6ff", "#8b5cf6", "spark", "Ein Tutor, der Zeit hat", "Frag Studix AI zu deinen Unterlagen: erklären, zusammenfassen, abfragen – rund um die Uhr.", `<div class="xv xv-ai"><p>Erkläre mir die Zellatmung</p><p class="a">Stell dir die Zelle als Kraftwerk vor …</p></div>`]];
  const steps = [["#ff6a3d", "1", "Sammeln", "Schreib mit, zeichne, importiere PDFs und Bilder – alles landet geordnet in deinen Fächern."], ["#2563eb", "2", "Verstehen", "Lass dir Stoff erklären, zusammenfassen und in Karteikarten und Quiz verwandeln."], ["#0e9f6e", "3", "Behalten", "Der Lernplan erinnert dich genau dann, wenn Wiederholen am meisten bringt."]];
  const uses = [["#e11d48", "Schule", "Hausaufgaben, Vokabeln und Klassenarbeiten im Griff."], ["#2563eb", "Uni", "Skripte, Zusammenfassungen und Altklausuren an einem Ort."], ["#0e9f6e", "Ausbildung", "Berichtsheft, Lernfelder und Prüfungsvorbereitung."], ["#d97706", "Selbststudium", "Eigene Ziele, Lernpläne und Fokus-Timer."]];
  return `
`;
}
function bentoHtml() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const cal = `<div class="bn-cal"><b>${now.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</b><div class="bn-cg">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<small>${d}</small>`).join("")}${"<i></i>".repeat(first)}${Array.from({ length: days }, (_, i) => `<span class="${i + 1 === now.getDate() ? "on" : [6, 14, 21].includes(i + 1) ? "ex" : ""}">${i + 1}</span>`).join("")}</div></div>`;
  const file = f => `<figure class="bn-file"><figcaption>${f[0]}</figcaption><blockquote>${f[1]}</blockquote></figure>`;
  const nd = (x, y, inner, cls = "") => `<div class="bm-n ${cls}" style="left:${x / 4.4}%;top:${y / 3}%">${inner}</div>`;
  const beams = [[60, 60, 188, 150, 0], [60, 150, 188, 150, 1], [60, 240, 188, 150, 2], [252, 150, 376, 95, 3], [252, 150, 376, 205, 4]].map(([x1, y1, x2, y2, i]) => `<path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}" fill="none" class="bm-b"/><path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}" fill="none" pathLength="100" class="bm-a" style="animation-delay:${i * .45}s"/>`).join("");
  const card = (cls, icon, name, desc, href, bg) => `<a class="bn-card ${cls}" href="${href}"><div class="bn-bg">${bg}</div><div class="bn-c"><span class="bn-i">${ic(icon)}</span><h3>${name}</h3><p>${desc}</p></div><div class="bn-cta"><span>Ausprobieren</span>${ic("arrow")}</div></a>`;
  return `<section class="sec feat" id="how"><h2>Alles, was du zum Lernen brauchst.</h2><div class="bento3">
    ${card("b-a", "file", "Alles an einem Ort", "Notizen, Skizzen, PDFs und Karteikarten – automatisch gespeichert, während du schreibst.", "#/app/docs", `<div class="bn-marq">${[0, 1].map(() => `<div class="bn-mt">${BENTO_FILES.map(file).join("")}</div>`).join("")}</div>`)}
    ${card("b-b", "cal", "Erinnerungen", "Prüfungen, fällige Karten und Hausaufgaben – du verpasst nichts mehr.", "#/app/planner", `<div class="bn-list" id="bn-list"></div>`)}
    ${card("b-c", "spark", "Studix AI mit starken Modellen", "Studix AI läuft zurzeit mit Gemini, Gemma und Groq – schnell, und für jede Frage das passende Modell.", "#/app/ai", `<div class="bm"><svg viewBox="0 0 440 300" aria-hidden="true">${beams}</svg>${nd(60, 60, ic("note"))}${nd(60, 150, ic("file"))}${nd(60, 240, ic("cards"))}${nd(220, 150, '<i class="mark"></i>', "ctr")}${nd(376, 95, GEMINI_SVG, "prv")}${nd(376, 205, GROQ_SVG, "prv")}<span class="bm-l" style="left:${376 / 4.4}%;top:${(95 - 44) / 3}%">Gemini</span><span class="bm-l" style="left:${376 / 4.4}%;top:${(205 + 44) / 3}%">Groq</span></div>`)}
    ${card("b-d", "cal", "Kalender & Planer", "Stundenplan, Prüfungen und Abgaben – alles nach Datum gefiltert.", "#/app/planner", cal)}
  </div></section>`;
}
function mountBento(root) {
  const list = $("#bn-list", root); if (!list) return; let i = 0, t = null;
  const item = d => `<div class="bn-li"><span style="background:${d[1]}">${ic(d[0])}</span><div><b>${d[2]}</b><small>${d[3]} · gerade eben</small></div></div>`;
  const push = () => { list.insertAdjacentHTML("afterbegin", item(BENTO_LIST[i++ % BENTO_LIST.length])); while (list.children.length > 6) list.lastElementChild.remove(); };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { for (let k = 3; k >= 0; k--) list.insertAdjacentHTML("beforeend", item(BENTO_LIST[k])); return; }
  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !t) { push(); t = setInterval(push, 1700); } else if (!e.isIntersecting && t) { clearInterval(t); t = null; } }), { threshold: .2 }).observe(list);
}
function renderLanding() {
  landingEl.dataset.r = 1; const go = 'href="#/app"';
  landingEl.innerHTML = `
  <header class="pnav" id="nav"><a class="logo" href="#/"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></a>
    <nav class="pnav-links"><a href="#how">Funktionen</a>${BILL.cfg?.enabled ? '<a href="#pricing">Preise</a>' : ""}<a href="#faq">Fragen</a></nav>
    <div class="pnav-r"><a class="btn accent" ${go}>App öffnen</a><button class="burger" aria-label="Menü" onclick="document.getElementById('nav').classList.toggle('open')">${ic("menu")}</button></div></header>
  <section class="hero3">
    <h1>Dein Lern- und Workspace<br>an einem Ort.</h1>
    <p class="sub">Notizen, Zeichnungen, Karteikarten, Planer und ein KI-Tutor – in einer App, die mit dir mitdenkt. Auf iPad, Handy und PC, auch offline.</p>
    <div class="hero-cta"><a class="btn accent big" ${go}>Kostenlos starten</a><a class="btn light big" href="#how">Funktionen ansehen</a></div>
    <div class="hfeat">${[["edit", "Schreiben", "Notizen, Skizzen und Formeln"], ["cards", "Lernen", "Karteikarten und Quiz, die hängenbleiben"], ["cal", "Planen", "Prüfungen und Stundenplan im Blick"], ["spark", "Studix AI", "Ein Tutor, der wirklich hilft"]].map(([i, h, p]) => `<div><span class="hf-i">${ic(i)}</span><b>${h}</b><small>${p}</small></div>`).join("")}</div>
  </section>
  <section class="mac-sec"><div class="mbp-w" id="mac"><div class="mbp"><img class="mbp-back" src="mbp-back.svg" alt="" width="2348" height="1432"><div class="mbp-scr"><iframe src="index.html?embed=1#/app/today" title="Studix App" tabindex="-1"></iframe></div><img class="mbp-front" src="mbp-front.svg" alt="MacBook mit Studix" width="2348" height="1432"></div></div></section>
  </section>
  <section class="flow" id="flow"><div class="flow-in"><div class="flow-t"><p class="flow-k">Workflow</p><h2>Vom ersten Satz bis zur Prüfung.</h2><p class="flow-p">Du schreibst eine Notiz, Studix macht daraus Karteikarten und Quiz, der Planer verteilt das Lernen auf deine Woche, und Studix AI erklärt, was hängen bleibt. Alles greift ineinander – nichts musst du übertragen.</p>
    <ol class="flow-l">${[["Schreiben", "Notizen, Skizzen und Formeln"], ["Lernen", "Karteikarten und Quiz aus deinen Notizen"], ["Planen", "Prüfungen und Stundenplan im Blick"], ["Vertiefen", "Studix AI erklärt und fragt dich ab"]].map(([h, p], n) => `<li><span>${n + 1}</span><b>${h}</b><small>${p}</small></li>`).join("")}</ol>
    <a class="btn accent big" ${go}>Kostenlos starten</a></div>
    <div class="flow-v" aria-hidden="true">${[["f113", "dokumente"], ["f62", "notiz"], ["f411", "heute"], ["f63", "karten"], ["f112", "ai"], ["f114", "planer"]].map(([c, n]) => `<img class="${c}" src="flow-${n}.webp" alt="" loading="lazy">`).join("")}</div></div></section>
  <section class="plat" id="steps"><div class="plat-in"><div class="plat-v"><img src="hand-phone.webp" alt="Studix auf dem Handy" width="1400" height="1635" loading="lazy"></div>
    <div class="plat-t"><p class="flow-k">Überall dabei</p><h2>Auf allen Plattformen. Immer dein Stand.</h2><p class="flow-p">Studix läuft auf Handy, iPad und PC – im Browser, installierbar wie eine App und auch offline. Mit Konto ist alles auf jedem Gerät gleich da, ohne dass du etwas übertragen musst.</p>
    <ul class="flow-l plat-l">${[["Handy", "Aufgaben, Karteikarten und Notizen für unterwegs"], ["iPad", "Schreiben und Zeichnen mit Apple Pencil"], ["PC & Mac", "Der volle Arbeitsplatz mit Dokumenten und Planer"]].map(([h, p]) => `<li><b>${h}</b><small>${p}</small></li>`).join("")}</ul></div></div></section>
  ${bentoHtml()}
  ${extraHtml(go)}
  ${pricingHtml(go)}
  <section class="sec" id="faq"><div class="faq-clip" aria-hidden="true"><i></i><img src="clipboard.webp" alt="" width="760" height="786" loading="lazy" decoding="async"></div><h2>Häufige Fragen</h2><div class="faq">${[["Ist Studix kostenlos?", BILL.cfg?.enabled ? `Ja, die Grundfunktionen – Notizen, Karteikarten, Quiz, Planer, Noten – sind kostenlos. Studix AI hat ein Wochenlimit: ${aiuNum(AIQ.free)} Token im Gratis-Konto, ${aiuNum(AIQ.pro)} mit Studix Study Pro.` : "Ja. Alle Funktionen sind kostenlos."], ["Wo liegen meine Daten?", "Lokal auf deinem Gerät (auch offline nutzbar). Mit einem Konto werden Notizen, Aufgaben und Karteikarten verschlüsselt übertragen und in Frankfurt am Main (EU, AWS-Region eu-central-1) bei unserem Datenbank-Anbieter Supabase gespeichert; sie sind auf allen Geräten gleich. Mit dem Backup-Export nimmst du sie jederzeit mit."], ["Funktioniert es für Schule und Studium?", "Ja – beim Start wählst du Schule oder Studium. Notensysteme (1–6, Punkte, Prozent) und Fächer bzw. Module passen sich an."], ["Kann ich es wie eine App installieren?", "Ja. Im Browser „Zum Home-Bildschirm“ (iPad/iPhone) bzw. „Installieren“ (Chrome/Edge) wählen."], ...(BILL.cfg?.enabled ? [["Wie bezahle ich und wie kündige ich?", "Über Stripe per Karte, Apple Pay, Google Pay oder Link. Die Mehrwertsteuer deines Landes ist im Preis enthalten und wird beim Bezahlen angezeigt. Kündigen kannst du jederzeit in den Einstellungen unter „Studix Study Pro“."]] : [])].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div></section>
  <footer><div><a class="logo" href="#/"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></a><p style="margin-top:12px;max-width:260px">Die Lern-App für Schule und Studium.</p></div>${[["App", "Notizen", "Zeichnen", "Karteikarten", "Quiz"], ["Planen", "Stundenplan", "Aufgaben", "Noten", "Fokus-Timer"], ["Rechtliches", ["Impressum", "legal.html#impressum"], ["Datenschutz", "legal.html#datenschutz"], ["AGB", "legal.html#agb"], ["Widerruf", "legal.html#widerruf"]]].map(c => `<div><b>${c[0]}</b>${c.slice(1).map(x => Array.isArray(x) ? `<a href="${x[1]}">${x[0]}</a>` : `<a href="#/app">${x}</a>`).join("")}</div>`).join("")}<div class="lang-sw f-lang" role="group" aria-label="Language"><b>Sprache</b><button type="button" data-lang="en">English</button><button type="button" data-lang="de">Deutsch</button><button type="button" data-lang="fr">Français</button></div></footer><div class="copy">© ${new Date().getFullYear()} Studix · Made with <svg class="heart" viewBox="0 0 24 24" aria-label="Liebe" role="img"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 4.8 6 4.5c2-.2 3.7.8 4.6 2.4l1.4 2.3 1.4-2.3c.9-1.6 2.6-2.6 4.6-2.4 3.4.3 5.1 3.9 3.6 7.3C19.5 16.4 12 21 12 21z" fill="#e11d48"/></svg> in Switzerland</div>`;
  mountMac($("#mac", landingEl));
  mountFrame(landingEl);
  mountMascot(landingEl);
  LPL.mount();
  mountBento(landingEl);
  { const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io2.unobserve(e.target); } }), { threshold: .15 }); $$(".rv", landingEl).forEach(x => io2.observe(x)); }
  { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); setTimeout(() => e.target.classList.add("on"), e.target.classList.contains("mk") ? 1300 : 700); } }), { threshold: .6 }); $$(".hl", landingEl).forEach(h => io.observe(h)); }
  $$(".pnav-links a", landingEl).forEach(a => a.addEventListener("click", () => $("#nav").classList.remove("open")));
  /* Klick auf Funktionen / Preise / Fragen und andere Anker der Startseite: weich zum Abschnitt scrollen (der Router würde sonst nach oben springen) */
  landingEl.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute("href").slice(1), t = id && !id.startsWith("/") ? document.getElementById(id) : null; if (!t || !landingEl.contains(t)) return;
    e.preventDefault(); scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + scrollY), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

/* ---------- boot ---------- */
(async function () {
  await loadData(); try { migrateFolders(); } catch {}
  /* Start nie an der Cloud aufhängen: nach spätestens 8 s wird die Seite gezeichnet, auch wenn Anmeldung/Sync noch laufen (sonst bleibt sie nach dem Google-Login weiß) */
  { let late = false; const ci = cloudInit().catch(() => {}); await Promise.race([ci, new Promise(r => setTimeout(() => { late = true; r(); }, 8000))]);
    if (late) ci.then(() => { try { $("#app").innerHTML = ""; route(); } catch {} }); }
  const cfgP = location.protocol.startsWith("http") ? fetch("/api/config", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.plus) { BILL.cfg = j.plus; try { proApply(); } catch {} }}).catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([probeServerAI(), cfgP]), new Promise(r => setTimeout(r, 1800))]);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  plusLoad(false).then(() => { try { aiuLoad().then(() => { try { const h = document.querySelector("#hdock .hd-top"); if (h && !h.querySelector(".aiu")) aiuMount(h, h.querySelector(".hd-x")); } catch {} }); refreshNav(); if (curView === "settings") renderView(); } catch {} }).catch(() => {});   // Abo live aus Stripe, ohne den Start zu verzögern
  route();
  plusReturn();
  try { Object.keys(localStorage).filter(k => /^msal\./.test(k)).forEach(k => localStorage.removeItem(k)); if (D && D.ms) { delete D.ms; save(); } } catch {}   // Reste der früheren Microsoft-Verbindung entfernen
})();
