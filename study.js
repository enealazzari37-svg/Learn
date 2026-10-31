"use strict";
/* Studix study app – shell, dashboard, documents, note editor, file viewer, AI tools */

const V = {};            // view registry: V.name(main, ...args)
let docFilter = "";      // current subject filter
const COLORS = ["#0a78ee", "#f2920c", "#0e9f6e", "#7c3aed", "#d6249f", "#dc2626", "#0891b2", "#475569", "#5b3df5", "#ff6a3d"];

/* Fach-Icons (24er-Raster, Linien) – zuweisbar pro Ordner/Fach */
const SJI = {
  book: '<path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>',
  calc: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 8h7M9 12.5h.01M12 12.5h.01M15 12.5h.01M9 16h.01M12 16h.01M15 16h.01"/>',
  flask: '<path d="M9.5 3.5h5M10.5 3.5v6L5.2 18a2 2 0 001.7 3h10.2a2 2 0 001.7-3L13.5 9.5v-6"/><path d="M8 15h8"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
  atom: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
  lang: '<path d="M4 6h9M8.5 4v2M6 6c.5 3.5 3 6 6.5 7M12 6c-.5 3.5-3 6-7 7.5"/><path d="M12.5 20l4-9 4 9M13.9 17h5.2"/>',
  code: '<path d="M8.5 8L4.5 12l4 4M15.5 8l4 4-4 4M13.5 6l-3 12"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 100 17c1.5 0 2-1 1.4-2.1-.7-1.3 0-2.9 1.6-2.9h1.7a3.3 3.3 0 003.3-3.3C20 7.4 16.4 3.5 12 3.5z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
  history: '<path d="M4 4v5h5"/><path d="M4.6 14a8 8 0 108-9.5A8 8 0 005 9"/><path d="M12 8v4.5l3 1.8"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.2 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M8.5 12h2l1.2-2.2 1.6 3.4 1-1.2h1.2"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.8 2.8 0 005 0zM19 7l-2.5 6a2.8 2.8 0 005 0z"/>',
  chart: '<path d="M4 20h16M7 17v-5M12 17V6M17 17v-8"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M6 6c3 3 3 9 0 12M18 6c-3 3-3 9 0 12"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
  pen: '<path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  cap: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.5M21.5 9.5V15"/>',
};
const sji = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SJI[k] || SJI.book}</svg>`;
const SJI_GUESS = [[/mathe|algebra|geometr|statist|analysis/i, "calc"], [/bio|medizin|natur/i, "leaf"], [/chem/i, "flask"], [/physik/i, "atom"], [/geo|erd/i, "globe"], [/englisch|franz|deutsch|latein|spanisch|italien|sprache|english/i, "lang"], [/info|program|code/i, "code"], [/musik/i, "music"], [/kunst|gestalt|zeichn|design/i, "palette"], [/geschichte|history/i, "history"], [/recht|jura|ethik|politik/i, "scale"], [/wirtschaft|bwl|vwl|finanz|buchh/i, "chart"], [/sport/i, "ball"], [/literatur|lesen|bibliothek/i, "book"]];
const sjiOf = o => (o && o.icon && SJI[o.icon]) ? o.icon : ((SJI_GUESS.find(([r]) => r.test((o && o.name) || "")) || [])[1] || "book");
const PRESETS = {
  school: ["Mathe", "Deutsch", "Englisch", "Biologie", "Chemie", "Physik", "Geschichte", "Geografie", "Informatik", "Kunst", "Musik", "Sport", "Politik", "Französisch", "Latein", "Spanisch", "Religion/Ethik"],
  uni: ["Analysis", "Lineare Algebra", "Programmierung", "Statistik", "BWL", "VWL", "Recht", "Psychologie", "Medizin", "Chemie", "Physik", "Informatik", "Literatur", "Geschichte", "Seminar"],
};
const NAVS = [["today", "Dashboard", "home"], ["docs", "Dokumente", "folder"], ["workspace", "Workspace", "team"], ["exams", "Prüfungen", "bookmark"], ["planner", "Planer", "cal"], ["grades", "Noten", "award"], ["focus", "Fokus", "timer"], ["ai", "Studix AI", "sparkO"]];

/* ---------- stats ---------- */
const addMin = m => { const k = iso(); D.stats.days[k] = (D.stats.days[k] || 0) + m; save(); };
const addRev = n => { const k = iso(); D.stats.reviews[k] = (D.stats.reviews[k] || 0) + n; save(); };
const activity = k => (D.stats.days[k] || 0) + (D.stats.reviews[k] || 0);
function streak() { let n = 0; const d = new Date(); if (!activity(iso(d))) d.setDate(d.getDate() - 1); while (activity(iso(d)) > 0) { n++; d.setDate(d.getDate() - 1); } return n; }
const dueCardCount = () => D.decks.reduce((n, d) => n + d.cards.filter(c => c.due <= iso()).length, 0);

/* ---------- onboarding ---------- */
const OB_SCALES = [   // Notensystem in einfachen Worten: links schlecht, rechts gut
  ["ch", "Schweiz", "Noten 1 bis 6 – die 6 ist die beste Note", "1", "6"],
  ["de", "Deutschland", "Noten 1 bis 6 – die 1 ist die beste Note", "6", "1"],
  ["at", "Österreich", "Noten 1 bis 5 – die 1 ist die beste Note", "5", "1"],
  ["pts", "Punkte (Oberstufe)", "0 bis 15 Punkte – 15 ist am besten", "0", "15"],
  ["pct", "Prozent / USA", "0 bis 100 % – 100 ist am besten", "0", "100 %"]];
const OB_FEATURES = [["today", "Dashboard", "Dein Tag auf einen Blick: Termine, Aufgaben, Fokus und Noten."], ["note", "Notizen & Zeichnen", "Formeln, Tabellen, Stift und Skizzen in einer Notiz."], ["ai", "Studix AI", "Erklärt, fragt ab und fasst zusammen – direkt in deinen Fächern."], ["planner", "Planer & Prüfungen", "Aufgaben, Stundenplan und Prüfungs-Countdown."], ["grades", "Noten", "Schnitt und Zielrechner für jedes Fach."], ["cards", "Karteikarten & Quiz", "Lernen mit klugen Wiederholungen."]];
const obScaleFor = cc => cc === "DE" ? "de" : cc === "AT" ? "at" : cc === "US" || cc === "CA" ? "pct" : "ch";
/* Abschluss-Seite nach dem Onboarding: Animation + was der Gratis-Plan enthält (KI mit Limit) */
function welcomeSplash(name, canBuy) {
  const lim = (typeof AIU !== "undefined" && AIU.limit) || AIQ.free, first = (name || "").trim().split(/\s+/)[0];
  const el = document.createElement("div"); el.className = "wsp";
  el.innerHTML = `<div class="wsp-in"><svg class="wsp-ck" viewBox="0 0 96 96" width="96" height="96"><circle class="wsp-c" cx="48" cy="48" r="42" pathLength="100"/><path class="wsp-v" d="M30 50l13 13 24-28" pathLength="100"/></svg>
    <h1>Alles bereit${first ? ", " + esc(first) : ""}.</h1><p class="wsp-s">Dein Studix ist eingerichtet. Das ist in deinem Gratis-Konto enthalten:</p>
    <div class="wsp-card"><div class="wsp-row"><span class="wsp-ring"><svg viewBox="0 0 24 24" width="30" height="30"><circle class="aiu-t" cx="12" cy="12" r="9"/><circle class="aiu-p wsp-rp" cx="12" cy="12" r="9" pathLength="100"/></svg></span><div><b>Studix AI · ${aiuNum(lim)} Token pro Woche</b><small>Alle Modelle nutzbar: Gemini 1×, Groq 0,5×. Deinen Verbrauch siehst du im Ring.</small></div></div>
      <div class="wsp-row"><span class="obx-ico">${ic("note")}</span><div><b>Alles andere ohne Limit</b><small>Notizen, Karteikarten, Planer, Prüfungen, Noten und Fokus-Timer.</small></div></div>
      <div class="wsp-row"><span class="obx-ico">${ic("spark")}</span><div><b>Mehr mit Studix Study Pro</b><small>Studix AI mit ${aiuNum(AIQ.pro)} Token pro Woche und längere Antworten.</small></div></div></div>
    <div class="wsp-act">${canBuy ? `<button class="obx-sec" id="wsp-pro" type="button">14 Tage Pro gratis testen</button>` : ""}<button class="obx-go" id="wsp-go" type="button">Los geht’s</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("on"));
  const close = () => { el.classList.remove("on"); setTimeout(() => el.remove(), 350); };
  $("#wsp-go", el).onclick = close; const p = $("#wsp-pro", el); if (p) p.onclick = () => { close(); plusBuy("trial"); };
}
function onboarding() {
  const O = { step: 0, country: (D.profile.country || (typeof proCountry === "function" ? proCountry() : "")) || "", name: D.profile.name || (CLOUD.user?.email || "").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()), level: D.profile.level || "school", goal: D.profile.goalMin || 45, picked: new Set(), scale: "", scaleSet: false };
  O.scale = obScaleFor(O.country);
  const root = document.createElement("div"); root.className = "obx"; $("#modal-root").appendChild(root);
  const can = typeof BILL !== "undefined" && BILL.cfg && BILL.cfg.enabled && CLOUD.user && !isPlus(), trial = (BILL.cfg && BILL.cfg.trial) || 14;
  const priceStr = () => can && BILL.cfg.monthly ? money(BILL.cfg.monthly) : "";
  const IDS = ["welcome", "features", "region", "who", "grades", "subjects", "pro"], last = IDS.length - 1;
  const dots = () => `<div class="obx-dots">${IDS.map((_, i) => `<i class="${i === O.step ? "on" : i < O.step ? "done" : ""}"></i>`).join("")}</div>`;
  const finish = async (buy) => {
    clearInterval(O.tm);
    D.profile.name = O.name.trim(); D.profile.level = O.level; D.profile.goalMin = O.goal; D.profile.scale = O.scale; D.profile.onboarded = true; if (O.country) D.profile.country = O.country;
    [...O.picked].forEach((n, i) => { const sid = uid(), c = COLORS[i % COLORS.length]; D.subjects.push({ id: sid, name: n, color: c }); D.folders.push({ id: uid(), name: n, parent: "", color: c, subjectId: sid }); }); D.foldersInit = true;
    const wid = uid(); D.docs.unshift({ id: wid, type: "note", title: "Willkommen bei Studix", subjectId: "", folderId: "", paper: "white", updated: Date.now(), created: Date.now(), text: "" });
    const w = `<h1>Willkommen bei Studix</h1><p>Das ist deine erste Notiz. Probiere die Werkzeuge oben aus:</p><ul class="chk"><li><input type="checkbox"> Text <b>fett</b>, <i>kursiv</i> oder <mark>markiert</mark> machen</li><li><input type="checkbox"> Eine Tabelle oder ein Bild einfügen</li><li><input type="checkbox"> Mit <b>Studix AI</b> eine Zusammenfassung oder Karteikarten erstellen</li><li><input type="checkbox"> Oben rechts auf <b>Zeichnen</b> wechseln und Skizzen direkt in die Notiz malen</li><li><input type="checkbox"> Im <b>Planer</b> Hausaufgaben und Prüfungen eintragen</li></ul><p>Tipp: Mit Strg/Cmd + K findest du alles blitzschnell.</p>`;
    KV.set("html:" + wid, w); D.docs[0].text = htmlToText(w);
    save(); try { proApply(); } catch {} root.remove(); go("today"); buildShell(true);
    if (buy) { toast("Alles bereit!"); setTimeout(() => plusBuy("trial"), 400); } else welcomeSplash(D.profile.name, can);
  };
  const hint = () => O.country && priceHint(O.country) ? `Studix Study Pro: <b>${priceHint(O.country)}</b> nach ${BILL.cfg.trial || 14} Tagen gratis` : "&nbsp;";
  const V = {
    welcome: () => `<div class="obx-hero" style="background-image:url(ob/photo-team.webp);background-position:center 66%"><span class="obx-hero-chip">${ic("spark")}Dein ganzes Lernen an einem Ort</span></div>
      <h1>Schön, dass du da bist.</h1><p class="obx-sub">Richte Studix in einer Minute ein – danach passt sich alles an dich an.</p>
      <label class="obx-l" for="ob-n">Wie heißt du?</label><input class="obx-in" id="ob-n" placeholder="Dein Name" value="${esc(O.name)}" autocomplete="given-name">`,
    features: () => `<span class="obx-eyebrow">Das kann Studix</span><h1>Alles, was du zum Lernen brauchst.</h1><p class="obx-sub">So sieht Studix aus – auf iPad, Handy und Computer.</p>
      <div class="obx-shots" id="ob-shots"><div class="obx-stage">${OB_FEATURES.map(([k], i) => `<img src="ob/shot-${k}.webp" alt="" class="${i ? "" : "on"}" loading="eager" draggable="false">`).join("")}</div>
      <div class="obx-cap">${OB_FEATURES.map(([k, t, d], i) => `<div class="${i ? "" : "on"}"><b>${t}</b><small>${d}</small></div>`).join("")}</div></div>`,
    region: () => `<span class="obx-eyebrow">Deine Region</span><h1>Wo lebst du?</h1><p class="obx-sub">Damit Preise und Währung für dich stimmen – CHF, EUR oder USD. Die Steuer richtet sich nach deiner Rechnungsadresse.</p>
      <div class="obx-hero obx-hero-s" style="background-image:url(ob/photo-laptop.webp)"></div><label class="obx-l" for="ob-c">Land</label><select class="obx-in obx-sel" id="ob-c"><option value="" ${O.country ? "" : "selected"} disabled>Land wählen …</option>${countryOptions(O.country)}</select>
      <p class="obx-hint" id="ob-ch">${hint()}</p>`,
    who: () => `<span class="obx-eyebrow">Über dich</span><h1>Wie lernst du?</h1><p class="obx-sub">So passen wir Fächer, Noten und Studix AI an dich an.</p>
      <div class="obx-cards" id="ob-l"><button data-l="school" class="${O.level === "school" ? "on" : ""}"><span class="obx-ico">${ic("book")}</span><b>Schüler:in</b><small>Fächer, Noten, Hausaufgaben</small></button><button data-l="uni" class="${O.level === "uni" ? "on" : ""}"><span class="obx-ico">${ic("award")}</span><b>Student:in</b><small>Module, Prüfungen, Skripte</small></button></div>
      <label class="obx-l">Tagesziel Lernzeit</label><div class="obx-chips" id="ob-g">${[15, 30, 45, 60, 90].map(m => `<button data-g="${m}" class="${O.goal === m ? "on" : ""}">${m} Min.</button>`).join("")}</div>`,
    grades: () => `<span class="obx-eyebrow">Notensystem</span><h1>Wie wird bei dir benotet?</h1><p class="obx-sub">Wähle einfach das, was bei dir gilt – du kannst es später in den Einstellungen ändern.</p>
      <div class="obx-scales" id="ob-sc">${OB_SCALES.map(([k, n, d, a, b]) => `<button data-k="${k}" class="${O.scale === k ? "on" : ""}"><span class="obx-sc-t"><b>${n}</b><small>${d}</small></span><span class="gsc"><i>${a}</i><em></em><i>${b}</i></span></button>`).join("")}</div>
      <p class="obx-hint">Links schlechter, rechts besser – so sieht dein Notenschnitt später aus.</p>`,
    subjects: () => `<span class="obx-eyebrow">Deine Auswahl</span><h1>${O.level === "uni" ? "Welche Module belegst du?" : "Welche Fächer hast du?"}</h1><p class="obx-sub">Wähle aus – Studix legt dafür Ordner an. Du kannst alles später unter „Noten“ ändern.</p>
      <div class="obx-chips wrap" id="ob-s">${PRESETS[O.level].map(x => `<button data-s="${esc(x)}" class="${O.picked.has(x) ? "on" : ""}">${esc(x)}</button>`).join("")}</div>`,
    pro: () => `<span class="obx-eyebrow">Studix Study Pro</span><h1>${can ? `${trial} Tage gratis testen` : "Mehr Studix AI mit Pro"}</h1>
      <p class="obx-sub">${can ? `Teste alles ${trial} Tage kostenlos. Danach ${priceStr()} pro Monat – jederzeit kündbar, vor Ablauf erinnern wir dich.` : `Studix Study Pro bringt Studix AI auf ${aiuNum(AIQ.pro)} Token pro Woche. Es ist bald verfügbar.`}</p>
      <div class="obx-pro"><div class="obx-pro-h"><img src="logo.svg" alt="" width="34" height="34"><b>Studix Study Pro</b><em>${can ? `${trial} Tage gratis` : "Bald verfügbar"}</em></div>
        <ul>${[`Studix AI: ${aiuNum(AIQ.pro)} Token pro Woche (+ 5-Stunden-Limit)`, "Alle kommenden Pro-Funktionen", "Jederzeit kündbar"].map(x => `<li>${ic("check")}${x}</li>`).join("")}</ul>
        ${can ? `<p class="obx-fine">${trial} Tage kostenlos, danach ${priceStr()} / Monat inkl. MwSt.</p>` : ""}</div>`,
  };
  const draw = () => {
    const id = IDS[O.step];
    root.innerHTML = `<div class="obx-card"><div class="obx-top"><a class="logo" href="#"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></a>${dots()}</div>
      <div class="obx-body" data-step="${id}">${V[id]()}</div>
      <div class="obx-foot">${O.step ? `<button class="obx-back" id="ob-b">Zurück</button>` : "<span></span>"}
        <div class="obx-acts">${O.step === last ? (can ? `<button class="obx-skip" id="ob-skip">Später</button><button class="obx-go" id="ob-buy">${trial} Tage gratis testen</button>` : `<button class="obx-go" id="ob-fin">Los geht's</button>`) : `<button class="obx-go" id="ob-n2">Weiter</button>`}</div></div></div>`;
    $("#ob-n", root)?.addEventListener("input", e => { O.name = e.target.value; }); $("#ob-n", root)?.addEventListener("keydown", e => { if (e.key === "Enter") $("#ob-n2", root).click(); });
    $$("#ob-l button", root).forEach(x => x.onclick = () => { if (O.level !== x.dataset.l) O.picked.clear(); O.level = x.dataset.l; $$("#ob-l button", root).forEach(y => y.classList.toggle("on", y === x)); });
    $$("#ob-g button", root).forEach(x => x.onclick = () => { O.goal = +x.dataset.g; $$("#ob-g button", root).forEach(y => y.classList.toggle("on", y === x)); });
    $$("#ob-sc button", root).forEach(x => x.onclick = () => { O.scale = x.dataset.k; O.scaleSet = true; $$("#ob-sc button", root).forEach(y => y.classList.toggle("on", y === x)); });
    $$("#ob-s button", root).forEach(x => x.onclick = () => { O.picked.has(x.dataset.s) ? O.picked.delete(x.dataset.s) : O.picked.add(x.dataset.s); x.classList.toggle("on"); });
    $("#ob-b", root)?.addEventListener("click", () => { O.step--; draw(); });
    $("#ob-n2", root)?.addEventListener("click", () => { if (id === "region" && !O.country) { $("#ob-c", root)?.focus(); toast("Bitte wähle dein Land aus."); return; } O.step++; draw(); });
    $("#ob-c", root)?.addEventListener("change", e => { O.country = e.target.value; D.profile.country = O.country; if (!O.scaleSet) O.scale = obScaleFor(O.country); save(); try { proApply(); } catch {} const h = $("#ob-ch", root); if (h) h.innerHTML = hint(); });
    $("#ob-fin", root)?.addEventListener("click", () => finish(false)); $("#ob-skip", root)?.addEventListener("click", () => finish(false)); $("#ob-buy", root)?.addEventListener("click", () => finish(true));
    clearInterval(O.tm); if (id === "features") { const imgs = $$(".obx-stage img", root), caps = $$(".obx-cap div", root); let k = 0; O.tm = setInterval(() => { if (!root.isConnected) return clearInterval(O.tm); imgs[k].classList.remove("on"); caps[k].classList.remove("on"); k = (k + 1) % imgs.length; imgs[k].classList.add("on"); caps[k].classList.add("on"); }, 3200); }
    setTimeout(() => $("#ob-n", root)?.focus(), 60);
  };
  draw();
}

/* ---------- shell ---------- */
let curView = "today";
function go(path) { location.hash = "#/app/" + path; }
/* Changelog: neueste Aenderungen zuerst; Karte unten in der ausgeklappten Seitenleiste */
const CHANGELOG = [
  ["2026-10-28", "Workspace", "Neue Seite: gemeinsam in Ordnern arbeiten, Mitglieder per Link einladen, Rollen für Admins."],
  ["2026-10-28", "Studix AI im Chat", "Nachdenken, Quellen und Hinweise (z. B. Limit erreicht) werden als aufklappbare Zeilen angezeigt."],
  ["2026-10-28", "Neues Aussehen", "Neues Logo und neue Schrift für „Studix“, überarbeitete Icons und Icons für Fächer."],
  ["2026-10-28", "Fokus-Timer", "Schlankerer Ring, kleinerer Zieh-Punkt und rundere Buttons."],
  ["2026-10-28", "Anmelden mit Google", "Du kannst dich jetzt mit deinem Google-Konto anmelden."],
];
const clogDate = d => new Date(d + "T12:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" });
const clogSeen = () => LS.get("lumi-clog") === CHANGELOG[0][0] + CHANGELOG[0][1];
let _clogHide = null;
const clogHtml = () => { if (_clogHide === null) { const v = CHANGELOG[0][0] + CHANGELOG[0][1]; _clogHide = LS.get("lumi-clog-shown") === v; LS.set("lumi-clog-shown", v); } return _clogHide || clogSeen() ? "" : clogBtn(); };
const clogBtn = () => `<button type="button" class="clog hide-mob" id="clog" aria-label="Changelog öffnen"><span class="clog-h"><i class="clog-ic">${ic("log")}</i><b>Neu in Studix</b>${clogSeen() ? "" : `<em class="clog-n">Neu</em>`}</span><span class="clog-l">${CHANGELOG.slice(0, 3).map(c => `<span><i></i>${esc(c[1])}</span>`).join("")}</span></button>`;
function clogOpen() {
  LS.set("lumi-clog", CHANGELOG[0][0] + CHANGELOG[0][1]); _clogHide = true; $$(".clog").forEach(e => e.remove());
  modal(`<h3>Changelog</h3><p class="note">Die letzten Änderungen an Studix.</p><div class="clog-list">${CHANGELOG.map(c => `<div class="clog-i"><small>${clogDate(c[0])}</small><b>${esc(c[1])}</b><p>${esc(c[2])}</p></div>`).join("")}</div>`);
}
function buildShell(force) {
  const app = $("#app");
  if (!force && $(".shell", app)) { refreshNav(); return; }
  app.innerHTML = `<div class="shell"><aside class="side" id="side"></aside><main class="main" id="main"></main><aside class="aipane" id="aipane" hidden></aside></div><div class="timer-pill" id="tpill" hidden></div><button class="tfab" id="tfab" aria-label="Studix AI">${ic("spark")}<span>Studix AI</span></button><div class="chat-panel" id="cpanel" hidden></div><input type="file" id="upl" multiple hidden>`;
  $("#tfab").onclick = () => toggleChatPanel();
  $("#upl").onchange = e => { uploadFiles([...e.target.files]); e.target.value = ""; };
  app.addEventListener("dragover", e => { e.preventDefault(); });
  app.addEventListener("drop", e => { if (e.dataTransfer?.files?.length && !e.target.closest("#boardwrap")) { e.preventDefault(); uploadFiles([...e.dataTransfer.files]); } });
  refreshNav();
}
let sideOpen = (() => { try { return localStorage.getItem("lumi-side") !== "0"; } catch { return true; } })();
function applyRail() { const sh = $(".shell"); if (sh) sh.classList.toggle("collapsed", !sideOpen); }
function refreshNav() {
  const s = $("#side"); if (!s) return; applyRail();
  const mob = [["today", "Dashboard", "home"], ["docs", "Dokumente", "folder"], ["exams", "Prüfungen", "book"], ["planner", "Planer", "cal"]];
  const on = k => curView === k || (k === "docs" && (curView === "doc" || curView === "design")) || (k === "board" && curView === "draw") || (k === "exams" && ["exam", "quiz", "quizrun", "cards", "deck", "study"].includes(curView));
  const SET = [["gen", "Profil", "adduser"], ["ai", "Studix AI", "spark"], ["acc", "Konto & Cloud", "globe"], ["pro", "Study Pro", "award"], ["con", "Verbindungen", "link"], ["dat", "Daten", "download"]], setMode = false;
  const profBtn = `<button class="nav-i prof hide-mob ${curView === "settings" ? "on" : ""}" id="profbtn" title="Profil"><span class="av" style="background:${meCol()}">${esc((D.profile.name || (CLOUD.user?.email) || "L").trim()[0].toUpperCase())}</span><span class="nl pn"><b>${esc(D.profile.name || "Profil")}${proBadgeHtml()}</b><small>${esc(EMBED_MODE ? "Demo-Vorschau" : CLOUD.user?.email || "Nicht angemeldet")}</small></span></button>`;
  s.innerHTML = setMode ? `<div class="rail-top"><button class="rail-tgl" id="sidetgl" aria-label="Seitenleiste ein- oder ausklappen">${ic("menu")}</button><span class="brand"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></span></div>
  <button class="nav-i setback" id="setback" title="Zurück">${ic("back")}<span class="nl">Zurück zu Studix</span></button>
  <div class="nav-lbl nl">Einstellungen</div>
  <div class="nav-grp">${SET.map(([k, l, i]) => `<button class="nav-i ${(window.__setTab || "gen") === k ? "on" : ""}" data-st="${k}" title="${l}">${ic((window.__setTab || "gen") === k ? icOn(i) : i)}<span class="nl">${l}</span></button>`).join("")}</div>
  <div class="sp hide-mob"></div><div class="side-foot">${clogHtml()}${proChipHtml()}${profBtn}</div>` : `<div class="rail-top"><span class="brand"><i class="mark"></i><span class="wm"><b>S</b>tudi<b>x</b></span></span><button class="rail-tgl" id="sidetgl" aria-label="Seitenleiste ein- oder ausklappen" title="Seitenleiste ein-/ausklappen"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="4"/><path d="M9.5 4.5v15"/></svg></button></div>
  <div class="qa-row"><button class="qa-btn" id="qabtn" type="button" title="Quick Actions"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M13 7.5l-3.5 5h3l-1 4 3.5-5h-3z"/></svg><span class="qa-t">Quick Actions</span>${/Mac|iPhone|iPad/.test(navigator.platform || "") ? "<kbd>⇧⌘K</kbd>" : ""}</button><button class="qa-s" id="qasch" type="button" title="Suche" aria-label="Suche"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><kbd>/</kbd></button></div>
  <div class="nav-grp">${NAVS.map(([k, l, i]) => `<button class="nav-i ${on(k) ? "on" : ""} ${["board", "quiz", "grades", "focus", "voice", "search", "settings", "designs"].includes(k) ? "hide-mob" : ""}" data-go="${k}" title="${l}">${ic(on(k) ? icOn(i) : i)}<span class="nl">${l}</span>${k === "cards" && dueCardCount() ? `<b class="badge">${dueCardCount()}</b>` : ""}${k === "docs" ? `<span class="nav-chev ${LS.get("lumi-docs-open") === "1" ? "open" : ""}" id="docchev" role="button" tabindex="0" aria-label="Ordner ein- oder ausklappen"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</button>${k === "docs" ? `<div class="nav-tree" id="doctree" ${LS.get("lumi-docs-open") === "1" ? "" : "hidden"}>${(() => { const T = folderTree(), last = T.map((x, i) => { for (let j = i + 1; j < T.length; j++) { if (T[j].depth < x.depth) return true; if (T[j].depth === x.depth) return false; } return true; }); return T.map(({ f, depth }, i) => { let g = ""; for (let l = 0; l < depth; l++) { let a = i; while (a >= 0 && T[a].depth > l) a--; if (a >= 0 && !last[a] && T[a].depth === l) g += `<u class="tl-v" style="left:${6 + l * 14}px"></u>`; } g += `<u class="tl-e ${last[i] ? "end" : ""}" style="left:${6 + depth * 14}px"></u>`; return `<button class="nav-f ${curView === "docs" && docFolder === f.id ? "on" : ""}" data-gf="${f.id}" style="padding-left:${26 + depth * 14}px" title="${esc(f.name)}">${g}<i class="sji" style="color:${f.color}">${sji(sjiOf(f))}</i><span class="nl">${esc(f.name)}</span></button>`; }).join(""); })() || `<p class="nav-f-e">Noch keine Ordner</p>`}</div>` : ""}`).join("")}
  <button class="nav-i mob-only" id="morebtn">${ic("more")}<span class="nl">Mehr</span></button></div>
  <div class="sp hide-mob"></div>
  <div class="side-foot">${clogHtml()}${proChipHtml()}${profBtn}</div>`;
  $$("[data-st]", s).forEach(b => b.onclick = () => window.__showSetTab && window.__showSetTab(b.dataset.st));
  $("#setback", s) && ($("#setback", s).onclick = () => go("today"));
  $$("[data-go]", s).forEach(b => b.onclick = () => { if (b.dataset.go === "docs") docFolder = ""; go(b.dataset.go); });
  const dch = $("#docchev", s); if (dch) { const tg = e => { e.stopPropagation(); e.preventDefault(); const open = LS.get("lumi-docs-open") !== "1"; LS.set("lumi-docs-open", open ? "1" : "0"); dch.classList.toggle("open", open); $("#doctree", s).hidden = !open; }; dch.onclick = tg; dch.onkeydown = e => { if (e.key === "Enter" || e.key === " ") tg(e); }; }
  $$("[data-gf]", s).forEach(b => b.onclick = () => { docFolder = b.dataset.gf; docQuery = ""; go("docs/" + b.dataset.gf); });
  $("#newbtn", s) && ($("#newbtn", s).onclick = e => newMenu(e.currentTarget));
  $("#qabtn", s) && ($("#qabtn", s).onclick = e => newMenu(e.currentTarget)); $("#qasch", s) && ($("#qasch", s).onclick = () => go("search"));
  $("#profbtn", s).onclick = e => profileMenu(e.currentTarget);
  $("#clog", s) && ($("#clog", s).onclick = clogOpen);
  $("#sidetgl", s).onclick = () => { sideOpen = !sideOpen; try { localStorage.setItem("lumi-side", sideOpen ? "1" : "0"); } catch {} applyRail(); };
  $("#morebtn", s) && ($("#morebtn", s).onclick = e => menu(e.currentTarget, [...NAVS, ["settings", "Einstellungen", "gear"]].filter(n => !mob.find(m => m[0] === n[0])).map(([k, l, i]) => ({ label: l, icon: i, fn: () => go(k) }))));
}
function newMenu(anchor) {
  menu(anchor, [
    { label: "Mit Studix AI erstellen …", icon: "spark", fn: () => openAiCommand() }, "-", { label: "Neues Dokument (A4)", icon: "newnote", fn: () => docDialog("note") }, { label: "Neues Whiteboard", icon: "brush", fn: () => docDialog("draw") }, { label: "Neues Design (Plakat, Flyer …)", icon: "image", fn: () => dsCreateDialog() }, { label: "Neue Datenbank", icon: "table", fn: () => newDatabaseMenu($("#newbtn")) }, { label: "Neuer Ordner", icon: "folder", fn: () => newFolder() },
    { label: "Datei hochladen", icon: "upload", fn: () => $("#upl").click() }, "-",
    { label: "Karteikarten-Stapel", icon: "cards", fn: () => newDeck() }, { label: "Aufgabe / Prüfung", icon: "todo", fn: () => taskModal() },
    { label: isUni() ? "Neues Modul" : "Neues Fach", icon: "star", fn: newSubject },
  ]);
}
async function newSubject() {
  if (desk() && curView === "docs" && !docFolder) {
    const name = uniqName(isUni() ? "Neues Modul" : "Neues Fach", D.folders.map(f => f.name)), sub = { id: uid(), name, color: COLORS[D.subjects.length % COLORS.length] }, fid = uid();
    D.subjects.push(sub); D.folders.push({ id: fid, name, parent: "", color: sub.color, subjectId: sub.id }); save(); refreshNav(); renderView();
    setTimeout(() => inlineRename($(`.fold[data-f="${fid}"] .ftxt b`), name, v => { sub.name = v; const f = folderOf(fid); if (f) f.name = v; save(); refreshNav(); renderView(); }), 80); return;
  }
  const uni = isUni(), word = uni ? "Modul" : "Fach", sugg = uni ? ["Analysis", "Informatik", "Statistik", "Recht", "BWL"] : ["Mathe", "Deutsch", "Englisch", "Biologie", "Geschichte"];
  let col = COLORS[D.subjects.length % COLORS.length];
  const r = await new Promise(res => {
    const { el, close } = modal(`<div class="dh"><span class="di" id="ns-i" style="--c:${col}">${ic("star")}</span><div><h3>Neues ${word}</h3><p class="note">Alles dazu landet gesammelt in einem Ordner.</p></div></div>
    <input class="field big" id="ns-n" placeholder="Name, z. B. ${sugg[0]}" maxlength="60" autocomplete="off">
    <div class="nd-sugg">${sugg.map(x => `<button type="button" class="chip" data-s="${x}">${x}</button>`).join("")}</div>
    <label class="lbl">Farbe</label><div class="swatches" id="ns-c">${COLORS.slice(0, 10).map(c => `<button type="button" data-c="${c}" class="${c === col ? "on" : ""}" style="--c:${c}" aria-label="Farbe"></button>`).join("")}</div>
    <div class="mf"><button class="btn ghost" data-c>Abbrechen</button><button class="btn accent" data-o>Hinzufügen</button></div>`, "sheet");
    const f = $("#ns-n", el); setTimeout(() => f.focus(), 40); let done = false; const fin = v => { if (done) return; done = true; close(); res(v); };
    $$("[data-s]", el).forEach(b => b.onclick = () => { f.value = b.dataset.s; f.focus(); });
    $$("#ns-c button", el).forEach(b => b.onclick = () => { col = b.dataset.c; $$("#ns-c button", el).forEach(x => x.classList.toggle("on", x === b)); $("#ns-i", el).style.setProperty("--c", col); });
    const ok = () => f.value.trim() ? fin(f.value.trim()) : (f.focus(), f.classList.add("shake"), setTimeout(() => f.classList.remove("shake"), 400));
    $("[data-c]", el).onclick = () => fin(null); $(".x", el).onclick = () => fin(null); $("[data-o]", el).onclick = ok; f.onkeydown = e => { if (e.key === "Enter") ok(); };
  });
  if (!r) return;
  const sub = { id: uid(), name: r, color: col }; D.subjects.push(sub); D.folders.push({ id: uid(), name: sub.name, parent: "", color: sub.color, subjectId: sub.id }); save(); refreshNav(); renderView();
}
function subjectSelect(id = "", cls = "") { return `<select class="field slim ${cls}">${`<option value="">Kein ${isUni() ? "Modul" : "Fach"}</option>`}${D.subjects.map(s => `<option value="${s.id}" ${s.id === id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`; }

/* ---------- new document dialog ---------- */
const TEMPLATES = [
  ["blank", "Leer", ""],
  ["lecture", "Mitschrift", "<h1>Thema</h1><p>Datum · Lehrkraft / Dozent:in</p><h2>Stichwörter</h2><ul><li><br></li></ul><h2>Notizen</h2><p><br></p><h2>Zusammenfassung</h2><p><br></p>"],
  ["summary", "Zusammenfassung", "<h1>Zusammenfassung</h1><h2>Kernaussagen</h2><ul><li><br></li><li><br></li><li><br></li></ul><h2>Wichtige Begriffe</h2><table><tbody><tr><td><b>Begriff</b></td><td><b>Erklärung</b></td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>Fragen</h2><p><br></p>"],
  ["plan", "Lernplan", "<h1>Lernplan</h1><p>Prüfung am: </p><table><tbody><tr><td><b>Tag</b></td><td><b>Thema</b></td><td><b>Dauer</b></td></tr><tr><td>Montag</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>Dienstag</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>Mittwoch</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>Donnerstag</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>Freitag</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>"],
  ["tasks", "Aufgabenblatt", '<h1>Aufgaben</h1><ul class="chk"><li><input type="checkbox">&nbsp;Aufgabe 1</li><li><input type="checkbox">&nbsp;Aufgabe 2</li><li><input type="checkbox">&nbsp;Aufgabe 3</li></ul><h2>Lösungen</h2><p><br></p>'],
  ["protocol", "Protokoll", "<h1>Protokoll</h1><p>Datum · Teilnehmende</p><h2>Ziel</h2><p><br></p><h2>Durchführung</h2><p><br></p><h2>Ergebnis</h2><p><br></p>"],
];
const PAPERS = [["white", "Leer"], ["lines", "Liniert"], ["grid", "Kariert"], ["dots", "Punkte"]];
/* Am PC: ohne Popup sofort anlegen und direkt an Ort und Stelle benennen */
const desk = () => matchMedia("(min-width:901px)").matches;
let renameNext = false;
function inlineRename(el, cur, onSave) {
  if (!el) return false; const inp = document.createElement("input"); inp.className = "inl-rn"; inp.value = cur; inp.maxLength = 60; inp.setAttribute("aria-label", "Name");
  const keep = el.innerHTML; el.textContent = ""; el.appendChild(inp); inp.focus(); inp.select();
  ["click", "mousedown", "keyup"].forEach(t => inp.addEventListener(t, e => e.stopPropagation()));
  let done = false; const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v) onSave(v); else el.innerHTML = keep; };
  inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } else if (e.key === "Escape") fin(false); };
  return true;
}
const uniqName = (base, list) => { let n = base, i = 2; while (list.some(x => x.toLowerCase() === n.toLowerCase())) n = base + " " + i++; return n; };
function docDialog(kind = "note", pre = null) {
  if (limitHit(kind === "draw" ? "board" : "doc")) return;
  if (kind === "note" && !pre && desk()) { renameNext = true; return newNote("", "", "Unbenanntes Dokument", docFolder, D.profile.paper || "white", D.profile.pageMode !== false); }
  if (kind === "draw") return boardDialog(pre);
  const isNote = kind === "note"; let folder = pre && pre.folder !== undefined ? pre.folder : docFolder, paper = isNote ? (D.profile.paper || "white") : "grid", tpl = "blank", pages = D.profile.pageMode !== false;
  const fname = () => { const fp = folderPath(folder); return fp.length ? fp[fp.length - 1].name : ""; };
  const { el, close } = modal(`<div class="nd"><div class="nd-sw seg" role="tablist" aria-label="Art"><button type="button" class="on" role="tab">Dokument</button><button type="button" role="tab" id="nd-swb">Whiteboard</button><button type="button" role="tab" id="nd-swd">Design</button></div>
  <input class="nd-name" id="nd-n" placeholder="Unbenanntes Dokument" autocomplete="off" maxlength="80">
  <div class="nd-where">${ic("folder")}<span>${esc(fname() || "Dokumente")}</span></div>
  <label class="lbl">Format</label><div class="chips nd-fmt" id="nd-fm"><button type="button" class="chip ${(D.profile.pageMode !== false) ? "on" : ""}" data-k="a4">A4-Seiten</button><button type="button" class="chip ${D.profile.pageMode === false ? "on" : ""}" data-k="endless">Endlos</button></div><label class="lbl">${isNote ? "Papier" : "Hintergrund"}</label><div class="papers" id="nd-p">${PAPERS.map(([k, l]) => `<button type="button" data-k="${k}" class="pp ${k === paper ? "on" : ""}"><i class="pv ${k}"></i><b>${l}</b></button>`).join("")}</div>
  <div class="mf"><button class="btn ghost" data-c>Abbrechen</button><button class="btn accent" id="nd-go">Erstellen</button></div></div>`, "sheet nd-modal");
  const nameIn = $("#nd-n", el); if (pre && pre.name) nameIn.value = pre.name; $("#nd-swb", el).onclick = () => { const n = nameIn.value, f = folder; close(); boardDialog({ name: n, folder: f }); }; $("#nd-swd", el).onclick = () => { const n = nameIn.value, f = folder; close(); dsCreateDialog({ name: n, folder: f }); };
  setTimeout(() => nameIn.focus(), 40);
  $$("#nd-fm .chip", el).forEach(b => b.onclick = () => { pages = b.dataset.k === "a4"; $$("#nd-fm .chip", el).forEach(x => x.classList.toggle("on", x === b)); });
  $$("#nd-p .pp", el).forEach(b => b.onclick = () => { paper = b.dataset.k; $$("#nd-p .pp", el).forEach(x => x.classList.toggle("on", x === b)); });
  $$("#nd-t .chip", el).forEach(b => b.onclick = () => { tpl = b.dataset.t; $$("#nd-t .chip", el).forEach(x => x.classList.toggle("on", x === b)); const t = TEMPLATES.find(x => x[0] === tpl); if (!nameIn.value.trim() && tpl !== "blank") nameIn.placeholder = t[1]; });
  $("[data-c]", el).onclick = close;
  const go2 = async () => {
    const title = nameIn.value.trim() || (isNote ? (TEMPLATES.find(x => x[0] === tpl)[0] === "blank" ? "Unbenanntes Dokument" : TEMPLATES.find(x => x[0] === tpl)[1]) : "Neue Zeichnung"); close();
    if (isNote) { D.profile.paper = paper; await newNote("", TEMPLATES.find(x => x[0] === tpl)[2], title, folder, paper, pages); }
    else { const id = uid(); D.docs.unshift({ id, type: "draw", title, subjectId: subjectOfFolder(folder), folderId: folder, updated: Date.now(), created: Date.now(), thumb: "" }); await KV.set("draw:" + id, { strokes: [], bg: paper === "white" ? "blank" : paper, H: 1000 }); save(); go("draw/" + id); }
  };
  $("#nd-go", el).onclick = go2; nameIn.onkeydown = e => { if (e.key === "Enter") go2(); };
}

/* ---------- folders ---------- */
let docFolder = "";
const folderOf = id => D.folders.find(f => f.id === id);
function folderPath(id) { const p = []; let f = folderOf(id), guard = 0; while (f && guard++ < 20) { p.unshift(f); f = folderOf(f.parent); } return p; }
function folderTree(parent = "", depth = 0, skip = "") { return D.folders.filter(f => (f.parent || "") === parent && f.id !== skip).sort((a, b) => a.name.localeCompare(b.name)).flatMap(f => [{ f, depth }, ...folderTree(f.id, depth + 1, skip)]); }
const subjectOfFolder = id => folderPath(id).map(f => f.subjectId).filter(Boolean).pop() || "";
const folderCount = id => D.docs.filter(d => d.folderId === id).length + D.folders.filter(f => f.parent === id).length;
function migrateFolders() {
  if (D.foldersInit) return; D.foldersInit = true;
  D.subjects.forEach(s => { if (!D.folders.find(f => f.subjectId === s.id)) D.folders.push({ id: uid(), name: s.name, parent: "", color: s.color, subjectId: s.id }); });
  D.docs.forEach(d => { if (d.subjectId && !d.folderId) d.folderId = D.folders.find(f => f.subjectId === d.subjectId)?.id || ""; }); save();
}
async function newFolder(parent = docFolder) {
  const root = !parent;
  if (desk() && curView === "docs") {
    const name = uniqName("Neuer Ordner", D.folders.filter(f => (f.parent || "") === (parent || "")).map(f => f.name)), fid = uid();
    D.folders.push({ id: fid, name, parent: parent || "", color: COLORS[D.folders.length % COLORS.length], subjectId: "" }); save(); refreshNav(); renderView();
    setTimeout(() => inlineRename($(`.fold[data-f="${fid}"] .ftxt b`), name, v => { const f = folderOf(fid); if (f) f.name = v; save(); refreshNav(); renderView(); }), 80); return;
  }
  const r = await new Promise(res => {
    const { el, close } = modal(`<div class="dh"><span class="di">${ic("folder")}</span><div><h3>${root ? "Neuer Ordner" : "Neuer Unterordner"}</h3><p class="note">${root ? "Zum Sortieren deiner Dokumente." : "Liegt in „" + esc(folderOf(parent)?.name || "") + "“."}</p></div></div><input class="field big" id="nf-n" placeholder="Name, z. B. Mathe oder Deutsch" maxlength="60" autocomplete="off">${root ? `<label class="sw-row nf-sub"><span>Ist ein ${isUni() ? "Modul" : "Fach"}<small>erscheint auch unter Noten</small></span><input type="checkbox" id="nf-s" class="sw"></label>` : ""}<div class="mf"><button class="btn ghost" data-c>Abbrechen</button><button class="btn accent" data-o>Erstellen</button></div>`, "sheet");
    const f = $("#nf-n", el); setTimeout(() => f.focus(), 30);
    let done = false; const fin = v => { if (done) return; done = true; close(); res(v); };
    const ok = () => fin({ name: f.value, subject: !!$("#nf-s", el)?.checked });
    $("[data-c]", el).onclick = () => fin(null); $("[data-o]", el).onclick = ok; $(".x", el).onclick = () => fin(null); f.onkeydown = e => { if (e.key === "Enter") ok(); };
  });
  if (!r || !r.name.trim()) return;
  const name = r.name.trim();
  let sub = root && D.subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (!sub && root && r.subject) { sub = { id: uid(), name, color: COLORS[D.subjects.length % COLORS.length] }; D.subjects.push(sub); }
  D.folders.push({ id: uid(), name, parent: parent || "", color: sub?.color || COLORS[D.folders.length % COLORS.length], subjectId: sub?.id || "" }); save(); refreshNav(); if (curView === "docs") renderView();
}
function pickFolder(title, exclude = "") {
  return new Promise(res => {
    const rows = [{ f: { id: "", name: "Dokumente (oberste Ebene)", color: "#8a8a98" }, depth: 0 }, ...folderTree("", 0, exclude)];
    const { el, close } = modal(`<h3>${esc(title)}</h3><div class="pick">${rows.map(({ f, depth }) => `<button class="pk" data-f="${f.id}" style="padding-left:${14 + depth * 20}px">${ic("folder")}<i style="background:${f.color}"></i>${esc(f.name)}</button>`).join("")}</div>`);
    let d = false; $$("[data-f]", el).forEach(b => b.onclick = () => { d = true; close(); res(b.dataset.f); }); $(".x", el).addEventListener("click", () => { if (!d) res(null); });
  });
}
function moveDoc(d, folderId) { d.folderId = folderId || ""; const sid = subjectOfFolder(folderId); if (sid) d.subjectId = sid; d.updated = Date.now(); save(); }
function folderMenu(btn, f) {
  menu(btn, [
    { label: "Öffnen", icon: "folder", fn: () => go("docs/" + f.id) },
    { label: "Umbenennen", icon: "pen", fn: async () => { const done = v => { f.name = v; save(); refreshNav(); renderView(); }; if (!(desk() && inlineRename($(`.fold[data-f="${f.id}"] .ftxt b`), f.name, done))) { const n = await ask("Ordner umbenennen", { value: f.name }); if (n?.trim()) done(n.trim()); } } },
    { label: "Farbe & Icon", icon: "brush", fn: () => { const { el } = modal(`<h3>Farbe & Icon</h3><div class="chips" style="gap:12px">${COLORS.map(c => `<button class="cdot ${c === f.color ? "on" : ""}" data-c="${c}" style="background:${c};width:38px;height:38px"></button>`).join("")}</div><p class="note" style="margin:18px 0 8px">Icon</p><div class="sji-grid">${Object.keys(SJI).map(k => `<button type="button" class="sji-b ${k === sjiOf(f) ? "on" : ""}" data-i="${k}" style="--c:${f.color}" aria-label="${k}">${sji(k)}</button>`).join("")}</div>`); const sub = D.subjects.find(x => x.id === f.subjectId), paint = () => { save(); refreshNav(); if (curView === "docs") V.docs($("#main")); };
      $$("[data-c]", el).forEach(b => b.onclick = () => { f.color = b.dataset.c; if (sub) sub.color = f.color; $$("[data-c]", el).forEach(x => x.classList.toggle("on", x === b)); $$(".sji-b", el).forEach(x => x.style.setProperty("--c", f.color)); paint(); });
      $$(".sji-b", el).forEach(b => b.onclick = () => { f.icon = b.dataset.i; if (sub) sub.icon = f.icon; $$(".sji-b", el).forEach(x => x.classList.toggle("on", x === b)); paint(); }); } },
    { label: "Verschieben…", icon: "upload", fn: async () => { const t = await pickFolder("Ordner verschieben nach…", f.id); if (t !== null && t !== f.parent) { f.parent = t; save(); refreshNav(); renderView(); } } },
    "-", { label: "Ordner löschen", icon: "trash", danger: true, fn: async () => { if (!(await confirmBox(`Ordner „${f.name}“ löschen? Der Inhalt wandert eine Ebene nach oben.`))) return; D.docs.forEach(d => { if (d.folderId === f.id) d.folderId = f.parent || ""; }); D.folders.forEach(x => { if (x.parent === f.id) x.parent = f.parent || ""; }); D.folders = D.folders.filter(x => x !== f); save(); if (docFolder === f.id) docFolder = f.parent || ""; refreshNav(); go("docs/" + docFolder); } },
  ]);
}

/* ---------- documents CRUD ---------- */
async function newNote(subjectId = "", html = "", title = "Unbenanntes Dokument", folderId = docFolder, paper = "", pagesOn) {
  const id = uid(); D.docs.unshift({ id, type: "note", ...(pagesOn === undefined ? {} : { pagesOn }), title, subjectId: subjectId || subjectOfFolder(folderId), folderId, paper: paper || D.profile.paper || "white", updated: Date.now(), created: Date.now(), text: htmlToText(html) });
  await KV.set("html:" + id, html || ""); save(); go("doc/" + id);
}
async function thumbOf(file) {
  try { const bmp = await createImageBitmap(file); const s = 360 / Math.max(bmp.width, bmp.height, 360), c = document.createElement("canvas"); c.width = Math.round(bmp.width * Math.min(1, s)); c.height = Math.round(bmp.height * Math.min(1, s)); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .7); } catch { return ""; }
}
async function uploadFiles(files) {
  let n = 0;
  for (const f of files) {
    if (limitHit("doc")) break;
    if (f.size > 60 * 1024 * 1024) { toast(f.name + " ist größer als 60 MB"); continue; }
    const id = uid(); await KV.set("blob:" + id, f);
    D.docs.unshift({ id, type: "file", title: f.name, mime: f.type, size: f.size, subjectId: subjectOfFolder(docFolder), folderId: docFolder, updated: Date.now(), created: Date.now(), thumb: /^image\//.test(f.type) ? await thumbOf(f) : "" }); n++;
  }
  save(); if (n) { toast(n + (n > 1 ? " Dateien" : " Datei") + " hochgeladen"); if (curView === "docs") renderView(); refreshNav(); }
}
async function deleteDoc(d) {
  if (!(await confirmBox(`„${d.title}“ wirklich löschen?`))) return;
  D.docs = D.docs.filter(x => x.id !== d.id); ["html:", "blob:", "draw:", "ink:", "ann:", "db:", "aud:"].forEach(p => KV.del(p + d.id)); save(); toast("Gelöscht"); refreshNav();
}
const fileIcon = d => { const e = (d.title.split(".").pop() || "").toLowerCase(); return /pdf/.test(e) ? ["PDF", "#e5484d"] : /docx?/.test(e) ? ["DOC", "#2563eb"] : /pptx?/.test(e) ? ["PPT", "#f97316"] : /xlsx?|csv/.test(e) ? ["XLS", "#16a34a"] : /txt|md/.test(e) ? ["TXT", "#64748b"] : [e.slice(0, 4).toUpperCase() || "FILE", "#64748b"]; };
const DTYPES = [["all", "Alle"], ["note", "Dokumente"], ["pdf", "PDFs"], ["db", "Datenbanken"], ["draw", "Whiteboards"], ["design", "Designs"], ["cards", "Karteikarten"], ["file", "Dateien"]];
/* Untermenüs im Stil der Einstellungs-Leiste (.settabs.sdock): runde Icon-Knöpfe, Name als Tooltip */
const SDK = {
  all: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  note: '<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V5A1.5 1.5 0 017 3.5z"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5"/>',
  pdf: '<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V5A1.5 1.5 0 017 3.5z"/><path d="M14 3.5V8h4.5"/>',
  db: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 10h17M9.5 10v9"/>',
  draw: '<path d="M4 20l3.6-.8L19 7.8a2.1 2.1 0 00-3-3L4.8 16.4z"/><path d="M14.5 6.5l3 3"/>',
  design: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  cards: '<rect x="5" y="8.5" width="14" height="10" rx="2.5"/><path d="M7.5 5.5h9"/>',
  file: '<path d="M12.5 7.5l-5 5a2.5 2.5 0 003.5 3.5l6-6a4 4 0 00-5.7-5.7l-6 6a5.5 5.5 0 007.8 7.8l4.4-4.4"/>',
  week: '<rect x="3" y="4.5" width="18" height="15.5" rx="3"/><path d="M3 9.5h18M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M8.5 12.2l2.5 2.5 4.6-5"/>',
  tt: '<rect x="3" y="4.5" width="18" height="15.5" rx="3"/><path d="M3 9.5h18M9 9.5V20M15 9.5V20"/>',
  cal: '<rect class="cb" x="3.2" y="5" width="17.6" height="15.8" rx="5"/><path d="M3.2 10.2h17.6M8 3.2v3.4M16 3.2v3.4M13 15.4h3"/>',
  day: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  month: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
  quarter: '<path d="M12 3.5l8.5 4.6-8.5 4.6-8.5-4.6z"/><path d="M3.5 12.4l8.5 4.6 8.5-4.6M3.5 16.4l8.5 4.6 8.5-4.6"/>',
};
Object.assign(SDK, {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', filter: '<path d="M4 7h16M7 12h10M10 17h4"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1-1.6 2.2M12 16.6h.01"/>', goal: '<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.1 7.2 18.8l1-5.4-4-3.7 5.4-.7z"/>',
  spark: '<path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
  instr: '<path d="M5 7h10M5 12h14M5 17h8"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', edit: '<path d="M4 20l3.6-.8L19 7.8a2.1 2.1 0 00-3-3L4.8 16.4z"/><path d="M14.5 6.5l3 3"/>',
});
/* Seitenkopf wie in den Einstellungen: Titel links (bei Unterordnern mit Pfad), Werkzeuge als Icon-Leiste rechts, feine Linie darunter */
const dkAct = (k, label, attrs = "") => `<button type="button" ${attrs} aria-label="${label}" title="${label}"><span class="sdk-i"><svg viewBox="0 0 24 24">${SDK[k] || ""}</svg></span></button>`;
const pageHead = (crumb, tools = "", attrs = "") => `<div class="setcrumb pagehead">${crumb}${tools ? `<nav class="settabs sdock" ${attrs}>${tools}</nav>` : ""}</div>`;
const sdkBtn = (k, label, attrs = "", extra = "") => `<button type="button" role="tab" ${attrs} aria-label="${label}" title="${label}"><span class="sdk-i"><svg viewBox="0 0 24 24">${SDK[k] || SDK.file}</svg></span>${extra}</button>`;

const docKind = d => d.type === "deck" ? "cards" : d.type === "note" ? "note" : d.type === "db" ? "db" : d.type === "draw" ? "draw" : d.type === "design" ? "design" : /pdf$/i.test(d.title) || d.mime === "application/pdf" ? "pdf" : "file";
const KIND_L = { cards: "Karteikarten", note: "Dokument", db: "Datenbank", draw: "Whiteboard", design: "Design", pdf: "PDF", file: "Datei" };
const KIND_I = { cards: "cards", note: "note", db: "table", draw: "brush", design: "image", pdf: "file", file: "file" };
function docRow(d) {
  const s = subj(d.subjectId), k = docKind(d);
  return `<div class="drow" data-d="${d.id}" draggable="true"><span class="dr-i">${ic(KIND_I[k])}${d.share ? `<i class="shbadge" title="Geteilt">${ic("link")}</i>` : ""}</span><span class="dr-t"><b>${d.pinned ? `<i class="pin">${ic("star")}</i>` : ""}${esc(d.title)}</b><small>${esc(docPath(d) || "Home")}</small></span><span class="dr-k">${KIND_L[k]}</span><span class="dr-s">${s ? `<i class="sdot" style="background:${s.color}"></i>${esc(s.name)}` : ""}</span><span class="dr-a">${fmtAgo(d.updated)}</span><button class="dmore" data-m="${d.id}" aria-label="Mehr">${ic("more")}</button></div>`;
}
function docCard(d) {
  const s = subj(d.subjectId);
  let thumb;
  if (d.type === "note") thumb = `<div class="th note-th">${esc((d.text || "").slice(0, 150)) || `<span class="ph"></span>`}</div>`;
  else if (d.type === "db") thumb = `<div class="th file-th"><b style="background:#5b3df5">${ic("table")}</b></div>`;
  else if (d.type === "design") thumb = `<div class="th" style="background:#eceef3 center/contain no-repeat url(${d.thumb || ""})"></div>`;
  else if (d.type === "draw") thumb = `<div class="th" style="background:#fff center/contain no-repeat url(${d.thumb || ""})"></div>`;
  else if (d.thumb) thumb = `<div class="th" style="background:#f3f3f5 center/cover url(${d.thumb})"></div>`;
  else { const [l, c] = fileIcon(d); thumb = `<div class="th file-th"><b style="background:${c}">${esc(l)}</b></div>`; }
  return `<div class="doc" data-d="${d.id}" draggable="true"><span class="tbadge">${ic(KIND_I[docKind(d)])}${KIND_L[docKind(d)]}</span>${thumb}<div class="dm"><div class="dt">${d.pinned ? `<span class="pin">${ic("star")}</span>` : ""}${esc(d.title)}</div><div class="ds">${s ? `<span class="sdot" style="background:${s.color}"></span>${esc(s.name)}` : ""}<span class="ago">${s ? " · " : ""}${fmtAgo(d.updated)}</span>${d.share ? `<span class="shi" title="Geteilt">${ic("link")}</span>` : ""}</div></div><button class="dmore" data-m="${d.id}" aria-label="Mehr">${ic("more")}</button></div>`;
}
function docMenu(btn, d) {
  menu(btn, [
    { label: "Öffnen", icon: "file", fn: () => openDoc(d) },
    { label: "Umbenennen", icon: "pen", fn: async () => { const done = v => { d.title = v; d.updated = Date.now(); save(); renderView(); }; if (!(desk() && inlineRename($(`.drow[data-d="${d.id}"] .dr-t b, .doc[data-d="${d.id}"] .dt`), d.title, done))) { const n = await ask("Umbenennen", { value: d.title }); if (n?.trim()) done(n.trim()); } } },
    { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); renderView(); } },
    { label: "Verschieben…", icon: "upload", fn: async () => { const t = await pickFolder("Verschieben nach…"); if (t !== null) { moveDoc(d, t); refreshNav(); renderView(); toast("Verschoben"); } } },
    ...D.subjects.length ? [{ label: "Fach zuordnen…", icon: "folder", fn: () => { const { el, close } = modal(`<h3>Fach zuordnen</h3><div class="chips">${[{ id: "", name: "Kein Fach", color: "#999" }, ...D.subjects].map(s => `<button class="chip" data-s="${s.id}"><i class="sdot" style="background:${s.color}"></i>${esc(s.name)}</button>`).join("")}</div>`); $$("[data-s]", el).forEach(b => b.onclick = () => { d.subjectId = b.dataset.s; save(); close(); renderView(); }); } }] : [],
    "-", { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); renderView(); } },
  ]);
}
const openDoc = d => go((d.type === "draw" ? "draw/" : "doc/") + d.id);
const docPath = d => folderPath(d.folderId).map(f => f.name).join(" › ");

/* ---------- views: today ---------- */
const ringSvg = (p, color, val, label) => `<div class="rg"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rbg"/><circle cx="60" cy="60" r="48" class="rfg" style="stroke:${color};stroke-dasharray:${Math.max(0, Math.min(100, p)) * 3.016} 302"/></svg><b>${val}</b><small>${label}</small></div>`;
function weekData() { return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { l: d.toLocaleDateString("de-CH", { weekday: "short" }).replace(".", ""), v: activity(iso(d)), today: i === 6 }; }); }
function practiceExam(t) {
  const doc = D.docs.find(x => x.id === t.docId);
  if (doc) return docText(doc).then(txt => aiTool("quiz", txt, { title: t.title, subjectId: t.subjectId }));
  quizPrefill = { topic: t.title }; go("quiz");
}
function countUp(el, to, ms = 900) { if (!el) return; const t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function dailyCtx({ lessons, evToday, exams, due, mins, goal }) {
  const t = iso(), open = D.tasks.filter(x => !x.done);
  return [`Datum: ${t}`, `Stunden heute: ${lessons.map(e => `${e.start} ${e.title || subj(e.subjectId)?.name || "Stunde"}`).join(", ") || "keine"}`, `Termine: ${evToday.map(e => `${e.time || ""} ${e.title}`).join(", ") || "keine"}`, `Offene Aufgaben: ${open.slice(0, 10).map(x => `${x.title}${x.due ? " (bis " + x.due + ")" : ""}`).join("; ") || "keine"}`, `Prüfungen: ${exams.map(x => `${x.title} in ${daysUntil(x.due)} Tagen`).join("; ") || "keine anstehend"}`, `Fällige Karteikarten: ${due}`, `Gelernt heute: ${mins} von ${goal} Minuten`].join("\n");
}
function dailyLocal({ lessons, evToday, open, exams, due, mins, goal }) {
  const parts = [], t = open.filter(x => x.due && daysUntil(x.due) <= 0);
  if (exams[0]) parts.push(`${exams[0].title} steht in ${daysUntil(exams[0].due)} ${daysUntil(exams[0].due) === 1 ? "Tag" : "Tagen"} an.`);
  const n = lessons.length + evToday.length; if (n) parts.push(`Heute hast du ${n} ${n === 1 ? "Termin" : "Termine"}.`);
  if (t.length) parts.push(`${t.length} ${t.length === 1 ? "Aufgabe ist" : "Aufgaben sind"} heute fällig – fang mit „${t[0].title}“ an.`); else if (open.length) parts.push(`${open.length} ${open.length === 1 ? "Aufgabe ist" : "Aufgaben sind"} offen, nichts davon ist dringend.`);
  if (due) parts.push(`${due} Karteikarten warten auf dich.`);
  if (mins < goal) parts.push(`Bis zu deinem Tagesziel fehlen noch ${goal - mins} Minuten.`); else parts.push("Dein Tagesziel hast du schon erreicht.");
  return parts.slice(0, 2).join(" ") || "Nichts Dringendes – ein guter Moment zum Lernen.";
}
V.today = m => {
  const t = iso(), wd = (new Date().getDay() + 6) % 7, h = new Date().getHours(), goal = D.profile.goalMin || 45;
  const lessons = D.tt.filter(e => e.day === wd).sort((a, b) => a.start.localeCompare(b.start));
  const open = D.tasks.filter(x => !x.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const allEx = open.filter(x => x.type === "exam" && x.due && daysUntil(x.due) >= 0).sort((a, b) => a.due.localeCompare(b.due)), exams = allEx.slice(0, 2);
  const mins = D.stats.days[t] || 0, due = dueCardCount(), evToday = calEventsOn(t), todayTasks = open.filter(x => x.due && daysUntil(x.due) <= 0);
  const recent = [...D.docs].sort((a, b) => b.updated - a.updated).slice(0, 6);
  try { appleAuto(); } catch {}
  let first = true; try { first = !sessionStorage.getItem("lumi-welcomed"); sessionStorage.setItem("lumi-welcomed", "1"); } catch {}
  const greet = (h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend") + (D.profile.name ? ", " + D.profile.name.split(" ")[0] : "");
  const words = greet.split(" ").map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(" ");
  const sub = exams[0] ? `Deine nächste Prüfung: ${esc(exams[0].title)} in ${daysUntil(exams[0].due)} ${daysUntil(exams[0].due) === 1 ? "Tag" : "Tagen"}.` : todayTasks.length ? `Heute ${todayTasks.length === 1 ? "steht 1 Aufgabe" : "stehen " + todayTasks.length + " Aufgaben"} an.` : "Nichts Dringendes – ein guter Moment zum Lernen.";
  const timeline = [...lessons.map(e => ({ t: e.start, e: e.end, n: e.title || subj(e.subjectId)?.name || "Stunde", c: subj(e.subjectId)?.color || "#999", s: e.room || "Stundenplan" })), ...evToday.map(e => ({ t: e.time || "00:00", e: e.end, n: e.title, c: "#2563eb", s: e.loc || "Kalender" }))].sort((a, b) => a.t.localeCompare(b.t));
  const PR = x => { const d = x.due ? daysUntil(x.due) : 99; return x.prio || (x.type === "exam" || d <= 0 ? "Hoch" : d <= 3 ? "Mittel" : "Niedrig"); };
  const TY = { task: "Aufgabe", hw: "Hausaufgabe", exam: "Prüfung" };
  const todayN = open.filter(x => x.due && daysUntil(x.due) <= 0).length || Math.min(open.length, 5);
  const hue = s => { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) % 360; return n; };
  const thumb = d => `<div class="s-th" style="--h:${hue(d.id)}"><span>${ic(d.type === "draw" ? "brush" : d.type === "file" ? "file" : "note")}</span></div>`;
  const nextEx = exams[0];
  m.classList.add("homew");
  const icn = d => ic(d.type === "draw" ? "brush" : d.type === "file" ? "file" : "note");
  const SUGG = ["Lernplan für heute", "Quiz zum letzten Dokument", "Was zuerst lernen?"];
  const pct = Math.round(Math.min(100, mins / goal * 100)), exDays = nextEx ? daysUntil(nextEx.due) : null;
  const BLK = {
    tasks: () => `<section class="wg w-tasks rise" style="--i:2"><h2>Heute <em>${open.filter(x => x.type !== "exam").length}</em></h2><div id="todos" class="w-scroll"></div>
      <form class="z-add" id="todo-f"><span class="tc add">${ic("plus")}</span><input id="todo-i" placeholder="Aufgabe hinzufügen …" autocomplete="off" maxlength="140"><button class="link" type="button" id="addt">Mit Datum</button></form></section>`,
    cal: () => `<section class="wg w-cal rise" style="--i:3"><h2 id="cal-m" title="Zu heute"></h2><div class="cal-g" id="cal-g"></div><div class="w-cd" id="cal-d"></div></section>`,
    goal: () => `<section class="wg w-goal rise" style="--i:4"><h2>Fokus</h2>
      <div class="fd" id="fd" role="button" aria-label="Fokus-Timer: tippen zum Starten, ziehen zum Einstellen"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="fd-bg" cx="100" cy="100" r="84"/><circle class="fd-fg" id="fd-fg" cx="100" cy="100" r="84" transform="rotate(-90 100 100)"/><g id="fd-k"><circle class="fd-knob" cx="100" cy="16" r="12"/></g></svg><div class="fd-c"><b id="fd-t">25:00</b><svg class="fd-p" id="fd-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.8v12.4c0 1.1 1.2 1.7 2.1 1.2l9.2-6.2a1.4 1.4 0 0 0 0-2.4L10.3 4.6C9.4 4 8.2 4.7 8.2 5.8z"/></svg></div></div>
      <button class="fd-rs" id="fd-rs" hidden aria-label="Zurücksetzen" title="Zurücksetzen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></section>`,
    cards: () => `<button class="wg w-cards rise" style="--i:5" data-go="cards"><h2>Karteikarten</h2><b class="w-big">${due}</b><p>${due === 1 ? "Karte ist" : "Karten sind"} fällig</p><span class="w-go">Lernen ${ic("back")}</span></button>`,
    rec: () => `<section class="wg w-rec rise" style="--i:6"><h2>Zuletzt</h2><div class="w-scroll">${recent.length ? recent.slice(0, 6).map(d => `<button class="z-doc" data-d="${d.id}"><span class="z-di">${icn(d)}</span><span><b>${esc(d.title)}</b><small>${esc(docPath(d) || "Home")} · ${fmtAgo(d.updated)}</small></span></button>`).join("") : `<p class="empty sm">Noch nichts – leg mit „Neu“ los.</p>`}</div></section>`,
    ex: () => `<section class="wg w-ex rise" style="--i:7"><h2>Prüfungen${allEx.length ? ` <em>${allEx.length}</em>` : ""}</h2>${allEx.length ? `<div class="w-scroll">${allEx.slice(0, 6).map(x => { const sj = subj(x.subjectId), dd = daysUntil(x.due); return `<button class="z-doc ex-r" data-ex="${x.id}"><span class="z-di ex-d" style="--c:#0f0f12">${dd}</span><span><b>${esc(x.title)}</b><small>${sj ? esc(sj.name) + " · " : ""}${dd <= 0 ? "Heute" : dd === 1 ? "Morgen" : "in " + dd + " Tagen"}</small></span></button>`; }).join("")}</div><button class="link" data-go="exams">Alle Prüfungen</button>` : `<p class="empty sm">Keine Prüfung eingetragen.</p><button class="link" data-go="exams">Eintragen</button>`}</section>`,
    week: () => { const wd = Array.from({ length: 7 }, (_, n) => { const dd = new Date(); dd.setDate(dd.getDate() - (6 - n)); const k = iso(dd); return { l: dd.toLocaleDateString("de-CH", { weekday: "short" }).replace(".", ""), m: D.stats.days[k] || 0, r: D.stats.reviews[k] || 0, today: n === 6 }; }), mx = Math.max(goal, ...wd.map(x => x.m)), tot = wd.reduce((a, x) => a + x.m, 0), rev = wd.reduce((a, x) => a + x.r, 0), act = wd.filter(x => x.m || x.r).length; return `<section class="wg w-week rise" style="--i:3"><h2>Woche</h2><div class="wk">${wd.map(x => `<div class="wk-c ${x.today ? "now" : ""} ${x.m >= goal ? "hit" : ""}" title="${x.m} Min. Lernzeit · ${x.r} Karten"><em>${x.m || ""}</em><span class="wk-b"><i style="height:${x.m ? Math.max(6, Math.round(x.m / mx * 100)) : 0}%"></i></span><small>${x.l}</small></div>`).join("")}</div><p class="wk-s"><b>${tot}</b> Min. · Ø <b>${Math.round(tot / 7)}</b>/Tag · <b>${rev}</b> Karten · ${act}/7 Tage aktiv</p></section>`; },
    quick: () => `<section class="wg w-quick rise" style="--i:3"><h2>Schnellstart</h2><div class="qk"><button data-q="n">${ic("note")}<span>Neues Dokument</span></button><button data-go="cards">${ic("cards")}<span>Karteikarten</span></button><button data-go="quiz">${ic("help")}<span>Quiz</span></button><button data-go="docs">${ic("folder")}<span>Dokumente</span></button></div></section>`,
    note: () => `<section class="wg w-note rise" style="--i:3"><h2>Notizzettel</h2><textarea id="hnote" placeholder="Schnelle Notiz …" maxlength="4000">${esc(D.profile.homeNote || "")}</textarea></section>`,
    tt: () => `<section class="wg w-tt rise" style="--i:3"><h2>Stundenplan <em>heute</em></h2>${lessons.length ? `<div class="w-scroll">${lessons.map(e => { const sj = subj(e.subjectId); return `<div class="tt-r"><span class="tt-t">${esc(e.start || "")}</span><i style="background:${sj ? sj.color : "#0f0f12"}"></i><span><b>${esc(e.title || (sj && sj.name) || "Stunde")}</b><small>${esc(e.room || "")}${e.room && e.end ? " · " : ""}${e.end ? "bis " + esc(e.end) : ""}</small></span></div>`; }).join("")}</div>` : `<p class="empty sm">Heute keine Stunden eingetragen.</p>`}</section>`,
    streak: () => `<section class="wg w-stat rise" style="--i:3"><h2>Lernserie</h2><b class="w-big">${streak()}</b><p>${streak() === 1 ? "Tag" : "Tage"} in Folge</p></section>`,
    grades: () => { const gAvg = wavg(D.grades), rows = D.subjects.map(sj => ({ sj, l: D.grades.filter(g => g.subjectId === sj.id) })).filter(x => x.l.length).map(x => ({ ...x, a: wavg(x.l) })).sort((a, b) => a.sj.name.localeCompare(b.sj.name, "de")); return `<button class="wg w-stat w-grades rise" style="--i:3" data-go="grades"><h2>Noten</h2><div class="gr-top"><b class="w-big" style="color:${gAvg == null ? "inherit" : gcol(gAvg)}">${gfmt(gAvg)}</b><small>Ø Gesamt · ${D.grades.length} ${D.grades.length === 1 ? "Eintrag" : "Einträge"}</small></div><div class="gr-list">${rows.length ? rows.map(({ sj, l, a }) => `<div class="gr-r"><i class="gr-d" style="background:${sj.color}"></i><span class="gr-n">${esc(sj.name)}<small>${l.length}</small></span><span class="gr-b"><i style="width:${Math.max(6, Math.round(gnorm(a) * 100))}%;background:${gcol(a)}"></i></span><b style="color:${gcol(a)}">${gfmt(a)}</b></div>`).join("") : `<p class="empty sm">Noch keine Noten eingetragen.</p>`}</div><span class="w-go">Zu den Noten ${ic("back")}</span></button>`; },
    pinned: () => `<section class="wg w-pin rise" style="--i:3"><h2>Angeheftet</h2><div class="w-scroll">${D.docs.filter(d => d.pinned).slice(0, 8).map(d => `<button class="z-doc" data-d="${d.id}"><span class="z-di">${ic(d.type === "draw" ? "brush" : d.type === "file" ? "file" : "note")}</span><span><b>${esc(d.title)}</b><small>${esc(docPath(d) || "Home")}</small></span></button>`).join("") || `<p class="empty sm">Hefte Dokumente mit dem Stern an – sie erscheinen hier.</p>`}</div></section>`,
    ring: () => `<section class="wg w-ringb rise" style="--i:3"><h2>Tagesziel</h2><div class="rb">${ringSvg(pct, "#0f0f12", mins, "von " + goal + " Min.")}</div></section>`,
    clock: () => { const lm = n => n > 1 ? `<div class="ck-r more">+ ${n - 1} weitere</div>` : ""; const rows = [...calEventsOn(t).map(e => ({ tm: e.allDay ? "Ganztägig" : e.time || "", c: e.color || "#2563eb", n: e.title, o: e.allDay ? "00:00" : e.time || "00:00" })), ...D.tasks.filter(x => !x.done && x.due === t).map(x => ({ tm: x.type === "exam" ? "Prüfung" : "Fällig", c: x.type === "exam" ? "#d93a3a" : "#0f0f12", n: x.title, o: "00:00" }))].sort((a, b) => a.o.localeCompare(b.o) || a.n.localeCompare(b.n)); const conn = !!((D.apple && D.apple.feeds && D.apple.feeds.length)); return `<section class="wg w-clock rise" style="--i:3"><div class="ck-in"><div class="ck-t"><b id="hclock">${new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</b><p>${new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}</p></div>${conn ? `<div class="ck-ev"><h3>Heute im Kalender</h3>${rows.length ? rows.slice(0, 3).map(r => `<div class="ck-r"><i style="background:${r.c}"></i><span class="ck-tm">${esc(r.tm)}</span><b>${esc(r.n)}</b></div>`).join("") + lm(rows.length - 2 > 1 && rows.length > 3 ? rows.length - 2 : 0) : `<p class="ck-none">Heute nichts eingetragen</p>`}</div>` : ""}</div></section>`; },
    subjects: () => `<section class="wg w-sj rise" style="--i:3"><h2>${SUBJ()}</h2><div class="sj-l">${D.subjects.map(sj => { const n = D.tasks.filter(x => !x.done && x.subjectId === sj.id).length; return `<button data-go="docs"><i style="background:${sj.color}"></i><b>${esc(sj.name)}</b><small>${n ? n + " offen" : "frei"}</small></button>`; }).join("") || `<p class="empty sm">Noch keine Fächer – in den Einstellungen anlegen.</p>`}</div></section>`,
    hw: () => `<section class="wg w-hw rise" style="--i:3"><h2>Hausaufgaben</h2><div class="w-scroll">${open.filter(x => x.type === "hw").slice(0, 8).map(x => { const dd = x.due ? daysUntil(x.due) : null; return `<div class="hw-r"><b>${esc(x.title)}</b><small class="${dd != null && dd < 0 ? "red" : ""}">${dd == null ? "–" : dd < 0 ? "Überfällig" : dd === 0 ? "Heute" : dd === 1 ? "Morgen" : "in " + dd + " Tagen"}</small></div>`; }).join("") || `<p class="empty sm">Keine offenen Hausaufgaben.</p>`}</div></section>`,
  };
  const blockHtml = b => { const v = `--c:${b.c};--r:${b.r};--w:${b.w};--h:${b.h};`, h = BLK[b.type]().replace(/^<(section|button|div) class="wg /, `<$1 data-bid="${b.id}" class="wg `); return /style="--i:/.test(h) ? h.replace('style="--i:', `style="${v}--i:`) : h.replace('class="wg ', `style="${v}" class="wg `); };
  m.innerHTML = `<div class="home-wrap again"><div class="page home zen bento">
  <div class="b-grid" id="b-grid" style="--n:${Math.max(HOME_ROWS, ...homeLayout().map(b => b.r + b.h - 1))}">${homeLayout().map(blockHtml).join("")}
  </div></div></div>`;
  bindCommon(m); mountDock(m);
  { const hn = $("#hnote", m); if (hn) { let tm; hn.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { D.profile.homeNote = hn.value; save(); }, 400); }; } }
  $$("[data-q]", m).forEach(b => b.onclick = () => docDialog("note"));
  $$("[data-ex]", m).forEach(b => b.onclick = () => go("exam/" + b.dataset.ex));
  const todoRows = () => D.tasks.filter(x => !x.done && x.type !== "exam").sort((p, q) => (p.due || "9").localeCompare(q.due || "9")).slice(0, 5);
  const dueLbl = x => !x.due ? "–" : daysUntil(x.due) === 0 ? "Heute" : daysUntil(x.due) === 1 ? "Morgen" : daysUntil(x.due) < 0 ? "Überfällig" : fmtD(x.due);
  const BOLT = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M9 1L3 9h4l-1 6 6-8H8z" fill="currentColor"/></svg>`, PRC = { Hoch: "hi", Mittel: "md", Niedrig: "lo" };
  const stOf = x => x.done ? "done" : x.status === "doing" ? "doing" : "todo";
  const setSt = (x, k) => { if (k === "done") { if (!x.done) { completeTask(x, true); x.doneAt = Date.now(); } } else { x.done = false; x.status = k; } save(); drawTodos(); refreshNav(); };
  const drawTodos = () => {
    const box = $("#todos", m); if (!box) return; const all = D.tasks.filter(x => x.type !== "exam");
    const COLS = [["todo", "To-do", "#9a9aa8"], ["doing", "In Arbeit", "#f59e0b"], ["done", "Erledigt", "#16a34a"]];
    const list = k => all.filter(x => stOf(x) === k).sort((p, q) => k === "done" ? (q.doneAt || 0) - (p.doneAt || 0) : (p.due || "9").localeCompare(q.due || "9")).slice(0, k === "done" ? 6 : 30);
    box.innerHTML = `<div class="kb">${COLS.map(([k, l, c]) => { const rows = list(k); return `<div class="kb-c" data-col="${k}"><header><i style="background:${c}"></i><b>${l}</b><small>${all.filter(x => stOf(x) === k).length}</small></header><div class="kb-l">${rows.map(x => { const pr = PR(x); return `<article class="kb-k ${k === "done" ? "done" : ""}" draggable="true" data-id="${x.id}"><div class="kb-t"><span class="kprio ${PRC[pr] || ""}">${BOLT}${esc(pr)}</span><button class="kc-more" data-km="${x.id}" aria-label="Mehr">${ic("more")}</button></div><b>${esc(x.title)}</b>${x.due ? `<small class="${k !== "done" && daysUntil(x.due) < 0 ? "red" : ""}">${ic("cal")}${dueLbl(x)}</small>` : ""}</article>`; }).join("") || `<p class="kb-e">${k === "done" ? "Noch nichts erledigt" : "Leer"}</p>`}</div></div>`; }).join("")}</div>`;
    $$(".kb-k", box).forEach(el => { const x = D.tasks.find(y => y.id === el.dataset.id); el.ondragstart = e => { e.dataTransfer.setData("text/plain", x.id); el.classList.add("drag"); }; el.ondragend = () => el.classList.remove("drag"); el.onclick = e => { if (!e.target.closest("[data-km]")) taskModal(x); }; });
    $$(".kb-c", box).forEach(c => { c.ondragover = e => { e.preventDefault(); c.classList.add("over"); }; c.ondragleave = () => c.classList.remove("over"); c.ondrop = e => { e.preventDefault(); c.classList.remove("over"); const x = D.tasks.find(y => y.id === e.dataTransfer.getData("text/plain")); if (x && stOf(x) !== c.dataset.col) setSt(x, c.dataset.col); }; });
    $$("[data-km]", box).forEach(b => b.onclick = e => { e.stopPropagation(); const x = D.tasks.find(y => y.id === b.dataset.km), st = stOf(x); menu(b, [{ label: "Bearbeiten", icon: "edit", fn: () => taskModal(x) }, "-", ...["Hoch", "Mittel", "Niedrig"].map(p => ({ label: "Priorität: " + p, icon: PR(x) === p ? "check" : "", fn: () => { x.prio = p; save(); drawTodos(); } })), "-", ...COLS.filter(([k]) => k !== st).map(([k, l]) => ({ label: "Verschieben: " + l, icon: "chevr", fn: () => setSt(x, k) })), "-", { label: "Löschen", icon: "trash", danger: true, fn: () => { D.tasks = D.tasks.filter(y => y !== x); save(); drawTodos(); refreshNav(); } }]); });
  };
  drawTodos();
  const tfm = $("#todo-f", m); if (tfm) tfm.onsubmit = e => { e.preventDefault(); const i = $("#todo-i", m), v = i.value.trim(); if (!v) return; D.tasks.push({ id: uid(), title: v, type: "task", due: iso(), subjectId: "", note: "", done: false, status: "todo" }); save(); i.value = ""; drawTodos(); };
  if ($("#addt", m)) $("#addt", m).onclick = () => taskModal();
  { const ck = $("#hclock", m); if (ck) { const tk = () => { ck.textContent = new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }); }; const iv = setInterval(() => { if (!ck.isConnected) return clearInterval(iv); tk(); }, 10000); } }
  if ($("#fd", m)) {
    const fd = $("#fd", m), C = 2 * Math.PI * 84, MAXM = 120, STEP = 5;
    const busy = () => T.running || T.left < T.total;
    const paint = () => {
      const b = busy(), frac = b ? 1 - T.left / T.total : T.focusLen / MAXM, ang = (b ? 0 : T.focusLen / MAXM) * 360;
      $("#fd-fg", m).style.strokeDasharray = `${Math.max(0.001, frac) * C} ${C}`; $("#fd-k", m).setAttribute("transform", `rotate(${ang} 100 100)`);
      $("#fd-k", m).style.display = b ? "none" : ""; fd.classList.toggle("run", T.running);
      $("#fd-t", m).textContent = b ? fmtT(T.left) : String(T.focusLen).padStart(2, "0") + ":00";
      $("#fd-s", m).innerHTML = T.running ? '<rect x="6.5" y="5" width="3.7" height="14" rx="1.85"/><rect x="13.8" y="5" width="3.7" height="14" rx="1.85"/>' : '<path d="M8.2 5.8v12.4c0 1.1 1.2 1.7 2.1 1.2l9.2-6.2a1.4 1.4 0 0 0 0-2.4L10.3 4.6C9.4 4 8.2 4.7 8.2 5.8z"/>'; $("#fd-rs", m).hidden = !b;
    };
    const setLen = v => { v = Math.max(STEP, Math.min(MAXM, v)); if (v !== T.focusLen) { timerSet(v, T.breakLen); paint(); timerPaint(); } };
    let drag = false;
    const fromPt = e => { const r = fd.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); let a = Math.atan2(dx, -dy) * 180 / Math.PI; if (a < 0) a += 360; let v = Math.round(a / 360 * MAXM / STEP) * STEP; if (v === 0) v = T.focusLen > MAXM / 2 ? MAXM : STEP; if (T.focusLen >= 100 && v <= 20) v = MAXM; if (T.focusLen <= 20 && v >= 100) v = STEP; setLen(v); };
    let sx = 0, sy = 0, moved = false;
    fd.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; moved = false; drag = true; fd.setPointerCapture(e.pointerId); });
    fd.addEventListener("pointermove", e => { if (!drag || busy()) return; if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; moved = true; fromPt(e); });
    const end = () => { drag = false; }; fd.addEventListener("pointercancel", end);
    fd.addEventListener("pointerup", () => { if (!drag) return; end(); if (!moved) { timerToggle(); paint(); } });
    fd.addEventListener("wheel", e => { if (busy()) return; e.preventDefault(); setLen(T.focusLen + (e.deltaY < 0 ? STEP : -STEP)); }, { passive: false });
    fd.tabIndex = 0; fd.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); timerToggle(); paint(); return; } if (busy()) return; if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); setLen(T.focusLen + STEP); } if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); setLen(T.focusLen - STEP); } });
    $("#fd-rs", m).onclick = () => { timerReset(); paint(); };
    paint(); const iv = setInterval(() => { if (!fd.isConnected) return clearInterval(iv); paint(); }, 500); LEAVE.push(() => clearInterval(iv));
  }
  if ($("#cal-g", m)) {
    /* Nur Mo–Fr, ab dieser Woche 4 Wochen voraus; wechselt von selbst zwischen Wochenüberblick (4 Wochen) und genauer Wochenansicht und zurück */
    let wo = 0, sel = iso(), mode = "month", lastAct = 0;
    const itemsOn = d => [...D.tasks.filter(x => !x.done && x.due === d).map(x => ({ k: x.type === "exam" ? "exam" : "task", t: x.title })), ...calEventsOn(d).map(e => ({ k: "ev", t: e.title }))];
    const monday = o => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + o * 7); return d; };
    const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const WD = ["Mo", "Di", "Mi", "Do", "Fr"], g = $("#cal-g", m), det = $("#cal-d", m), box = g.closest(".w-cal");
    const drawCal = () => {
      const m0 = monday(wo), today = iso(), f = x => x.toLocaleDateString("de-CH", { day: "numeric", month: "short" });
      box.dataset.mode = mode;
      if (mode === "week") {
        $("#cal-m", m).textContent = wo === 0 ? "Diese Woche" : f(m0) + " – " + f(addD(m0, 4));
        g.innerHTML = WD.map((w, n) => { const dt = addD(m0, n), ds = iso(dt), it = itemsOn(ds); return `<button class="wk-r ${ds === today ? "today" : ""} ${it.some(x => x.k === "exam") ? "ex" : ""}" data-cd="${ds}"><b>${w}<span>${dt.getDate()}</span></b><span class="wk-i">${it.length ? it.slice(0, 2).map(x => `<span class="wk-e k${x.k}"><i></i>${esc(x.t)}</span>`).join("") + (it.length > 2 ? `<small>+${it.length - 2}</small>` : "") : `<em>frei</em>`}</span></button>`; }).join("");
        det.innerHTML = "";
        $$("[data-cd]", g).forEach(b => b.onclick = () => { lastAct = Date.now(); sel = b.dataset.cd; mode = "month"; drawCal(); });
        return;
      }
      const end = addD(m0, 25), mo = x => x.toLocaleDateString("de-CH", { month: "long" });
      $("#cal-m", m).textContent = (m0.getMonth() === end.getMonth() ? mo(m0) : mo(m0).slice(0, 3) + " – " + mo(end).slice(0, 3)) + " " + end.getFullYear();
      let h = WD.map(w => `<span class="wd">${w}</span>`).join("");
      for (let w = 0; w < 4; w++) for (let n = 0; n < 5; n++) {
        const dt = addD(m0, w * 7 + n), ds = iso(dt), it = itemsOn(ds);
        h += `<button class="cd ${ds === today ? "today" : ""} ${ds === sel ? "sel" : ""} ${it.some(x => x.k === "exam") ? "ex" : it.length ? "has" : ""}" data-cd="${ds}"><span>${dt.getDate()}</span></button>`;
      }
      g.innerHTML = h;
      $$("[data-cd]", g).forEach(b => b.onclick = () => { lastAct = Date.now(); if (swiped) return; if (sel === b.dataset.cd) return taskModal(null, sel); sel = b.dataset.cd; drawCal(); });
      const l = itemsOn(sel), KL = { exam: "Prüfung", task: "Aufgabe", ev: "Termin" };
      /* fester Bereich: Datum + immer 3 Zeilen (bis 2 Einträge + „weitere“), auch bei 0 Einträgen gleich hoch */
      const srt = [...l].sort((p, q) => (q.k === "exam") - (p.k === "exam")), more = l.length > 2 ? l.length - 2 : 0, row = x => `<span class="cd-i k${x.k}"><i></i><span class="cd-t"><b>${KL[x.k]}</b> ${esc(x.t)}</span></span>`;
      const rows = srt.slice(0, 2).map(row); while (rows.length < 2) rows.push(`<span class="cd-i ph"><span class="cd-t">${rows.length === 0 && !l.length ? "Keine Einträge" : "&nbsp;"}</span></span>`);
      rows.push(more ? `<span class="cd-i more"><span class="cd-t">+${more} weitere</span></span>` : `<span class="cd-i ph"><span class="cd-t">&nbsp;</span></span>`);
      det.innerHTML = `<span class="cd-dt">${sel === today ? "Heute" : fmtD(sel)}</span>` + rows.join("");
    };
    const swap = to => { box.classList.add("fading"); setTimeout(() => { mode = to; if (to === "week") { wo = 0; } else { wo = 0; sel = iso(); } drawCal(); box.classList.remove("fading"); }, 260); };
    const shift = d => { lastAct = Date.now(); wo = Math.max(0, wo + d); drawCal(); };
    $("#cal-m", m).onclick = () => { lastAct = Date.now(); wo = 0; sel = iso(); mode = "month"; drawCal(); };
    let swiped = false, sx = 0, sy = 0, down = false;
    g.addEventListener("pointerdown", e => { down = true; swiped = false; sx = e.clientX; sy = e.clientY; });
    g.addEventListener("pointerup", e => { if (!down) return; down = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; shift(dx < 0 ? 1 : -1); setTimeout(() => { swiped = false; }, 50); } });
    g.addEventListener("pointercancel", () => { down = false; });
    g.addEventListener("wheel", e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) { e.preventDefault(); shift(e.deltaX > 0 ? 1 : -1); } }, { passive: false });
    const iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); if (document.hidden || box.matches(":hover") || Date.now() - lastAct < 8000) return; swap(mode === "month" ? "week" : "month"); }, 7000); LEAVE.push(() => clearInterval(iv));
    drawCal();
  }
};
let quizPrefill = null;
function bindCommon(m) {
  $$("[data-go]", m).forEach(b => b.onclick = () => go(b.dataset.go));
  $$("[data-d]", m).forEach(c => c.onclick = e => { if (e.target.closest(".dmore")) return; const ds = (D.designs || []).find(d => d.id === c.dataset.d); if (ds) return go("design/" + ds.id); openDoc(D.docs.find(d => d.id === c.dataset.d)); });
  $$("[data-m]", m).forEach(b => b.onclick = e => { e.stopPropagation(); const ds = (D.designs || []).find(d => d.id === b.dataset.m); if (ds) return dsItemMenu(b, ds, () => V.docs($("#main"))); docMenu(b, D.docs.find(d => d.id === b.dataset.m)); });
}

/* ---------- views: documents (folders) ---------- */
let docSort = "recent", docQuery = "", docType = "all", docView = "grid";
const FOLDER_SVG = `<svg viewBox="0 0 128 100" aria-hidden="true" shape-rendering="geometricPrecision"><defs><linearGradient id="fgH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient><linearGradient id="fgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs><path class="fb" d="M8 20a13 13 0 0 1 13-13h24.500c3.200 0 6.100 1.400 8 3.800L59 17h48a13 13 0 0 1 13 13v55a13 13 0 0 1-13 13H21A13 13 0 0 1 8 85z"/><path d="M8 20a13 13 0 0 1 13-13h24.500c3.200 0 6.100 1.400 8 3.800L59 17h48a13 13 0 0 1 13 13v55a13 13 0 0 1-13 13H21A13 13 0 0 1 8 85z" fill="url(#fgB)"/><path class="ff" d="M8 38a13 13 0 0 1 13-13h86a13 13 0 0 1 13 13v47a13 13 0 0 1-13 13H21A13 13 0 0 1 8 85z"/><path d="M8 38a13 13 0 0 1 13-13h86a13 13 0 0 1 13 13v47a13 13 0 0 1-13 13H21A13 13 0 0 1 8 85z" fill="url(#fgH)"/><path d="M21 25.500h86a12.500 12.500 0 0 1 12.500 12.500" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.200"/></svg>`;
let folderN = 0;
const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
function folderSvg(c) {
  const k = "fg" + (folderN++), dk = t => hexMix(c, "#000000", t), lt = t => hexMix(c, "#ffffff", t);
  const BACK = "M366.576 180C329.807 180 300 209.807 300 246.576V325.522V333.369V446.478C300 483.764 300 502.407 307.256 516.649C313.639 529.176 323.824 539.361 336.351 545.744C350.593 553 369.236 553 406.522 553H606.478C643.764 553 662.407 553 676.649 545.744C689.176 539.361 699.361 529.176 705.744 516.649C713 502.407 713 483.764 713 446.478V325.522C713 288.236 713 269.593 705.744 255.351C699.361 242.824 689.176 232.639 676.649 226.256C662.407 219 643.764 219 606.478 219H561.793C527.43 219 494.417 180 460.054 180H366.576Z";
  const FRONT = "M300 380C300 342.663 299.74 323.261 307 309C313.386 296.456 323.466 286.392 336 280C350.249 272.734 369.693 273 407 273H606C643.307 273 662.751 272.734 677 280C689.534 286.392 699.614 296.456 706 309C713.26 323.261 713 342.663 713 380V446C713 483.337 713.26 502.739 706 517C699.614 529.544 689.534 539.608 677 546C662.751 553.266 643.307 553 606 553H407C369.693 553 350.249 553.266 336 546C323.466 539.608 313.386 529.544 307 517C299.74 502.739 300 483.337 300 446V380Z";
  return `<svg viewBox="300 180 413 373" aria-hidden="true"><defs>
    <filter id="${k}f" x="220" y="193" width="573" height="440" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="39.9"/></filter>
    <radialGradient id="${k}b" cx="0" cy="0" r="1" gradientTransform="matrix(-399.677 -386.29 427.241 -412.931 713 553.414)" gradientUnits="userSpaceOnUse"><stop stop-color="${dk(.1)}"/><stop offset="1" stop-color="${lt(.12)}"/></radialGradient>
    <radialGradient id="${k}r" cx="0" cy="0" r="1" gradientTransform="matrix(-413 -280 413 -467.157 713 553)" gradientUnits="userSpaceOnUse"><stop stop-color="${dk(.12)}"/><stop offset="1" stop-color="${lt(.2)}"/></radialGradient>
    <linearGradient id="${k}s1" x1="300" y1="180" x2="699" y2="586" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="${lt(.55)}"/><stop offset="1" stop-color="${dk(.4)}"/></linearGradient>
    <linearGradient id="${k}s2" x1="300" y1="180" x2="761" y2="499" gradientUnits="userSpaceOnUse"><stop offset=".23" stop-color="${lt(.55)}"/><stop offset=".99" stop-color="${c}"/></linearGradient>
    <linearGradient id="${k}s3" x1="300" y1="273" x2="669" y2="613" gradientUnits="userSpaceOnUse"><stop offset=".23" stop-color="${lt(.55)}"/><stop offset=".95" stop-color="${c}"/></linearGradient>
    <path id="${k}p" d="${BACK}"/><path id="${k}q" d="${FRONT}"/>
    <mask id="${k}m1"><use href="#${k}p" fill="#fff"/></mask><mask id="${k}m2"><use href="#${k}q" fill="#fff"/></mask></defs>
    <use href="#${k}p" fill="url(#${k}b)"/>
    <path d="${BACK}" fill="none" stroke="url(#${k}s1)" stroke-width="5.33" mask="url(#${k}m1)"/><path d="${BACK}" fill="none" stroke="url(#${k}s2)" stroke-width="5.33" mask="url(#${k}m1)"/>
    <g filter="url(#${k}f)"><rect x="300" y="273" width="413" height="280" rx="66.6" fill="#000" fill-opacity=".42"/></g>
    <use href="#${k}q" fill="url(#${k}r)"/>
    <path d="${FRONT}" fill="none" stroke="url(#${k}s3)" stroke-width="5.33" mask="url(#${k}m2)"/></svg>`;
}
const FOLDER_SVG_UNUSED = 1;
/* Geteilt: Wer das Dokument geteilt hat, steht bei allen vorne, die anderen versetzt dahinter. Bist du allein drin, zeigt nur ein kleines Link-Symbol „geteilt“ an. */
function shareAvs(d) {
  let ppl = []; try { ppl = JSON.parse(d.peers || "[]"); } catch {}
  const meN = coName(), me = { n: meN, c: meCol(), o: !!d.shareOwner };
  const all = [me, ...ppl.filter(p => p.n !== meN)].sort((a, b) => (b.o ? 1 : 0) - (a.o ? 1 : 0));
  if (all.length < 2) return `<em class="dshare solo" title="Geteilt">${ic("link")}</em>`;
  const show = all.slice(0, 3);
  return `<em class="dshare" title="Geteilt mit ${esc(all.map(p => p.n).join(", "))}">${show.map((p, i) => `<i style="background:${p.c};z-index:${9 - i}">${esc(coIni(p.n))}</i>`).join("")}${all.length > 3 ? `<i class="more">+${all.length - 3}</i>` : ""}</em>`;
}
const sideRow = d => `<div class="sd-row" data-d="${d.id}" tabindex="0"><span class="sd-i">${ic(KIND_I[docKind(d)])}${d.share ? `<i class="shbadge" title="Geteilt">${ic("link")}</i>` : ""}</span><span class="sd-t"><b>${esc(d.title)}</b><small>${d.share ? (d.shareOwner ? "Von dir geteilt" : "Mit dir geteilt") + " · " : ""}${fmtAgo(d.updated)}</small></span></div>`;
function docSide() {
  const recent = [...D.docs].sort((a, b) => b.updated - a.updated).slice(0, 7), shared = D.docs.filter(d => d.share).sort((a, b) => b.updated - a.updated).slice(0, 12);
  return `<aside class="dside" aria-label="Zuletzt genutzt und geteilt"><section><h4>${ic("timer")}Zuletzt genutzt</h4>${recent.map(sideRow).join("") || `<p class="sd-empty">Noch nichts geöffnet.</p>`}</section><section><h4>${ic("adduser")}Geteilt</h4>${shared.map(sideRow).join("") || `<p class="sd-empty">Noch nichts geteilt. Im Dokument oben auf das Teilen-Symbol tippen, um andere einzuladen.</p>`}</section></aside>`;
}
V.docs = (m, id) => {
  if (id !== undefined) docFolder = id || ""; if (docFolder && !folderOf(docFolder)) docFolder = "";
  const q = docQuery.trim().toLowerCase(), path = folderPath(docFolder);
  const dsl = typeof dsDocs === "function" ? dsDocs() : [];
  const decks = (D.decks || []).map(k => ({ id: k.id, type: "deck", title: k.title || "Karteikarten", subjectId: k.subjectId || "", folderId: "", updated: k.updated || k.created || 0, n: (k.cards || []).length, text: "" }));
  const folders = (q ? D.folders.filter(f => f.name.toLowerCase().includes(q)) : D.folders.filter(f => (f.parent || "") === docFolder)).sort((a, b) => a.name.localeCompare(b.name));
  const list = (q ? [...D.docs, ...dsl, ...decks].filter(d => (d.title + " " + (d.text || "")).toLowerCase().includes(q)) : [...D.docs, ...dsl, ...decks].filter(d => (d.folderId || "") === docFolder)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (docSort === "name" ? a.title.localeCompare(b.title) : b.updated - a.updated));
  const base = list, cnt = k => k === "all" ? base.length : base.filter(d => docKind(d) === k).length;
  const shown = base;
  const tplRow = () => `<h3 class="dsec tpl-h">Neu erstellen</h3><div class="tpx-row" role="list">${[["n", "Neues Dokument", "newnote"], ["w", "Neues Whiteboard", "brush"], ["d", "Neues Design", "image"], ["t", "Neue Datenbank", "table"], ["f", "Neuer Ordner", "folder"], ["u", "Datei hochladen", "upload"], ["k", "Karteikarten", "cards"], ["a", "Mit Studix AI", "spark"]].map(([k, t, i]) => `<button class="tpx" role="listitem" data-e="${k}"><span class="tpx-i">${ic(i)}</span><i class="tpx-p">${ic("plus")}</i><b>${t}</b></button>`).join("")}</div>`;
  m.classList.add("doc-full");
  m.innerHTML = `<div class="ned dfull docsed">${pageHead(path.length ? `<button class="cr" data-p="">Dokumente</button>${path.map((f, i) => `<i>/</i>${i === path.length - 1 ? `<b>${esc(f.name)}</b>` : `<button class="cr" data-p="${f.id}">${esc(f.name)}</button>`}`).join("")}` : "<b>Dokumente</b>", `<label class="dk-search${docQuery ? " has" : ""}"><span class="sdk-i"><svg viewBox="0 0 24 24">${SDK.search}</svg></span><input id="dq" placeholder="${path.length ? "In „" + esc(path[path.length - 1].name) + "“ und überall suchen …" : "Dokumente durchsuchen …"}" value="${esc(docQuery)}"></label>${dkAct("filter", "Sortieren", 'id="dsb"')}<i class="sdk-sep" aria-hidden="true"></i>${dkAct("plus", "Neu", 'id="nw"')}`)}
  <article class="ned-paper docspaper" id="paperc"><div class="dmain">
  ${q || !path.length ? "" : tplRow()}
  ${folders.length || shown.length ? `${folders.length ? `<div class="dtop"><div class="dtl"><h3 class="dsec">Ordner<small>${folders.length}</small></h3><div class="items fgrid">${folders.map(f => { const n = folderCount(f.id); return `<div class="fold" data-f="${f.id}" style="--c:${f.color}" tabindex="0"><div class="f3d">${folderSvg(f.color)}<span class="fico">${sji(sjiOf(f))}</span><div class="ftxt"><b>${esc(f.name)}</b><small>${n} ${n === 1 ? "Datei" : "Dateien"}${q && f.parent ? " · " + esc(folderPath(f.parent).map(x => x.name).join(" › ")) : ""}</small></div></div><button class="dmore on" data-fm="${f.id}" aria-label="Mehr">${ic("more")}</button></div>`; }).join("")}<button class="fold add" id="nf" type="button">${ic("plus")}<span>Neuer Ordner</span></button></div></div></div>${!q && base.length ? `<section class="drc"><h3 class="dsec">Zuletzt benutzt</h3><div class="drc-row">${[...base].sort((x, y) => (y.updated || 0) - (x.updated || 0)).slice(0, 5).map(d => { const k = docKind(d), isD = d.type === "deck"; return `<button class="drr" type="button" data-d="${isD ? "" : d.id}" ${isD ? `data-k="${d.id}"` : ""}><i class="dk k-${k}">${ic(KIND_I[k])}</i><span><b>${esc(d.title)}</b><small>${KIND_L[k]}${d.updated ? " · " + fmtAgo(d.updated) : ""}</small></span></button>`; }).join("")}</div></section>` : ""}` : ""}${shown.length ? `<section class="dlist"><h3 class="dsec">${docType === "all" ? "Alle Dateien" : (DTYPES.find(x => x[0] === docType) || [])[1]}<small>${shown.length}</small></h3><div class="dtab" role="table"><div class="dth" role="row"><span>Name</span><span>Typ</span><span>Fach</span><span>Geändert</span><span></span></div>${shown.map(d => { const k = docKind(d), sj = subj(d.subjectId), isD = d.type === "deck", own = !isD && d.type !== "design"; return `<div class="dtr" role="row" data-d="${isD ? "" : d.id}" ${isD ? `data-k="${d.id}"` : ""} ${own ? `draggable="true"` : ""} tabindex="0"><span class="dn"><i class="dk k-${k}">${ic(KIND_I[k])}</i><b>${d.pinned ? `<em class="pin">${ic("star")}</em>` : ""}${esc(d.title)}${d.share ? shareAvs(d) : ""}</b>${q && d.folderId ? `<small>${esc(docPath(d))}</small>` : ""}</span><span class="dt2"><em class="tag k-${k}">${KIND_L[k]}${isD ? " · " + d.n : ""}</em></span><span class="dsj">${sj ? `<i style="background:${sj.color}"></i>${esc(sj.name)}` : `<small>–</small>`}</span><span class="dd">${d.updated ? fmtAgo(d.updated) : "–"}</span><span class="da">${own ? `<button class="dmore" data-m="${d.id}" aria-label="Mehr">${ic("more")}</button>` : d.type === "design" ? `<button class="dmore" data-m="${d.id}" aria-label="Mehr">${ic("more")}</button>` : ""}</span></div>`; }).join("")}</div></section>` : ""}` : `<div class="emptybox emp2">${q ? `<h3>Nichts gefunden</h3><p>Versuche einen anderen Suchbegriff.</p>` : ""}</div>`}
  </div></article></div>`;
  setScroller($("#paperc", m));
  bindCommon(m);
  $$("[data-p]", m).forEach(b => { b.onclick = () => go("docs/" + b.dataset.p); b.ondragover = e => { e.preventDefault(); b.classList.add("drop"); }; b.ondragleave = () => b.classList.remove("drop"); b.ondrop = e => dropOn(e, b.dataset.p); });
  $$("[data-f]", m).forEach(c => { c.onclick = e => { if (e.target.closest("[data-fm]")) return; go("docs/" + c.dataset.f); }; c.ondragover = e => { e.preventDefault(); c.classList.add("drop"); }; c.ondragleave = () => c.classList.remove("drop"); c.ondrop = e => dropOn(e, c.dataset.f); });
  $$("[data-fm]", m).forEach(b => b.onclick = e => { e.stopPropagation(); folderMenu(b, folderOf(b.dataset.fm)); });
  $$("[data-k]", m).forEach(c => c.onclick = () => go("cards/" + c.dataset.k));
  $$("[data-gf]", $("#side")).forEach(b => b.classList.toggle("on", b.dataset.gf === docFolder));
  $("#nf", m) && ($("#nf", m).onclick = () => newFolder());
  $$(".doc, .drow, .dtr[draggable]", m).forEach(c => c.ondragstart = e => { e.dataTransfer.setData("text/lumi-doc", c.dataset.d); e.dataTransfer.effectAllowed = "move"; });
  function dropOn(e, fid) { const did = e.dataTransfer.getData("text/lumi-doc"); if (!did) return; e.preventDefault(); e.stopPropagation(); const d = D.docs.find(x => x.id === did); if (d) { moveDoc(d, fid); toast("Verschoben nach " + (folderOf(fid)?.name || "Dokumente")); refreshNav(); V.docs(m); } }
  $$("[data-e]", m).forEach(b => b.onclick = () => ({ n: () => docDialog("note"), w: () => docDialog("draw"), d: () => dsCreateDialog(), t: () => newDatabaseMenu($("#newbtn") || b), f: () => newFolder(), u: () => $("#upl").click(), k: () => newDeck(), a: () => openAiCommand() })[b.dataset.e]());
  $$("[data-t]", m).forEach(b => b.onclick = () => { docType = b.dataset.t; V.docs(m); });
  $$("[data-v]", m).forEach(b => b.onclick = () => { docView = b.dataset.v; V.docs(m); });
  $("#nw", m).onclick = e => menu(e.currentTarget, [{ label: "Mit Studix AI erstellen …", icon: "spark", fn: () => openAiCommand() }, "-", { label: "Dokument (A4)", icon: "newnote", fn: () => docDialog("note") }, { label: "Whiteboard", icon: "brush", fn: () => docDialog("draw") }, { label: "Design (Plakat, Flyer, A4 quer …)", icon: "image", fn: () => dsCreateDialog({ folder: docFolder }) }, { label: "Ordner", icon: "folder", fn: () => newFolder() }, { label: "Datei hochladen", icon: "upload", fn: () => $("#upl").click() }, "-", { label: "Datenbank: Lernplan", icon: "todo", fn: () => newDatabase(docFolder, "plan") }, { label: "Datenbank: Prüfungen & Noten", icon: "award", fn: () => newDatabase(docFolder, "exams") }, { label: "Datenbank: Leseliste", icon: "book", fn: () => newDatabase(docFolder, "read") }, { label: "Leere Datenbank", icon: "table", fn: () => newDatabase(docFolder, "blank") }]);
  $("#dq", m).oninput = debounce(e => { docQuery = e.target.value; const p = e.target.selectionStart; V.docs(m); const i = $("#dq", m); i.focus(); i.setSelectionRange(p, p); }, 200);
  $("#dsb", m).onclick = e => menu(e.currentTarget, [["recent", "Neueste zuerst"], ["name", "Name A–Z"]].map(([k, l]) => ({ label: (docSort === k ? "✓ " : "") + l, fn: () => { docSort = k; V.docs(m); } })));
};

/* ---------- AI tools (shared by note editor and file viewer) ---------- */
let pendingQuiz = null;
const clip = (t, n = 14000) => t.length > n ? t.slice(0, n) : t;
function textToHtml(t) {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<u>$1</u>").replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const lines = String(t).split("\n"); let out = "", list = "", tbl = null;
  const endList = () => { if (list) { out += `</${list}>`; list = ""; } };
  const endTbl = () => { if (tbl) { out += "<table><tbody>" + tbl.map((r, i) => `<tr>${r.map(c => i ? `<td>${inl(c)}</td>` : `<th>${inl(c)}</th>`).join("")}</tr>`).join("") + "</tbody></table>"; tbl = null; } };
  for (const l of lines) {
    let m;
    if (/^\s*\|.*\|\s*$/.test(l)) { endList(); if (/^[\s|:-]+$/.test(l)) continue; (tbl ||= []).push(cells(l)); continue; }
    endTbl();
    if ((m = l.match(/^\s*[-•*]\s+(.*)/))) { if (list !== "ul") { endList(); out += "<ul>"; list = "ul"; } out += `<li>${inl(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { endList(); out += "<ol>"; list = "ol"; } out += `<li>${inl(m[1])}</li>`; continue; }
    endList();
    if ((m = l.match(/^\s{0,3}(#{1,3})\s+(.*)/))) out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`;
    else if ((m = l.match(/^\s*>\s?(.*)/))) out += `<blockquote>${inl(m[1])}</blockquote>`;
    else if (l.trim()) out += `<p>${inl(l)}</p>`;
  }
  endList(); endTbl(); return out;
}
async function aiTool(kind, text, ctx = {}) {
  text = (text || "").trim();
  if (text.length < 20) { toast("Zu wenig Text – schreibe oder markiere zuerst etwas."); return; }
  const T = clip(text);
  if (kind === "cards" || kind === "quiz") {
    const n = await ask(kind === "cards" ? "Wie viele Karteikarten?" : "Wie viele Fragen?", { value: kind === "cards" ? "12" : "8", ok: "Erstellen" }); if (n === null) return;
    const cnt = Math.max(2, Math.min(30, parseInt(n) || 10));
    toast("Studix AI arbeitet…");
    const r = await ai(kind === "cards" ? `Erstelle aus dem Text ${cnt} Karteikarten. Antworte NUR mit JSON: [{"q":"Frage","a":"Antwort"}]. Kurze, prüfungsrelevante Fragen, präzise Antworten.\nTEXT:\n${T}` : `Erstelle ${cnt} Multiple-Choice-Fragen (3-4 Optionen, genau eine richtig) zum Text. Antworte NUR mit JSON: [{"q":"","o":["",""],"a":0,"e":"kurze Erklärung"}] (a = Index der richtigen Option).\nTEXT:\n${T}`, { max: 3500, quiet: true });
    let data = parseJSON(r); if (!Array.isArray(data) || !data.length) data = null;
    if (!data) { data = kind === "cards" ? localCards(T) : localQuiz(T, cnt); if (data.length) toast(hasKey() ? "Studix-AI-Antwort unlesbar – lokale Erstellung" : "Offline-Erstellung (mit eingerichteter Studix AI deutlich besser)"); else { toast("Daraus konnte nichts erstellt werden. Ist Studix AI eingerichtet?"); return; } }
    if (kind === "cards") return cardsModal(data.filter(c => c.q && c.a), ctx.title || "Karteikarten", ctx.subjectId);
    pendingQuiz = { title: ctx.title || "Quiz", qs: data.filter(q => q.q && Array.isArray(q.o) && q.o.length > 1), subjectId: ctx.subjectId }; return go("quizrun");
  }
  let lang = "";
  if (kind === "translate") { const l = await ask("Übersetzen in…", { value: "Englisch", ok: "Übersetzen" }); if (!l) return; lang = l; }
  let q = ""; if (kind === "ask") { q = await ask("Was möchtest du zum Text wissen?", { placeholder: "Deine Frage…", ok: "Fragen" }); if (!q) return; }
  const prompts = {
    summary: `Fasse den Text prägnant in 5–8 Stichpunkten ("- ") zusammen und hebe Schlüsselbegriffe hervor.\nTEXT:\n${T}`,
    explain: `Erkläre den folgenden Inhalt einfach und anschaulich, mit einem Beispiel, so dass ich ihn wirklich verstehe.\nTEXT:\n${T}`,
    improve: `Korrigiere Rechtschreibung und Grammatik und verbessere den Stil, ohne die Bedeutung zu ändern. Gib NUR den überarbeiteten Text zurück.\nTEXT:\n${T}`,
    continue: `Schreibe den Text sinnvoll in gleichem Stil weiter (ca. 120 Wörter). Gib NUR die Fortsetzung zurück.\nTEXT:\n${T}`,
    translate: `Übersetze den Text ins ${lang}. Gib NUR die Übersetzung zurück.\nTEXT:\n${T}`,
    ask: `Beantworte die Frage anhand des Textes: ${q}\nTEXT:\n${T}`,
  };
  const { el } = modal(`<h3>${{ summary: "Zusammenfassung", explain: "Einfach erklärt", improve: "Verbesserter Text", continue: "Fortsetzung", translate: "Übersetzung", ask: "Antwort", goals: "Lernziele" }[kind]}</h3><textarea class="field" id="ar" rows="12">Studix AI arbeitet…</textarea><div class="row end" id="ab" hidden>${ctx.insert ? `<button class="btn ghost" id="a-ins">Unten einfügen</button>` : ""}${ctx.replace && kind !== "summary" && kind !== "ask" && kind !== "explain" ? `<button class="btn ghost" id="a-rep">Auswahl ersetzen</button>` : ""}<button class="btn ghost" id="a-note">Als Notiz speichern</button><button class="btn" id="a-cp">${ic("copy")}Kopieren</button></div>`, "wide");
  let r = await ai(prompts[kind], { max: 1800, quiet: true });
  if (r == null) { r = kind === "summary" ? localSummary(T) : kind === "goals" ? localGoals(T) : null; if (!r) { $("#ar", el).value = hasKey() ? "Studix AI hat nicht geantwortet. Versuche es erneut." : "Diese Funktion braucht die eingerichtete Studix AI.\n\nRichte sie unter Einstellungen → Studix AI ein (Gemini-Key in Vercel). Zusammenfassungen, Karteikarten und Quiz funktionieren auch ohne Key mit einfacher lokaler Auswertung."; return; } }
  $("#ar", el).value = r.trim(); $("#ab", el).hidden = false; if (kind === "goals") examAutoGoals(ctx.subjectId, r);
  $("#a-cp", el).onclick = () => { navigator.clipboard?.writeText($("#ar", el).value); toast("Kopiert"); };
  $("#a-note", el).onclick = () => { if (limitHit("doc")) return; newNote(ctx.subjectId || "", textToHtml($("#ar", el).value), (ctx.title || "Notiz") + " – Studix AI"); el.closest(".mask").remove(); };
  $("#a-ins", el) && ($("#a-ins", el).onclick = () => { ctx.insert(textToHtml($("#ar", el).value)); el.closest(".mask").remove(); toast("Eingefügt"); });
  $("#a-rep", el) && ($("#a-rep", el).onclick = () => { ctx.replace($("#ar", el).value); el.closest(".mask").remove(); toast("Ersetzt"); });
}
function cardsModal(cards, title, subjectId, examId) {
  if (!cards.length) return toast("Keine Karten erstellt");
  const { el, close } = modal(`<h3>${cards.length} Karteikarten</h3><div class="cardprev">${cards.map(c => `<div class="cp"><b>${esc(c.q)}</b><span>${esc(c.a)}</span></div>`).join("")}</div><label class="lbl">Speichern in Stapel</label><select class="field" id="dk"><option value="">+ Neuer Stapel „${esc(title)}“</option>${D.decks.map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join("")}</select><div class="row end"><button class="btn ghost" data-c>Verwerfen</button><button class="btn accent" id="dks">Speichern & lernen</button></div>`, "wide");
  $("[data-c]", el).onclick = close;
  $("#dks", el).onclick = () => { let d = D.decks.find(x => x.id === $("#dk", el).value); if (!d) { d = { id: uid(), title, subjectId: subjectId || "", examId: examId || "", cards: [] }; D.decks.unshift(d); } cards.forEach(c => d.cards.push({ id: uid(), q: c.q, a: c.a, box: 0, due: iso() })); save(); close(); toast("Stapel gespeichert"); refreshNav(); go("study/" + d.id); };
}

/* ---------- note editor ---------- */
function localEdit(instr, t) {
  if (!t) return null;
  if (/kürz|kurz|zusammen/i.test(instr)) return sentences(t).slice(0, 2).join(" ") || t.slice(0, 160);
  if (/liste|aufzähl/i.test(instr)) { const ss = sentences(t); return ss.length ? ss.map(x => "- " + x).join("\n") : null; }
  return null;
}
const SYMS = "α β γ δ ε θ λ μ π ρ σ τ φ ω Δ Σ Ω ∫ ∂ √ ∞ ≈ ≠ ≤ ≥ ± × ÷ · → ⇒ ⇔ ∈ ∉ ⊂ ∪ ∩ ∀ ∃ ∅ ℝ ℕ ℤ ℚ ° ² ³ ⁿ ½ ¼ ‰ € § ✓ ✗".split(" ");
V.doc = async (m, id) => {
  const d = D.docs.find(x => x.id === id); if (!d) { m.innerHTML = `<div class="page"><div class="emptybox"><h3>Dokument nicht gefunden</h3><button class="btn" data-go="docs">Zu den Dokumenten</button></div></div>`; return bindCommon(m); }
  if (d.type === "draw") return go("draw/" + id);
  if (d.type === "file") return fileViewer(m, d);
  if (d.type === "db") return dbEditor(m, d);
  return noteEditor(m, d);
};
async function noteEditor(m, d) {
  const html = (await KV.get("html:" + d.id)) || "";
  const paperOf = () => d.paper || D.profile.paper || "white";
  const fp = folderPath(d.folderId), BTN = (c, i, t) => `<button class="tbtn" data-c="${c}" title="${t}">${ic(i)}</button>`;
  m.classList.add("doc-full");
  m.innerHTML = `<div class="ned dfull"><div class="ned-bar">
    <div class="nb-l"><button class="icon-btn" id="eb" aria-label="Zurück">${ic("back")}</button><div class="nb-name"><b id="cr">${esc(d.title)}</b><button class="nb-folder" data-p="${d.folderId || ""}">${ic("folder")}<span>${["Home", ...fp.map(f => f.name)].map(esc).join(" / ")}</span></button></div></div>
    <nav class="rtabs" id="rtabs" role="tablist" aria-label="Menüband">${[["start", "Start"], ["ins", "Einfügen"], ["draw", "Zeichnen"], ["design", "Design"], ["ai", "Überprüfen"]].map(([k, l], i) => `<button type="button" role="tab" class="rt ${i ? "" : "on"}" data-t="${k}">${l}</button>`).join("")}</nav>
    <div class="nb-r"><span class="saved" id="sv">Gespeichert</span><div class="modesw" id="msw" role="tablist"><i class="knob"></i><button role="tab" data-m="write" class="on">Schreiben</button><button role="tab" data-m="draw">Zeichnen</button></div><button type="button" class="btn small mv-btn" id="mv-edit">Bearbeiten</button><span class="co-av" id="co-av"></span><button class="icon-btn" id="co-m" aria-label="Zusammenarbeiten">${ic("adduser")}</button><button class="icon-btn" id="mo-m" aria-label="Mehr">${ic("more")}</button><button class="icon-btn aitog" id="ai-m" aria-label="AI ein- und ausklappen" title="AI ein- und ausklappen">${ic("aipanel")}<span class="hide-sm">AI</span></button></div></div>
  <div class="rib" id="rib"><button class="tt" id="t-blk" hidden></button><button class="tt" id="t-ins" hidden></button>
    <div class="rp on" data-pn="start"><span class="rgp" id="fx-text"></span><i class="fsep"></i><span class="rgp">${BTN("bold", "bold", "Fett (Strg+B)")}${BTN("italic", "italic", "Kursiv (Strg+I)")}${BTN("underline", "underline", "Unterstrichen")}${BTN("strike", "strike", "Durchgestrichen")}</span><i class="fsep"></i><span class="rgp">${BTN("hilite", "hl", "Markieren")}<button class="tbtn mini" id="hl-m" title="Markierfarbe" aria-label="Markierfarbe">${ic("chev")}</button><button class="tbtn" id="cl-b" title="Textfarbe"><b id="cl" style="border-bottom:3px solid #5b3df5;line-height:1">A</b></button><input type="color" id="cin" value="#5b3df5" hidden></span><i class="fsep"></i><span class="rgp">${BTN("ul", "list", "Aufzählung")}${BTN("ol", "listnum", "Nummerierung")}${BTN("todo", "todo", "Checkliste")}</span><i class="fsep"></i><span class="rgp" id="fx-par"></span><i class="fsep"></i><span class="rgp">${BTN("undo", "undo", "Rückgängig")}${BTN("redo", "redo", "Wiederholen")}</span></div>
    <div class="rp" data-pn="ins">${[["table", "table", "Tabelle"], ["image", "image", "Bild"], ["link", "link", "Link"], ["plink", "file", "Seite verlinken"], ["formula", "text", "Formel"], ["hr", "hrule", "Trennlinie"], ["textbox", "text", "Textfeld"], ["callout", "note", "Hinweis"], ["pinnote", "note", "Notizzettel"], ["sticky", "note", "Haftnotiz"], ["toggle", "chev", "Aufklappliste"], ["quote", "quote", "Zitat"], ["code", "code", "Code"], ["date", "cal", "Datum"], ["toc", "list", "Inhalt"]].map(([c, i, t]) => `<button type="button" class="tbtn lbl" data-c="${c}" title="${t}">${ic(i)}<span>${t}</span></button>`).join("")}</div>
    <div class="rp" data-pn="draw" id="rib-draw"></div>
    <div class="rp" data-pn="design"><span class="rgp" id="fx-design"></span><i class="fsep"></i><button class="tt" id="t-paper" title="Papier">${ic("note")}<span>Papier</span>${ic("chev")}</button><i class="fsep"></i><button class="tt" id="t-pages" title="Seiten im A4-Format anzeigen">${ic("file")}<span>Seiten (A4)</span></button><span class="pg-s" id="pg-s"></span></div>
    <div class="rp" data-pn="ai">${[["ai-edit", "Text schreiben / ändern"], ["ai-summary", "Zusammenfassen"], ["ai-cards", "Karteikarten"], ["ai-quiz", "Quiz"], ["ai-goals", "Lernziele"]].map(([c, t]) => `<button type="button" class="tbtn lbl" data-c="${c}" title="${t}">${ic(c === "ai-edit" ? "spark" : c === "ai-summary" ? "list" : c === "ai-cards" ? "cards" : c === "ai-quiz" ? "help" : "award")}<span>${t}</span></button>`).join("")}<i class="fsep"></i><button type="button" class="tbtn lbl" id="r-ac" title="Automatische Korrektur beim Schreiben">${ic("check")}<span>Auto-Korrektur</span><em id="r-acv"></em></button>${serverInfo && serverInfo.gemini ? `<button type="button" class="tbtn lbl" id="r-src" title="Quellen mit Google-Suche">${ic("globe")}<span>Quellen</span><em id="r-srcv"></em></button>` : ""}</div>
    <span id="fx-view" hidden></span>
  </div>
  <article class="ned-paper p-${paperOf()}" id="paperc"><div class="body" id="body" contenteditable="true" spellcheck="true" data-ph="Schreibe etwas, tippe „/“ für Blöcke oder drücke Leertaste für Studix AI …">${html}</div></article><input type="file" id="imgin" accept="image/*" hidden></div>`;
  const body = $("#body", m), svEl = $("#sv", m); let saved = null, stat = "";
  const onSel = () => { const s = getSelection(); if (s.rangeCount && body.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); updBubble(); };
  document.addEventListener("selectionchange", onSel); LEAVE.push(() => document.removeEventListener("selectionchange", onSel));
  const restore = () => { const s = getSelection(); if (saved && body.contains(saved.startContainer)) { s.removeAllRanges(); s.addRange(saved); } else { const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); s.removeAllRanges(); s.addRange(r); } body.focus(); };
  const count = () => { const t = body.innerText.trim(), w = t ? t.split(/\s+/).length : 0; stat = `${w} Wörter · ${Math.max(1, Math.round(w / 200))} Min. Lesezeit`; const ds = $("#dstat", m); if (ds) ds.textContent = `${w} Wörter · ${t.length} Zeichen · ${Math.max(1, Math.round(w / 200))} Min.`; };
  const doSave = debounce(async () => { if (!D.docs.includes(d)) return; d.updated = Date.now(); d.text = Suggest.plainText(body).slice(0, 60000); await KV.set("html:" + d.id, lumiHtml(body)); save(); svEl.textContent = "Gespeichert"; }, 500);
  const dirty = () => { svEl.textContent = "Speichert…"; count(); doSave(); };
  const SG = Suggest.attach(body, dirty); window.__lumiEd = SG; SG.refresh(); LEAVE.push(() => { SG.destroy(); if (window.__lumiEd === SG) window.__lumiEd = null; });
  /* Automatische Korrektur beim Schreiben (Groq/Gemini): nach kurzer Pause wird der aktuelle Absatz geprüft; Korrekturen erscheinen als Vorschläge oder werden direkt übernommen */
  const AC = { busy: false, last: 0, seen: new WeakMap(), timer: null, log: [] }, acMode = () => D.profile.autoCorrect || "suggest";
  AC.dirty = new Set(); AC.lt = null;
  /* gelernte Korrekturen: ein Fehler, den die KI einmal gefunden hat, wird danach sofort und zuverlässig auch ohne KI erkannt */
  const acDict = () => (D.profile.acDict ||= {}), capLike = (o, r) => o[0] !== o[0].toLowerCase() && r[0] === r[0].toLowerCase() ? r[0].toUpperCase() + r.slice(1) : r;
  const learnAC = (orig, edits) => { const dict = acDict(); let n = 0; for (const e of edits) { const o = orig.slice(e.start, e.end); if (/^\p{L}{2,}$/u.test(o) && /^\p{L}{2,}$/u.test(e.replace) && o !== e.replace) { dict[o] = e.replace; n++; } } if (n) { const k = Object.keys(dict); if (k.length > 400) k.slice(0, k.length - 400).forEach(x => delete dict[x]); save(); } };
  const docCounts = () => { const c = new Map(); for (const m of (body.innerText || "").matchAll(/\p{L}+/gu)) { const k = m[0].toLowerCase(); c.set(k, (c.get(k) || 0) + 1); } return c; };
  const ignoreSet = () => new Set((D.profile.spellIgnore || []).map(x => String(x).toLowerCase()));
  const localEdits = (txt, tailOpen = true) => {
    const dict = acDict(), out = [];
    for (const m of txt.matchAll(/\p{L}+/gu)) { const w = m[0], end = m.index + w.length; if (tailOpen && end >= txt.length) continue; let r = dict[w]; if (!r && dict[w.toLowerCase()]) r = capLike(w, dict[w.toLowerCase()]); if (r && r !== w) out.push({ start: m.index, end, replace: r }); }
    if (typeof Spell !== "undefined" && Spell.isReady()) for (const e of Spell.analyze(txt, { skipTail: tailOpen, ignore: ignoreSet(), docCounts: docCounts() }).edits) if (!out.some(o => e.start < o.end && e.end > o.start)) out.push(e);
    return out.sort((a, b) => a.start - b.start);
  };
  /* ---- Rechtschreibung wie in Word: Fehler werden unterstrichen, Antippen zeigt Vorschläge (Modus „Vorschläge“) ---- */
  const HL = window.CSS && CSS.highlights && window.Highlight ? new Highlight() : null; if (HL) CSS.highlights.set("lumi-spell", HL);
  const SP = { map: new Map(), ai: new Map(), sess: new Set(), menu: null };
  const underlineMode = () => !!HL && acMode() === "suggest";
  const leafBlocks = () => [...body.querySelectorAll("p,h1,h2,h3,li,blockquote,td,th")].filter(b => !b.querySelector("p,h1,h2,h3,li,blockquote,td,th") && !/^(PRE|CODE)$/.test(b.tagName));
  const issuesOf = (blk, tailOpen) => {
    const txt = Suggest.textOf(blk).s, out = [], free = x => !out.some(o => x.start < o.end && x.end > o.start);
    if (typeof Spell !== "undefined" && Spell.isReady()) for (const it of Spell.analyze(txt, { skipTail: tailOpen, ignore: new Set([...ignoreSet(), ...SP.sess]), docCounts: docCounts() }).issues) out.push(it);
    const dict = acDict(); for (const m of txt.matchAll(/\p{L}+/gu)) { const r = dict[m[0]]; if (r && r !== m[0] && !(tailOpen && m.index + m[0].length >= txt.length)) { const x = { start: m.index, end: m.index + m[0].length, word: m[0], suggestions: [r], kind: "fix" }; if (free(x)) out.push(x); } }
    const ai = (SP.ai.get(blk) || []).filter(a => { const at = txt.indexOf(a.word); if (at < 0) return false; const x = { start: at, end: at + a.word.length, word: a.word, suggestions: [a.replace], kind: "ki" }; if (free(x)) out.push(x); return true; });
    SP.ai.set(blk, ai); return out.sort((a, b) => a.start - b.start);
  };
  const repaint = () => {
    if (!HL) return; HL.clear();
    for (const [blk, list] of [...SP.map]) { if (!blk.isConnected) { SP.map.delete(blk); continue; } for (const it of list) { const r = Suggest.rangeAt(blk, it.start, it.end); if (r) HL.add(r); } }
  };
  const refreshBlock = (blk, tailOpen = false) => { if (!blk || !blk.isConnected || /^(PRE|CODE)$/.test(blk.tagName)) return; SP.map.set(blk, issuesOf(blk, tailOpen)); };
  const refreshAll = () => { if (!underlineMode()) return; leafBlocks().forEach(b => refreshBlock(b, false)); repaint(); };
  const closeSpMenu = () => { if (SP.menu) { SP.menu.remove(); SP.menu = null; } };
  const fixIssue = (blk, it, repl) => {
    const r = Suggest.rangeAt(blk, it.kind === "dup" && it.start > 0 ? it.start - 1 : it.start, it.end); if (!r) return; closeSpMenu();
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand(repl === "" ? "delete" : "insertText", false, repl);
    if (it.kind === "ki") { const a = SP.ai.get(blk) || []; SP.ai.set(blk, a.filter(x => x.word !== it.word)); learnAC(it.word, [{ start: 0, end: it.word.length, replace: repl }]); }
    refreshBlock(blk, false); repaint(); dirty();
  };
  const openSpMenu = (blk, it) => {
    closeSpMenu(); const r = Suggest.rangeAt(blk, it.start, it.end); if (!r) return; const b = r.getBoundingClientRect(), el = document.createElement("div"); el.className = "spm";
    const sug = it.suggestions.filter(x => x !== undefined);
    el.innerHTML = (sug.length ? sug.map((x, i) => `<button type="button" class="spm-s" data-i="${i}">${x === "" ? "Doppeltes Wort entfernen" : esc(x)}</button>`).join("") : `<span class="spm-n">Keine Vorschläge</span>`) + `<i class="spm-l"></i><button type="button" class="spm-a" data-a="ign">Ignorieren</button><button type="button" class="spm-a" data-a="add">Zum Wörterbuch hinzufügen</button>`;
    document.body.appendChild(el); SP.menu = el; const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left)) + "px"; el.style.top = (b.bottom + 8 + h > innerHeight - 8 ? Math.max(8, b.top - h - 8) : b.bottom + 8) + "px";
    el.addEventListener("pointerdown", e => e.preventDefault());
    el.onclick = e => {
      const bt = e.target.closest("button"); if (!bt) return;
      if (bt.dataset.i !== undefined) return fixIssue(blk, it, sug[+bt.dataset.i]);
      const wd = it.word.toLowerCase(); if (bt.dataset.a === "add") { const ig = (D.profile.spellIgnore ||= []); if (!ig.includes(wd)) ig.push(wd); save(); toast("„" + it.word + "“ zum Wörterbuch hinzugefügt"); } else SP.sess.add(wd);
      SP.ai.set(blk, (SP.ai.get(blk) || []).filter(x => x.word !== it.word)); closeSpMenu(); refreshAll();
    };
  };
  const onSpClick = () => setTimeout(() => {
    if (!underlineMode()) return; const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed || !body.contains(sel.anchorNode)) return closeSpMenu();
    const blk = blockOf(sel.anchorNode), list = blk && SP.map.get(blk); if (!list || !list.length) return closeSpMenu();
    for (const it of list) { const r = Suggest.rangeAt(blk, it.start, it.end); if (r && r.comparePoint(sel.anchorNode, sel.anchorOffset) === 0) return openSpMenu(blk, it); }
    closeSpMenu();
  }, 0);
  /* Antippen: Trefferprüfung über die Position des Fingers (unabhängig davon, ob/wo iPadOS den Cursor setzt) */
  let tapAt = null;
  const spHit = (x, y) => {
    if (!underlineMode()) return; const el = document.elementFromPoint(x, y), blk = el && blockOf(el); if (!blk) return closeSpMenu();
    refreshBlock(blk, false);
    for (const it of SP.map.get(blk) || []) { const r = Suggest.rangeAt(blk, it.start, it.end); if (!r) continue; for (const rc of r.getClientRects()) if (x >= rc.left - 4 && x <= rc.right + 4 && y >= rc.top - 6 && y <= rc.bottom + 6) return openSpMenu(blk, it); }
    closeSpMenu();
  };
  body.addEventListener("pointerdown", e => { tapAt = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
  body.addEventListener("pointerup", e => { const t = tapAt; tapAt = null; if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10 || Date.now() - t.t > 700) return; const x = e.clientX, y = e.clientY; setTimeout(() => spHit(x, y), 40); }, true);
  body.addEventListener("click", onSpClick); body.addEventListener("keyup", e => { if (/^Arrow/.test(e.key)) closeSpMenu(); });
  const spOut = e => { if (SP.menu && !SP.menu.contains(e.target) && !body.contains(e.target)) closeSpMenu(); };
  document.addEventListener("pointerdown", spOut, true);
  LEAVE.push(() => { closeSpMenu(); document.removeEventListener("pointerdown", spOut, true); try { CSS.highlights?.delete("lumi-spell"); } catch {} });
  if (typeof Spell !== "undefined" && acMode() !== "off") Spell.load().then(() => { refreshAll(); setTimeout(refreshAll, 700); });
  const localAC = () => {
    if (acMode() === "off") return; const sel = getSelection(); if (!sel.rangeCount || !body.contains(sel.anchorNode)) return;
    const blk = blockOf(sel.anchorNode); if (!blk || /^(PRE|CODE)$/.test(blk.tagName)) return;
    if (underlineMode()) { closeSpMenu(); refreshBlock(blk, /\p{L}$/u.test(blk.textContent || "")); repaint(); return; }
    const orig0 = Suggest.textOf(blk).s, marked = !!blk.querySelector(".sg-del,.sg-ins");
    let ed = localEdits(orig0, /\p{L}$/u.test(blk.textContent || ""));
    if (marked) ed = ed.filter(e => { const r = Suggest.rangeAt(blk, e.start, e.end), el = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer); return r && !(el && el.closest(".sg-del,.sg-ins")); });   // schon markierte Stellen nicht doppelt vorschlagen
    if (ed.length) { const n = SG.suggestAt(blk, ed, { avoidCaret: true, fast: true, direct: acMode() === "auto", mini: true }); if (n && acMode() === "auto") { ed.forEach(e => AC.log.push({ from: orig0.slice(e.start, e.end), to: e.replace })); AC.log = AC.log.slice(-20); } if (n && acMode() === "auto") toast(`${n} ${n === 1 ? "Korrektur" : "Korrekturen"} übernommen – Strg+Z macht es rückgängig`); }
  };
  /* Lokale Korrektur fast sofort (nach Leerzeichen/Satzzeichen ohne Verzögerung); KI-Prüfung höchstens etwa einmal pro Minute bei Änderungen – früher (5 s), wenn der Algorithmus unsicher ist */
  const AI_EVERY = 60000, AI_FAST = 5000;
  const scheduleAC = e => {
    clearTimeout(AC.lt); const fast = e && e.data && /[\s.,;:!?)\]"„“]/.test(e.data); AC.lt = setTimeout(localAC, fast ? 0 : 140);
    const sl = getSelection(), b = sl.rangeCount && body.contains(sl.anchorNode) ? blockOf(sl.anchorNode) : null; if (b) AC.dirty.add(b);
    clearTimeout(AC.timer); if (acMode() === "off" || !hasKey()) return;
    let urgent = false; if (b && typeof Spell !== "undefined" && Spell.isReady()) { try { const u = Spell.analyze(Suggest.textOf(b).s, { skipTail: false, ignore: ignoreSet(), docCounts: docCounts() }).unknown; urgent = u > 0; } catch {} }
    const gap = urgent ? AI_FAST : AI_EVERY; AC.timer = setTimeout(runAC, Math.max(urgent ? 1500 : 4000, gap - (Date.now() - AC.last)));
  };
  async function runAC() {
    if (AC.busy || acMode() === "off" || !hasKey() || !body.isConnected) return;
    const sel = getSelection(); if (!sel.rangeCount || !body.contains(sel.anchorNode)) return;
    const cb = blockOf(sel.anchorNode), ok = b => b && b.isConnected && !/^(PRE|CODE)$/.test(b.tagName) && !b.querySelector(".sg-del,.sg-ins") && Suggest.textOf(b).s.trim().length >= 14 && AC.seen.get(b) !== Suggest.textOf(b).s;
    const blk = [cb, ...AC.dirty].find(ok); AC.dirty.forEach(b => { if (!b.isConnected || b === blk) AC.dirty.delete(b); }); if (!blk) return;
    const orig = Suggest.textOf(blk).s;
    if (Date.now() - AC.last < 2500) return;
    AC.busy = true; AC.last = Date.now();
    let res = null;
    try { res = await ai(orig, { system: "Du bist eine zurückhaltende Korrektur für Rechtschreibung und Grammatik (Schweizer Hochdeutsch, kein ß, immer „ss“). Korrigiere NUR eindeutige Fehler: Tippfehler, fehlende, vertauschte oder doppelte Buchstaben, Gross-/Kleinschreibung (Satzanfang, Hauptwörter, Namen), das/dass, Artikel und Fälle (Kasus), Verbformen und Zeiten, Übereinstimmung von Subjekt und Verb, Wortendungen. Ändere NICHT: Kommas und andere Satzzeichen, Stil, Wortwahl, Satzbau, Fachbegriffe, Namen, Zahlen, Abkürzungen, Umgangssprache, Zeilenumbrüche. Formuliere nichts um und füge nichts hinzu." + (AC.log.length ? "\n\nEin einfacher Algorithmus hat bereits automatisch geändert: " + AC.log.filter(l => orig.includes(l.to)).map(l => `„${l.from}“ → „${l.to}“`).join(", ") + ". Prüfe diese Änderungen: War eine falsch (z. B. ein Name oder Fachbegriff), stelle das Original wieder her." : "") + (swissOn() ? " Schweizer Rechtschreibung: Das Zeichen „ß“ gibt es nicht, immer „ss“ schreiben." : "") + " Antworte NUR mit dem Text, ohne Erklärung, ohne Anführungszeichen. Wenn nichts eindeutig falsch ist, gib den Text exakt unverändert zurück.", max: Math.min(1500, Math.ceil(orig.length / 2) + 120), model: autoModelId(), temperature: 0.1, quiet: true, bg: true }); } catch {}
    AC.busy = false; AC.seen.set(blk, orig);
    if (!res || !blk.isConnected) return;
    let fixed = res.trim(); if (!/^["„“]/.test(orig)) fixed = fixed.replace(/^["„“]|["“”]$/g, "");
    if (!fixed || fixed === orig || fixed.length > orig.length * 1.35 + 20 || fixed.length < orig.length * 0.65 - 20) return;
    if (Suggest.textOf(blk).s !== orig) return scheduleAC();            // Nutzer hat weitergeschrieben
    let edits = Suggest.wordDiff(orig, fixed);
    edits = edits.filter(e => { const o = orig.slice(e.start, e.end), strip = x => x.replace(/[\s.,;:!?„“"'()\-–]/g, ""); return strip(o) !== strip(e.replace) && e.replace.split(/\s+/).length <= 4 && o.split(/\s+/).length <= 4; });   // nur kleine, echte Wortkorrekturen
    if (!edits.length || edits.length > 6) { if (AC.dirty.size) scheduleAC(); return; }
    edits.forEach(e => { const o = orig.slice(e.start, e.end), hit = AC.log.find(l => l.to === o && l.from.toLowerCase() === e.replace.toLowerCase()); if (hit && /^\p{L}+$/u.test(hit.from)) { const ig = (D.profile.spellIgnore ||= []); if (!ig.includes(hit.from.toLowerCase())) ig.push(hit.from.toLowerCase()); save(); } });   // KI widerruft Algorithmus → Wort künftig in Ruhe lassen
    const reverted = new Set(edits.filter(e => AC.log.some(l => l.to === orig.slice(e.start, e.end) && l.from.toLowerCase() === e.replace.toLowerCase())));
    AC.log = [];
    if (!underlineMode()) learnAC(orig, edits.filter(e => !reverted.has(e)));
    if (underlineMode()) { SP.ai.set(blk, [...(SP.ai.get(blk) || []), ...edits.map(e => ({ word: orig.slice(e.start, e.end), replace: e.replace }))]); refreshBlock(blk, false); repaint(); AC.seen.set(blk, Suggest.textOf(blk).s); if (AC.dirty.size) scheduleAC(); return; }
    const n = SG.suggestAt(blk, edits, { avoidCaret: true, direct: acMode() === "auto", mini: true });
    if (n && acMode() === "auto") toast(`${n} ${n === 1 ? "Korrektur" : "Korrekturen"} übernommen – Strg+Z macht es rückgängig`);
    AC.seen.set(blk, Suggest.textOf(blk).s); if (AC.dirty.size) scheduleAC();
  }
  if (acMode() !== "off") { body.spellcheck = false; if (typeof Spell !== "undefined") Spell.load(); }
  body.addEventListener("input", scheduleAC); LEAVE.push(() => clearTimeout(AC.timer));
  body.addEventListener("input", () => { dirty(); slashCheck(); PGV.refresh(); });
  body.addEventListener("click", e => { if (e.target.matches("input[type=checkbox]")) { e.target.checked ? e.target.setAttribute("checked", "") : e.target.removeAttribute("checked"); dirty(); } });
  body.addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (f) { e.preventDefault(); insertImage(f); } });
  async function insertImage(f) { const bmp = await createImageBitmap(f), s = Math.min(1, 1100 / bmp.width), c = document.createElement("canvas"); c.width = bmp.width * s; c.height = bmp.height * s; c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); restore(); document.execCommand("insertImage", false, c.toDataURL("image/jpeg", .8)); dirty(); }
  $("#imgin", m).onchange = e => { if (e.target.files[0]) insertImage(e.target.files[0]); e.target.value = ""; };
  const exec = (c, v) => { restore(); if (c === "insertHTML") { const sl = getSelection(); if (sl.rangeCount && !sl.isCollapsed) sl.collapseToEnd(); } document.execCommand(c, false, v); dirty(); };
  const sel = () => (saved?.toString() || "").trim();
  const run = k => aiTool(k, sel() || body.innerText, { title: d.title, subjectId: d.subjectId, insert: h => { body.insertAdjacentHTML("beforeend", h); dirty(); }, replace: t => { restore(); document.execCommand("insertText", false, t); dirty(); } });
  const CMD = {
    p: () => exec("formatBlock", "p"), h1: () => exec("formatBlock", "h1"), h2: () => exec("formatBlock", "h2"), h3: () => exec("formatBlock", "h3"),
    bold: () => exec("bold"), italic: () => exec("italic"), underline: () => exec("underline"), strike: () => exec("strikeThrough"), sub: () => exec("subscript"), sup: () => exec("superscript"),
    hilite: () => { const cur = document.queryCommandValue("hiliteColor"); exec("hiliteColor", cur && !/transparent|rgba\(0, 0, 0, 0\)|^$/i.test(cur) && !/255, 255, 255/.test(cur) ? "transparent" : hlColor); },
    indent: () => exec("indent"), outdent: () => exec("outdent"), right: () => exec("justifyRight"), justify: () => exec("justifyFull"),
    textbox: () => TBX.add(),
    pinnote: () => { const c = PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)]; exec("insertHTML", `<div class="pinnote"><span class="pn-pin" contenteditable="false">${pinSvg(c)}</span><h4>Titel</h4><p>Schreibe hier …</p></div><p><br></p>`); },
    sticky: () => exec("insertHTML", `<div class="stickynote" style="background:${STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]}"><p>Idee …</p></div><p><br></p>`),
    callout: () => exec("insertHTML", `<blockquote class="callout"><b>Hinweis:</b>&nbsp;</blockquote><p><br></p>`),
    toggle: () => exec("insertHTML", `<details class="tgl" open><summary>Aufklappliste</summary><p><br></p></details><p><br></p>`),
    plink: () => pagePicker(),
    date: () => exec("insertText", new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
    toc: () => { const hs = $$("h1,h2,h3", body); if (!hs.length) return toast("Füge zuerst Überschriften hinzu"); exec("insertHTML", `<p><b>Inhalt</b></p><ul>${hs.map(h => `<li>${esc(h.textContent.trim())}</li>`).join("")}</ul><p><br></p>`); },
    ul: () => exec("insertUnorderedList"), ol: () => exec("insertOrderedList"), todo: () => exec("insertHTML", '<ul class="chk"><li><input type="checkbox">&nbsp;</li></ul>'),
    quote: () => exec("formatBlock", document.queryCommandValue("formatBlock") === "blockquote" ? "p" : "blockquote"), code: () => exec("formatBlock", document.queryCommandValue("formatBlock") === "pre" ? "p" : "pre"),
    hr: () => exec("insertHorizontalRule"), left: () => exec("justifyLeft"), center: () => exec("justifyCenter"), clear: () => exec("removeFormat"), undo: () => { if (!FM.undo()) exec("undo"); }, redo: () => { if (!FM.redo()) exec("redo"); },
    link: async () => { const u = await ask("Link-Adresse", { value: "https://", ok: "Einfügen" }); if (u) exec("createLink", u); },
    image: () => $("#imgin", m).click(), table: () => exec("insertHTML", `<table><tbody>${"<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>".repeat(3)}</tbody></table><p><br></p>`),
    formula: () => { const { el } = modal(`<h3>Formeln & Symbole</h3><div class="syms">${SYMS.map(s => `<button>${s}</button>`).join("")}</div><p class="note">Tipp: „x²“ und „x₂“ findest du unter Einfügen.</p>`); $$(".syms button", el).forEach(sb => sb.onclick = () => { restore(); document.execCommand("insertText", false, sb.textContent); dirty(); }); },
    "ai-edit": () => openAiBar(), "ai-summary": () => run("summary"), "ai-cards": () => run("cards"), "ai-quiz": () => run("quiz"), "ai-goals": () => run("goals"),
  };
  const FM = Format.attach({ m, body, exec, restore, dirty, d, save }); window.__lumiFmt = FM; LEAVE.push(() => { FM.destroy(); if (window.__lumiFmt === FM) window.__lumiFmt = null; });
  const PGV = PageView.attach({ m, body, paper: $("#paperc", m), d, dirty }); LEAVE.push(() => PGV.destroy()); $("#t-pages", m).onclick = () => PGV.set(!PGV.on);
  const noFocus = e => e.preventDefault();
  $$(".tbtn[data-c], .tt", m).forEach(b => b.onmousedown = noFocus);
  $$(".tbtn[data-c]", m).forEach(b => b.onclick = () => CMD[b.dataset.c]?.());
  $("#cin", m).oninput = e => { $("#cl", m).style.borderColor = e.target.value; exec("foreColor", e.target.value); }; $("#cin", m).onclick = e => e.stopPropagation(); $("#cl", m).parentElement.onclick = () => $("#cin", m).click();
  const pagePicker = () => {
    const { el, close } = modal(`<h3>Seite verlinken</h3><input class="field" id="pl-q" placeholder="Dokument suchen …" autocomplete="off"><div class="pick" id="pl-l"></div>`);
    const draw = () => { const q = $("#pl-q", el).value.trim().toLowerCase(), list = D.docs.filter(x => x.id !== d.id && x.type !== "draw" && (!q || x.title.toLowerCase().includes(q))).slice(0, 30); $("#pl-l", el).innerHTML = list.map(x => `<button class="li hit" data-id="${x.id}">${ic(x.type === "note" ? "note" : "file")}<div class="tm2"><b>${esc(x.title)}</b><small>${esc(docPath(x) || "Home")}</small></div></button>`).join("") || `<p class="empty sm">Keine Treffer.</p>`; $$("[data-id]", el).forEach(b => b.onclick = () => { const t = D.docs.find(y => y.id === b.dataset.id); close(); restore(); document.execCommand("insertHTML", false, `<a class="plink" href="#/app/doc/${t.id}" data-doc="${t.id}" contenteditable="false">${esc(t.title)}</a>&nbsp;`); dirty(); }); };
    $("#pl-q", el).oninput = draw; draw(); setTimeout(() => $("#pl-q", el).focus(), 40);
  };
  const backlinks = async () => {
    const hits = []; for (const x of D.docs) { if (x.type !== "note" || x.id === d.id) continue; const h = await KV.get("html:" + x.id); if (h && h.includes(`data-doc="${d.id}"`)) hits.push(x); }
    const { el, close } = modal(`<h3>Verlinkt von</h3>${hits.length ? `<div class="pick">${hits.map(x => `<button class="li hit" data-id="${x.id}">${ic("note")}<div class="tm2"><b>${esc(x.title)}</b><small>${esc(docPath(x) || "Home")}</small></div></button>`).join("")}</div>` : `<p class="empty sm">Noch keine Notiz verlinkt diese Seite. Tippe „[[“ in einer anderen Notiz, um hierher zu verlinken.</p>`}`);
    $$("[data-id]", el).forEach(b => b.onclick = () => { close(); go("doc/" + b.dataset.id); });
  };
  body.addEventListener("click", e => {
    const a = e.target.closest("a.plink"); if (a) { e.preventDefault(); go("doc/" + a.dataset.doc); return; }
    const sm = e.target.closest("summary"); if (sm && e.clientX - sm.getBoundingClientRect().left < 30) { e.preventDefault(); const dt = sm.parentElement; dt.open = !dt.open; dirty(); }
  });
  body.addEventListener("input", () => { const sl = getSelection(); if (!sl.rangeCount || !sl.isCollapsed) return; const n = sl.anchorNode; if (n?.nodeType === 3 && n.nodeValue.slice(0, sl.anchorOffset).endsWith("[[")) { const r = document.createRange(); r.setStart(n, sl.anchorOffset - 2); r.setEnd(n, sl.anchorOffset); r.deleteContents(); saved = r.cloneRange(); pagePicker(); } });
  let hlColor = "#fff1a8";
  const colorPop = (anchor, cols, pick, custom) => {
    $(".cpop")?.remove(); const el = document.createElement("div"); el.className = "cpop"; el.innerHTML = cols.map(c => `<button style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join("") + (custom ? `<label class="cust" title="Eigene Farbe">${ic("plus")}<input type="color"></label>` : "");
    document.body.appendChild(el); const r = anchor.getBoundingClientRect(); el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.left + r.width / 2 - el.offsetWidth / 2)) + "px"; el.style.top = r.bottom + 8 + "px"; requestAnimationFrame(() => el.classList.add("on"));
    const close = () => { el.remove(); document.removeEventListener("pointerdown", off, true); }, off = e => { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener("pointerdown", off, true)); el.onmousedown = e => { if (e.target.tagName !== "INPUT") e.preventDefault(); };
    $$("button", el).forEach(b => b.onclick = () => { pick(b.dataset.c); close(); }); const ci = $("input", el); if (ci) ci.oninput = e => { pick(e.target.value); };
    LEAVE.push(close);
  };
  $("#hl-m", m).onmousedown = $("#cl-b", m).onmousedown = noFocus;
  $("#hl-m", m).onclick = e => colorPop(e.currentTarget, ["#fff1a8", "#c8f2d4", "#cfe3ff", "#ffd6e7", "#e4d8ff", "#ffe0c2"], c => { hlColor = c; exec("hiliteColor", c); $("#hl-m", m).style.setProperty("--hc", c); });
  $("#cl-b", m).onclick = e => colorPop(e.currentTarget, ["#1c1c22", "#e5484d", "#f59e0b", "#16a34a", "#2563eb", "#5b3df5", "#ec4899", "#6b6b78"], c => { $("#cl", m).style.borderColor = c; exec("foreColor", c); }, true);
  const paintPaper = () => { const p = $("#paperc", m); [...p.classList].filter(c => /^(p-|f-|fs-|w-)/.test(c)).forEach(c => p.classList.remove(c)); p.classList.add("p-" + paperOf(), "f-" + (d.font || "sans"), "fs-" + (d.fsize || "m"), "w-" + (d.width || "m")); };
  paintPaper();
  const setD = (k, v) => { d[k] = v; save(); paintPaper(); };
  $("#t-blk", m).onclick = e => menu(e.currentTarget, [{ label: "Text", fn: CMD.p }, { label: "Überschrift 1", fn: CMD.h1 }, { label: "Überschrift 2", fn: CMD.h2 }, { label: "Überschrift 3", fn: CMD.h3 }, "-", { label: "Zitat", icon: "quote", fn: CMD.quote }, { label: "Code", icon: "code", fn: CMD.code }, "-", ...[["sans", "Schrift: Standard"], ["serif", "Schrift: Serif"], ["mono", "Schrift: Mono"]].map(([k, l]) => ({ label: l, icon: (d.font || "sans") === k ? "check" : "", fn: () => setD("font", k) })), "-", ...[["s", "Größe: Klein"], ["m", "Größe: Normal"], ["l", "Größe: Groß"]].map(([k, l]) => ({ label: l, icon: (d.fsize || "m") === k ? "check" : "", fn: () => setD("fsize", k) }))]);
  $("#t-ins", m).onclick = e => menu(e.currentTarget, [{ label: "Bild", icon: "image", fn: CMD.image }, { label: "Tabelle", icon: "table", fn: CMD.table }, { label: "Link", icon: "link", fn: CMD.link }, { label: "Formel / Symbol", icon: "text", fn: CMD.formula }, { label: "Aufklappliste", icon: "chev", fn: CMD.toggle }, { label: "Seite verlinken …", icon: "link", fn: CMD.plink }, { label: "Hinweis-Box", icon: "quote", fn: CMD.callout }, { label: "Notizzettel mit Pin", icon: "note", fn: CMD.pinnote }, { label: "Haftnotiz", icon: "note", fn: CMD.sticky }, { label: "Heutiges Datum", icon: "cal", fn: CMD.date }, { label: "Inhaltsverzeichnis", icon: "list", fn: CMD.toc }, "-", { label: "Trennlinie", icon: "hrule", fn: CMD.hr }, { label: "Hochgestellt x²", fn: CMD.sup }, { label: "Tiefgestellt x₂", fn: CMD.sub }, "-", { label: "Linksbündig", icon: "alignl", fn: CMD.left }, { label: "Zentriert", icon: "alignc", fn: CMD.center }, { label: "Rechtsbündig", fn: CMD.right }, { label: "Blocksatz", fn: CMD.justify }, { label: "Einrücken", fn: CMD.indent }, { label: "Ausrücken", fn: CMD.outdent }, "-", { label: "Formatierung entfernen", icon: "rot", fn: CMD.clear }]);
  $("#t-paper", m).onclick = e => menu(e.currentTarget, [...[["white", "Leer"], ["lines", "Liniert"], ["grid", "Kariert"], ["dots", "Punkte"]].map(([k, l]) => ({ label: l, icon: paperOf() === k ? "check" : "", fn: () => { D.profile.paper = k; setD("paper", k); } })), "-", ...[["s", "Seitenbreite: Schmal"], ["m", "Seitenbreite: Normal"], ["l", "Seitenbreite: Breit"]].map(([k, l]) => ({ label: l, icon: (d.width || "m") === k ? "check" : "", fn: () => setD("width", k) }))]);
  /* find & replace */
  const FH = window.CSS && CSS.highlights && window.Highlight ? { all: new Highlight(), cur: new Highlight() } : null; if (FH) { CSS.highlights.set("lumi-find", FH.all); CSS.highlights.set("lumi-find-cur", FH.cur); }
  let fbar = null, fr = [], fi = 0;
  const fScan = q => { fr = []; FH?.all.clear(); FH?.cur.clear(); if (!q) return; const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), lq = q.toLowerCase(); let n; while ((n = w.nextNode())) { const t = n.nodeValue.toLowerCase(); let i = 0; while ((i = t.indexOf(lq, i)) >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); fr.push(r); FH?.all.add(r); i += q.length || 1; } } };
  const fShow = () => { const c = $(".fc", fbar); c.textContent = fr.length ? `${fi + 1}/${fr.length}` : "0"; FH?.cur.clear(); if (fr[fi]) { FH?.cur.add(fr[fi]); fr[fi].startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" }); } };
  const fGo = k => { if (!fr.length) return; fi = (fi + k + fr.length) % fr.length; fShow(); };
  const openFind = () => {
    if (fbar) { $("input", fbar).focus(); $("input", fbar).select(); return; }
    fbar = document.createElement("div"); fbar.className = "findbar"; fbar.innerHTML = `<input class="fq" placeholder="Suchen" aria-label="Suchen"><span class="fc">0</span><button data-k="-1" aria-label="Vorheriger">${ic("up")}</button><button data-k="1" class="dn" aria-label="Nächster">${ic("up")}</button><i></i><input class="fr" placeholder="Ersetzen" aria-label="Ersetzen"><button class="tx" data-a="one">Ersetzen</button><button class="tx" data-a="all">Alle</button><button data-a="x" aria-label="Schließen">${ic("x")}</button>`;
    document.body.appendChild(fbar); requestAnimationFrame(() => fbar.classList.add("on"));
    const q = $(".fq", fbar), rp = $(".fr", fbar), run = () => { fScan(q.value); fi = 0; fShow(); };
    q.oninput = run; q.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); fGo(e.shiftKey ? -1 : 1); } if (e.key === "Escape") closeFind(); }; rp.onkeydown = e => { if (e.key === "Escape") closeFind(); };
    $$("[data-k]", fbar).forEach(b => b.onclick = () => fGo(+b.dataset.k));
    const rep = r => { r.deleteContents(); r.insertNode(document.createTextNode(rp.value)); };
    $('[data-a="one"]', fbar).onclick = () => { if (!fr[fi]) return; rep(fr[fi]); dirty(); body.normalize(); run(); };
    $('[data-a="all"]', fbar).onclick = () => { if (!fr.length) return; const n = fr.length; [...fr].reverse().forEach(rep); dirty(); body.normalize(); run(); toast(`${n} ersetzt`); };
    $('[data-a="x"]', fbar).onclick = closeFind; q.focus(); const sel = getSelection().toString(); if (sel && sel.length < 60 && !sel.includes("\n")) { q.value = sel; run(); }
  };
  const closeFind = () => { fbar?.remove(); fbar = null; fr = []; FH?.all.clear(); FH?.cur.clear(); };
  const fkey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && $("#body")) { e.preventDefault(); openFind(); } };
  document.addEventListener("keydown", fkey); LEAVE.push(() => { document.removeEventListener("keydown", fkey); closeFind(); });
  $$("[data-p]", m).forEach(b => b.onclick = () => go("docs/" + b.dataset.p));
  $("#eb", m).onclick = () => go("docs/" + (d.folderId || ""));
  const rename = () => {
    const b = $("#cr", m); if (!b) return; const inp = document.createElement("input"); inp.className = "nb-in"; inp.value = /^Unbenannte[sr]? (Notiz|Dokument)$/.test(d.title) ? "" : d.title; inp.placeholder = "Name der Notiz"; inp.maxLength = 80; b.replaceWith(inp); inp.focus(); inp.select();
    let done = false; const fin = ok => { if (done) return; done = true; if (ok) { d.title = inp.value.trim() || "Unbenanntes Dokument"; d.updated = Date.now(); save(); } const nb = document.createElement("b"); nb.id = "cr"; nb.title = "Zum Umbenennen klicken"; nb.textContent = d.title; inp.replaceWith(nb); nb.onclick = rename; };
    inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } else if (e.key === "Escape") { fin(false); } };
  };
  $("#cr", m).title = "Zum Umbenennen klicken"; $("#cr", m).onclick = rename; if (renameNext) { renameNext = false; setTimeout(rename, 60); }

  /* floating selection menu */
  const bub = document.createElement("div"); bub.className = "bubble"; bub.hidden = true; document.body.appendChild(bub); LEAVE.push(() => bub.remove());
  bub.innerHTML = [["bold", "bold"], ["italic", "italic"], ["underline", "underline"], ["hilite", "hl"], ["link", "link"]].map(([c, i]) => `<button data-b="${c}">${ic(i)}</button>`).join("") + `<i class="sep"></i><button data-bai>${ic("spark")}<span>Studix AI</span></button>`;
  bub.onmousedown = e => e.preventDefault();
  $$("[data-b]", bub).forEach(b => b.onclick = () => CMD[b.dataset.b]());
  $("[data-bai]", bub).onclick = () => openAiBar();
  function updBubble() { const s = getSelection(); if (!bub.isConnected) return; if (!s.rangeCount || s.isCollapsed || !body.contains(s.anchorNode) || !s.toString().trim()) { bub.hidden = true; return; } const r = s.getRangeAt(0).getBoundingClientRect(); bub.hidden = false; const w = bub.offsetWidth; bub.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; bub.style.top = Math.max(8, r.top - bub.offsetHeight - 10) + "px"; }

  /* inline AI edit bar (right-click, selection, Ctrl+J, space on an empty line) */
  const HLS = window.CSS && CSS.highlights && window.Highlight ? new Highlight() : null; if (HLS) CSS.highlights.set("lumi-ai", HLS);
  LEAVE.push(() => { try { CSS.highlights?.delete("lumi-ai"); } catch {} });
  const QA = [["Kürzer", "Kürze den Text auf das Wesentliche."], ["Ausführlicher", "Formuliere den Text ausführlicher, mit einem kurzen Beispiel."], ["Einfacher", "Formuliere den Text einfacher, so dass ihn ein Vierzehnjähriger versteht."], ["Verbessern", "Korrigiere Rechtschreibung und Grammatik und verbessere den Stil."], ["Formeller", "Formuliere den Text formeller, im Schul- bzw. Uni-Stil."], ["Auf Englisch", "Übersetze den Text ins Englische."], ["Als Liste", "Wandle den Text in eine übersichtliche Aufzählung um."]];
  const ACT = [["Zusammenfassen", "summary"], ["Einfach erklären", "explain"], ["Übersetzen", "translate"], ["Weiterschreiben", "continue"], ["Lernziele", "goals"]], ACI = ["note", "bulb", "rot", "spark", "star"], QI = ["line", "plus", "help", "check", "pen", "globe", "list"];
  const bar = document.createElement("div"); bar.className = "aibar"; bar.hidden = true; document.body.appendChild(bar); LEAVE.push(() => bar.remove());
  bar.innerHTML = `<div class="ab-in">${ic("spark")}<input aria-label="Studix-AI-Anweisung" autocomplete="off"><button class="send" aria-label="Senden">${ic("up")}</button></div><div class="ab-chips">${QA.map(([l], i) => `<button type="button" data-sel>${ic(QI[i])}<span>${l}</span></button>`).join("")}${ACT.map(([l], i) => `<button type="button" data-act="${i}">${ic(ACI[i])}<span>${l}</span></button>`).join("")}</div><div class="ab-busy" hidden><span class="dots"><span></span><span></span><span></span></span><b>Studix AI überarbeitet den Text …</b></div><div class="ab-done" hidden><b>Text aktualisiert</b><button type="button" data-k>Behalten</button><button type="button" data-u>Rückgängig</button></div>`;
  const barIn = $("input", bar); let aiR = null, aiPrev = "", aiState = "idle";
  const blockOf = node => { const el = node?.nodeType === 3 ? node.parentElement : node; const b = el?.closest?.("p,h1,h2,h3,li,blockquote,pre,td,th"); return b && body.contains(b) ? b : null; };
  const setTarget = r => { aiR = r; if (HLS) { HLS.clear(); if (r && !r.collapsed) HLS.add(r); } };
  const closeAi = () => { bar.hidden = true; aiState = "idle"; HLS?.clear(); };
  const panel = w => { $(".ab-in", bar).hidden = w !== "idle"; $(".ab-chips", bar).hidden = w !== "idle"; $$(".ab-chips [data-sel]", bar).forEach(b => b.hidden = !aiR || aiR.collapsed); $(".ab-busy", bar).hidden = w !== "busy"; $(".ab-done", bar).hidden = w !== "done"; };
  function openAiBar(pt) {
    const s = getSelection(); let r = null;
    if (s.rangeCount && !s.isCollapsed && body.contains(s.anchorNode)) r = s.getRangeAt(0).cloneRange();
    else if (saved && !saved.collapsed && !pt) r = saved.cloneRange();
    else { let node = null; if (pt && document.caretRangeFromPoint) node = document.caretRangeFromPoint(pt.x, pt.y)?.startContainer; if (!node) node = s.rangeCount && body.contains(s.anchorNode) ? s.anchorNode : saved?.startContainer; const blk = blockOf(node); if (blk) { r = document.createRange(); r.selectNodeContents(blk); } else if (saved) r = saved.cloneRange(); }
    if (!r) { r = document.createRange(); r.selectNodeContents(body.lastElementChild || body); r.collapse(false); }
    setTarget(r); aiState = "idle"; panel("idle"); barIn.value = ""; barIn.placeholder = r.collapsed || !r.toString().trim() ? "Was soll Studix AI schreiben? z. B. „Definition von Photosynthese“" : "Was soll Studix AI ändern? z. B. „kürzer“, „mit Beispiel“, „auf Englisch“";
    let rects = [...r.getClientRects()].filter(x => x.height > 0); if (!rects.length) { const bl = blockOf(r.startContainer); if (bl) rects = [bl.getBoundingClientRect()]; }
    const last = rects[rects.length - 1] || (pt ? { left: pt.x, top: pt.y, bottom: pt.y } : body.getBoundingClientRect());
    bar.hidden = false; const w = bar.offsetWidth, h = bar.offsetHeight;
    bar.style.left = Math.max(8, Math.min(innerWidth - w - 8, (rects[0]?.left ?? last.left))) + "px";
    bar.style.top = (last.bottom + 12 + h > innerHeight ? Math.max(8, (rects[0]?.top ?? last.top) - h - 12) : last.bottom + 12) + "px";
    setTimeout(() => barIn.focus(), 20);
  }
  async function sendAi(instr) {
    instr = (instr || "").trim(); if (!instr || aiState === "busy" || !aiR) return; aiState = "busy"; panel("busy");
    const text = aiR.toString().trim();
    const prompt = text ? `Anweisung: ${instr}\n\nBearbeite den folgenden Text entsprechend. Gib NUR den neuen Text zurück (ohne Kommentar, ohne Anführungszeichen), in derselben Sprache wie der Text (außer die Anweisung verlangt eine Übersetzung) und behalte Fachbegriffe bei. Dokumenttitel: ${d.title}.\n\nTEXT:\n${text}` : `Schreibe (kurz und prägnant, auf Deutsch) passend zum Dokument „${d.title}“: ${instr}\nGib NUR den Text zurück, ohne Einleitung.\n\nBISHERIGER INHALT (Auszug):\n${body.innerText.slice(0, 1500)}`;
    let res = await ai(prompt, { system: sysBase("You are an inline writing assistant inside a note editor."), max: 1200, quiet: true });
    if (res == null) res = localEdit(instr, text);
    if (res == null) { toast(hasKey() ? "Studix AI hat nicht geantwortet." : "Für diese Studix-AI-Änderung muss Studix AI eingerichtet sein (Einstellungen → Studix AI)."); aiState = "idle"; panel("idle"); return; }
    res = res.trim().replace(/^["„“]|["“”]$/g, ""); aiPrev = body.innerHTML;
    SG.suggestRange(aiR.cloneRange(), res); HLS?.clear(); aiState = "idle"; closeAi();
  }
  $(".send", bar).onclick = () => sendAi(barIn.value); barIn.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); sendAi(barIn.value); } else if (e.key === "Escape") closeAi(); };
  $$(".ab-chips [data-sel]", bar).forEach((b, i) => b.onclick = () => sendAi(QA[i][1]));
  $$(".ab-chips [data-act]", bar).forEach((b, i) => b.onclick = () => { closeAi(); run(ACT[i][1]); });
  $("[data-k]", bar).onclick = closeAi; $("[data-u]", bar).onclick = () => { body.innerHTML = aiPrev; dirty(); closeAi(); };
  const outside = e => { if (!bar.hidden && aiState !== "busy" && !bar.contains(e.target)) closeAi(); };
  document.addEventListener("mousedown", outside, true); LEAVE.push(() => document.removeEventListener("mousedown", outside, true));
  /* Hinweis-Blöcke lassen sich mit Rück- oder Entfernen-Taste auflösen bzw. löschen */
  body.addEventListener("keydown", e => {
    if (e.key !== "Backspace" && e.key !== "Delete") return; const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
    const el = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode, co = el?.closest?.("blockquote, pre"); if (!co || !body.contains(co)) return;
    const txt = co.textContent.replace(/\u00a0/g, " ").trim(), r0 = document.createRange(); r0.setStart(co, 0); r0.setEnd(sel.anchorNode, sel.anchorOffset); const atStart = !r0.toString().replace(co.classList.contains("callout") ? /^Hinweis:\s*/ : /^$/, "").replace(/\u00a0/g, "").length;
    if (txt === "" || txt === "Hinweis:" || (e.key === "Backspace" && atStart)) { e.preventDefault(); const p = document.createElement("p"); const rest = co.textContent.replace(co.classList.contains("callout") ? /^Hinweis:\s*/ : /^$/, "").trim(); if (rest) p.textContent = rest; else p.innerHTML = "<br>"; co.replaceWith(p); const r = document.createRange(); r.selectNodeContents(p); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); dirty(); }
  });

  /* alle Blöcke (Code, Zitat, Hinweis, Tabelle, Aufklappliste, Trennlinie, Bild) lassen sich über einen kleinen Löschknopf entfernen */
  { const DEL = "pre,table,blockquote,details,hr,img,.callout", delb = document.createElement("button"); delb.className = "blk-del"; delb.hidden = true; delb.innerHTML = ic("trash"); delb.title = "Block löschen"; delb.setAttribute("aria-label", "Block löschen"); document.body.appendChild(delb); LEAVE.push(() => delb.remove());
    let tgt = null, ht = 0; const show = el => { tgt = el; clearTimeout(ht); const r = el.getBoundingClientRect(); delb.style.left = Math.min(innerWidth - 44, r.right - 30) + "px"; delb.style.top = Math.max(8, r.top - 12) + "px"; delb.hidden = false; }, hide = () => { clearTimeout(ht); ht = setTimeout(() => { delb.hidden = true; }, 500); };
    body.addEventListener("mouseover", e => { const el = e.target.closest?.(DEL); if (el && body.contains(el) && !el.closest(".sg-ins-blk")) show(el); });
    body.addEventListener("mouseout", e => { if (e.target.closest?.(DEL)) hide(); });
    const fromCaret = () => { const s = getSelection(), n = s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode), el = n && n.closest?.(DEL); if (el && body.contains(el) && el !== body) show(el); };
    body.addEventListener("click", e => { if (e.target.closest?.(DEL)) show(e.target.closest(DEL)); else fromCaret(); }); body.addEventListener("keyup", fromCaret);
    delb.addEventListener("mouseenter", () => clearTimeout(ht)); delb.addEventListener("mouseleave", hide); delb.onmousedown = e => e.preventDefault();
    delb.onclick = () => { if (!tgt || !tgt.isConnected) return; const r = document.createRange(); r.selectNode(tgt); const s = getSelection(); s.removeAllRanges(); s.addRange(r); body.focus(); document.execCommand("delete"); if (tgt.isConnected) tgt.remove(); if (!body.textContent.trim() && !body.querySelector("img,table,hr")) body.innerHTML = "<p><br></p>"; delb.hidden = true; tgt = null; dirty(); };
  }
  body.addEventListener("contextmenu", e => { e.preventDefault(); openAiBar({ x: e.clientX, y: e.clientY }); });
  body.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); openAiBar(); return; }
    if (e.key === " " && !e.ctrlKey && !e.metaKey && sm.hidden) { const s = getSelection(), blk = blockOf(s.anchorNode); if (blk && s.isCollapsed && !blk.textContent.trim() && blk.tagName === "P" && !blk.querySelector("img,table,input")) { e.preventDefault(); openAiBar(); } }
  });

  /* slash menu */
  const SLASH = [["Text", "p", "text absatz"], ["Überschrift 1", "h1", "h1 titel ueberschrift"], ["Überschrift 2", "h2", "h2 ueberschrift"], ["Überschrift 3", "h3", "h3 ueberschrift"], ["Aufzählung", "ul", "liste bullet punkte"], ["Nummerierte Liste", "ol", "liste nummer"], ["Checkliste", "todo", "todo aufgaben check"], ["Tabelle", "table", "tabelle raster"], ["Zitat", "quote", "zitat"], ["Code", "code", "code"], ["Trennlinie", "hr", "linie trenner"], ["Bild", "image", "bild foto"], ["Formel / Symbol", "formula", "formel symbol mathe"], ["Aufklappliste", "toggle", "toggle aufklapp liste details"], ["Seite verlinken", "plink", "link seite verweis wiki"], ["Hinweis-Box", "callout", "hinweis box callout info"], ["Heutiges Datum", "date", "datum heute"], ["Inhaltsverzeichnis", "toc", "inhalt verzeichnis gliederung"], ["KI: Schreiben / ändern…", "ai-edit", "ki schreiben aendern bearbeiten"], ["KI: Zusammenfassung", "ai-summary", "ki summary zusammenfassung"], ["KI: Karteikarten", "ai-cards", "ki karten lernkarten"], ["KI: Quiz", "ai-quiz", "ki quiz test"], ["KI: Lernziele", "ai-goals", "ki lernziele"]];
  const sm = document.createElement("div"); sm.className = "slash"; sm.hidden = true; document.body.appendChild(sm); LEAVE.push(() => sm.remove()); let sIdx = 0, sItems = [], sCtx = null;
  function slashCheck() {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed || s.anchorNode?.nodeType !== 3 || !body.contains(s.anchorNode)) return slashHide();
    const before = s.anchorNode.textContent.slice(0, s.anchorOffset), mm = before.match(/(?:^|\s)\/([a-zäöüß0-9]*)$/i); if (!mm) return slashHide();
    const q = mm[1].toLowerCase(); sItems = SLASH.filter(([n, , kw]) => !q || (n + " " + kw).toLowerCase().includes(q)); if (!sItems.length) return slashHide();
    sCtx = { node: s.anchorNode, end: s.anchorOffset, len: q.length + 1 }; sIdx = 0; slashDraw();
    const r = s.getRangeAt(0).cloneRange(); r.collapse(true); let rc = r.getBoundingClientRect(); if (!rc.height) rc = s.anchorNode.parentElement.getBoundingClientRect();
    sm.hidden = false; sm.style.left = Math.min(innerWidth - sm.offsetWidth - 8, Math.max(8, rc.left)) + "px"; sm.style.top = (rc.bottom + 6 + sm.offsetHeight > innerHeight ? Math.max(8, rc.top - sm.offsetHeight - 6) : rc.bottom + 6) + "px";
  }
  const slashHide = () => { sm.hidden = true; sCtx = null; };
  function slashDraw() { sm.innerHTML = `<small>Blöcke</small>` + sItems.map(([n, k], i) => `<button data-k="${k}" class="${i === sIdx ? "on" : ""}">${n}</button>`).join(""); $$("button", sm).forEach(b => { b.onmousedown = e => { e.preventDefault(); slashPick(b.dataset.k); }; }); sm.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
  function slashPick(k) {
    if (!sCtx) return; const blk = blockOf(sCtx.node), r = document.createRange(); r.setStart(sCtx.node, sCtx.end - sCtx.len); r.setEnd(sCtx.node, sCtx.end); r.deleteContents();
    let caret = r; if (blk && !blk.textContent.trim() && !blk.querySelector("img,table,input")) { blk.innerHTML = "<br>"; caret = document.createRange(); caret.setStart(blk, 0); caret.collapse(true); }
    saved = caret.cloneRange(); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(caret); slashHide(); CMD[k]?.();
  }
  body.addEventListener("keydown", e => { if (sm.hidden) return; if (e.key === "ArrowDown") { e.preventDefault(); sIdx = (sIdx + 1) % sItems.length; slashDraw(); } else if (e.key === "ArrowUp") { e.preventDefault(); sIdx = (sIdx - 1 + sItems.length) % sItems.length; slashDraw(); } else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); slashPick(sItems[sIdx][1]); } else if (e.key === "Escape") slashHide(); });
  body.addEventListener("blur", () => setTimeout(slashHide, 150));

  $("#ai-m", m).onclick = e => menu(e.currentTarget, [{ label: "Text mit Studix AI schreiben / ändern…", icon: "spark", fn: () => openAiBar() }, "-", { label: "Zusammenfassen", icon: "list", fn: () => run("summary") }, { label: "Einfach erklären", icon: "help", fn: () => run("explain") }, { label: "Verbessern & korrigieren", icon: "pen", fn: () => run("improve") }, { label: "Weiterschreiben", icon: "spark", fn: () => run("continue") }, { label: "Übersetzen…", icon: "rot", fn: () => run("translate") }, { label: "Frage zum Text…", icon: "search", fn: () => run("ask") }, "-", { label: "Lernziele ermitteln", icon: "star", fn: () => run("goals") }, { label: "Karteikarten erstellen", icon: "cards", fn: () => run("cards") }, { label: "Quiz erstellen", icon: "help", fn: () => run("quiz") }, ...(ink.st.strokes.length ? [{ label: "Skizze erklären", icon: "brush", fn: explainInk }, { label: "Handschrift in Text umwandeln", icon: "text", fn: handToText }] : [])]);
  async function handToText() { if (!hasKey()) return toast("Handschrift-Erkennung braucht die eingerichtete Studix AI (Einstellungen → Studix AI)."); toast("Studix AI liest deine Handschrift …"); const r = await ai("Transkribiere die handschriftlichen Notizen auf dem Bild möglichst exakt als Text. Behalte Zeilenumbrüche und Listen bei (Listen mit „- “). Gib NUR den Text zurück, ohne Erklärung.", { image: { data: ink.snapshot(), type: "image/jpeg" }, max: 1500 }); if (r?.trim()) { body.insertAdjacentHTML("beforeend", textToHtml(r.trim())); dirty(); toast("Text eingefügt – die Handschrift bleibt erhalten"); } }
  async function explainInk() { if (!hasKey()) return toast("Bild-Analyse braucht die eingerichtete Studix AI (Einstellungen → Studix AI)."); toast("Studix AI schaut hin…"); const r = await ai("Erkläre, was auf dieser Skizze zu sehen ist. Bei Mathematik oder Naturwissenschaft: erkläre Schritt für Schritt.", { image: { data: ink.snapshot(), type: "image/jpeg" } }); if (r) { const { el } = modal(`<h3>Studix AI</h3><textarea class="field" rows="12">${esc(r)}</textarea>`, "wide"); } }
  const dl = (name, mime, data) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const printIt = () => { const w = open("", "_blank"); if (!w) return toast("Pop-up erlaubt?"); const sj = subj(d.subjectId), dt = new Date(d.updated || Date.now()).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(d.title)}</title><style>@page{size:A4;margin:20mm 18mm 22mm}*{box-sizing:border-box}body{font:11.5pt/1.6 "Inter",system-ui,-apple-system,"Segoe UI",sans-serif;color:#15151c;margin:0}header.doc{border-bottom:1.5pt solid #15151c;padding-bottom:8pt;margin-bottom:16pt}header.doc h1{font-size:22pt;letter-spacing:-.02em;margin:0}header.doc small{color:#6b6b78;font-size:9.5pt}h1,h2,h3{break-after:avoid;line-height:1.25}h2{font-size:15pt;margin:18pt 0 6pt}h3{font-size:12.5pt;margin:14pt 0 4pt}p,li,blockquote,tr,pre,img,table{break-inside:avoid}p{margin:0 0 7pt}table{border-collapse:collapse;width:100%;margin:8pt 0}td,th{border:.75pt solid #b9b9c6;padding:5pt 8pt;text-align:left}th{background:#f1f1f5}img{max-width:100%;height:auto;border-radius:3pt}pre{background:#f3f3f7;padding:9pt;border-radius:4pt;white-space:pre-wrap;font-size:9.5pt}blockquote{border-left:3pt solid #c9c9d6;margin:8pt 0;padding-left:11pt;color:#4b4b58}ul.chk{list-style:none;padding-left:2pt}mark{background:#fff3a3;color:inherit}footer{position:fixed;bottom:-14mm;left:0;right:0;text-align:center;font-size:8.5pt;color:#9a9aa8}@media screen{body{max-width:190mm;margin:20px auto;padding:0 12px}}</style><header class="doc"><h1>${esc(d.title)}</h1><small>${sj ? esc(sj.name) + " · " : ""}${dt}</small></header>${lumiHtml(body)}<footer>${esc(d.title)} · Studix</footer>`); w.document.close(); toast("Im Druckdialog „Als PDF sichern“ wählen"); setTimeout(() => w.print(), 500); };
  const outlineModal = () => { const hs = $$("h1,h2,h3", body); const { el, close } = modal(`<h3>Gliederung</h3><div class="outline">${hs.length ? hs.map((h, i) => `<button class="o${h.tagName[1]}" data-o="${i}">${esc(h.textContent.trim() || "…")}</button>`).join("") : `<p class="note">Noch keine Überschriften. Tippe „/“ → Überschrift.</p>`}</div>`); $$("[data-o]", el).forEach(b => b.onclick = () => { close(); hs[+b.dataset.o].scrollIntoView({ behavior: "smooth", block: "center" }); }); };
  $("#mo-m", m).onclick = e => menu(e.currentTarget, [{ label: stat, icon: "note", fn: () => {} }, "-", { label: "Umbenennen", icon: "pen", fn: rename }, { label: "Fach zuordnen…", icon: "star", fn: () => { const { el, close } = modal(`<h3>Fach zuordnen</h3><div class="chips">${[{ id: "", name: "Kein Fach", color: "#999" }, ...D.subjects].map(x => `<button class="chip ${x.id === d.subjectId ? "on" : ""}" data-s="${x.id}"><i class="sdot" style="background:${x.color}"></i>${esc(x.name)}</button>`).join("")}</div>`); $$("[data-s]", el).forEach(b => b.onclick = () => { d.subjectId = b.dataset.s; save(); close(); refreshNav(); toast("Zugeordnet"); }); } }, ...(d.msLink ? [{ label: "In OneNote öffnen", icon: "link", fn: () => window.open(d.msLink, "_blank", "noopener") }] : []), { label: "Suchen & Ersetzen", icon: "search", fn: openFind }, { label: "Verlinkt von …", icon: "link", fn: backlinks }, { label: "Gliederung", icon: "list", fn: outlineModal }, { label: "Als PDF drucken", icon: "file", fn: printIt }, { label: "Als Textdatei (.txt)", icon: "note", fn: () => dl(d.title + ".txt", "text/plain", body.innerText) }, { label: "Als HTML-Datei", icon: "code", fn: () => dl(d.title + ".html", "text/html", `<meta charset="utf-8"><title>${esc(d.title)}</title>${body.innerHTML}`) }, "-", { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); toast(d.pinned ? "Angeheftet" : "Gelöst"); } }, { label: "Duplizieren", icon: "copy", fn: async () => { const id = uid(); D.docs.unshift({ ...d, id, title: d.title + " (Kopie)", created: Date.now(), updated: Date.now(), msId: undefined, source: undefined, pinned: false }); await KV.set("html:" + id, body.innerHTML); if (ink.st.strokes.length) await KV.set("ink:" + id, ink.st.strokes); save(); go("doc/" + id); } }, "-", { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); go("docs/" + (d.folderId || "")); } }]);
  /* ink layer: write and draw in the same document */
  const paper = $("#paperc", m); setScroller(paper); const inkSave = debounce(async () => { if (!D.docs.includes(d)) return; d.hasInk = ink.st.strokes.length > 0; d.updated = Date.now(); await KV.set("ink:" + d.id, ink.st.strokes); save(); svEl.textContent = "Gespeichert"; }, 600);
  const fitInk = mx => { paper.style.minHeight = mx > 0 ? Math.max(mx + 260, 0) + "px" : ""; };
  const AUD = {};
  const ink = createInk(paper, d, { grid: true, audio: AUD, bar: $("#rib-draw", m), onChange: (strokes, mx) => { svEl.textContent = "Speichert…"; fitInk(mx); inkSave(); window.__co?.touch(); } });
  const inkData = await KV.get("ink:" + d.id); if (inkData?.length) { ink.load(inkData); fitInk(Math.max(...inkData.flatMap(s => s.pts.map(q => q[1])))); } else ink.load([]);
  const tbSave = debounce(async () => { if (!D.docs.includes(d)) return; d.updated = Date.now(); await KV.set("tb:" + d.id, TBX.get()); save(); svEl.textContent = "Gespeichert"; }, 500);
  const TBX = mountTextBoxes(paper, { onChange: () => { svEl.textContent = "Speichert…"; tbSave(); window.__co?.touch(); } }); TBX.load(await KV.get("tb:" + d.id)); LEAVE.push(() => TBX.destroy());
  const CO = collabAttach({ d, m, body, TBX, ink, dirty, svEl }); LEAVE.push(() => CO.destroy());
  let mode = "write"; const msw = $("#msw", m);
  const setMode = k => { mode = k; ink.mode(k === "draw"); body.contentEditable = k === "write"; m.classList.toggle("drawing", k === "draw"); msw.dataset.m = k; $$("button", msw).forEach(b => b.classList.toggle("on", b.dataset.m === k)); if (k === "draw") { getSelection().removeAllRanges(); bub.hidden = true; } else body.focus({ preventScroll: true }); };
  $$("button", msw).forEach(b => b.onclick = () => setMode(b.dataset.m));
  /* Handy: Dokumente nur ansehen; „Bearbeiten“ erlaubt ausschliesslich Text tippen und löschen (keine Formate, Blöcke, Einfügen, KI, Zeichnen) */
  { const MV = matchMedia("(max-width:900px)"), eb = $("#mv-edit", m); let ed = false;
    const apply = () => { const on = MV.matches; m.classList.toggle("m-view", on); m.classList.toggle("m-edit", on && ed); eb.textContent = ed ? "Fertig" : "Bearbeiten"; if (!on) return; if (mode === "draw") { mode = "write"; ink.mode(false); msw.dataset.m = "write"; } body.contentEditable = ed ? "true" : "false"; body.spellcheck = ed; if (!ed) { getSelection().removeAllRanges(); body.blur(); bub.hidden = true; try { slashHide(); } catch {} } };
    eb.onclick = () => { ed = !ed; apply(); if (ed) { body.focus(); const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } };
    MV.addEventListener?.("change", apply); apply();
    const plain = ["insertText", "insertCompositionText", "insertReplacementText", "insertLineBreak", "insertParagraph", "deleteContentBackward", "deleteContentForward", "deleteWordBackward", "deleteWordForward", "deleteSoftLineBackward", "deleteSoftLineForward", "deleteHardLineBackward", "deleteHardLineForward", "deleteByCut", "deleteContent", "historyUndo", "historyRedo"];
    body.addEventListener("beforeinput", e => {
      if (!m.classList.contains("m-edit")) return;
      if (e.inputType === "insertFromPaste" || e.inputType === "insertFromPasteAsQuotation") { e.preventDefault(); const t = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || ""; if (t) document.execCommand("insertText", false, t); return; }
      if (!plain.includes(e.inputType)) e.preventDefault();
    }, true);
    body.addEventListener("paste", e => { if (!m.classList.contains("m-edit")) return; e.preventDefault(); e.stopImmediatePropagation(); const t = e.clipboardData?.getData("text/plain") || ""; if (t) document.execCommand("insertText", false, t); }, true);
    ["drop", "dragstart"].forEach(t => body.addEventListener(t, e => { if (m.classList.contains("m-edit")) { e.preventDefault(); e.stopImmediatePropagation(); } }, true));
    body.addEventListener("input", e => { if (!m.classList.contains("m-edit")) return; e.stopImmediatePropagation(); dirty(); }, true);
    body.addEventListener("keydown", e => { if (!m.classList.contains("m-edit")) return; if (e.key === "Tab" || e.ctrlKey || e.metaKey && !/^[acvxz]$/i.test(e.key)) e.preventDefault(); e.stopImmediatePropagation(); }, true);
  }
  /* Menüband: Kategorien wie in Word (Start · Einfügen · Zeichnen · Design · Überprüfen · Ansicht); Klick auf die aktive Kategorie klappt das Band ein/aus */
  { const tabs = $$("#rtabs [data-t]", m), panels = $$(".rp", m), rib = $("#rib", m); let cur = "start";
    
    const show = (t, init) => { cur = t; tabs.forEach(b => { b.classList.toggle("on", b.dataset.t === t); b.setAttribute("aria-selected", b.dataset.t === t); }); panels.forEach(p => p.classList.toggle("on", p.dataset.pn === t)); if (!init) setMode(t === "draw" ? "draw" : "write"); };
    tabs.forEach(b => b.onclick = () => { if (b.dataset.t === cur) return; show(b.dataset.t); });
    show("start", true);
    const paintR = () => { $("#r-acv", m).textContent = { suggest: "Unterstreichen", auto: "Automatisch", off: "Aus" }[D.profile.autoCorrect || "suggest"]; const sv = $("#r-srcv", m); if (sv) sv.textContent = sourcesOn() ? "An" : "Aus"; };
    paintR(); $("#r-ac", m).onclick = () => { const o = ["suggest", "auto", "off"], i = o.indexOf(D.profile.autoCorrect || "suggest"); D.profile.autoCorrect = o[(i + 1) % 3]; save(); paintR(); toast("Auto-Korrektur: " + { suggest: "Unterstreichen", auto: "automatisch übernehmen", off: "aus" }[D.profile.autoCorrect]); };
    $("#r-src", m)?.addEventListener("click", () => { D.profile.sources = !sourcesOn(); save(); paintR(); });
  }
  LEAVE.push(() => { ink.destroy(); });
  attachAudio(m, d, ink, AUD).then(a => LEAVE.push(() => a.destroy())).catch(() => {});
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}
  if (!body.innerHTML.trim()) body.innerHTML = "<p><br></p>";
  if (window.__aiReveal === d.id && html && html.trim()) {
    window.__aiReveal = ""; body.contentEditable = "false"; svEl.textContent = "Studix AI schreibt …"; paper.classList.add("ai-writing");
    const orig = body.innerHTML, ms = wordReveal(body);
    setTimeout(() => { body.innerHTML = orig; body.contentEditable = "true"; paper.classList.remove("ai-writing"); svEl.textContent = "Gespeichert"; }, ms);
  }
  count(); if (!html || !html.trim()) body.focus();
}

/* ---------- file viewer ---------- */
async function fileViewer(m, d) {
  const blob = await KV.get("blob:" + d.id); const url = blob ? URL.createObjectURL(blob) : "";
  const isImg = /^image\//.test(d.mime), isPdf = d.mime === "application/pdf" || /\.pdf$/i.test(d.title), isTxt = /^text\//.test(d.mime) || /\.(txt|md|csv)$/i.test(d.title);
  if (isPdf && blob) return pdfEditor(m, d, blob);
  m.classList.add("doc-full"); const fp = folderPath(d.folderId);
  m.innerHTML = `<div class="ned dfull pdfed fileed"><div class="ned-bar">
    <div class="nb-l"><button class="icon-btn" id="eb" aria-label="Zurück">${ic("back")}</button><div class="nb-name"><b id="cr" title="Zum Umbenennen klicken">${esc(d.title)}</b><button class="nb-folder" data-p="${d.folderId || ""}">${ic("folder")}<span>${["Home", ...fp.map(f => f.name)].map(esc).join(" / ")}</span></button></div></div>
    <div class="nb-r"><span class="saved" id="sv">Gespeichert</span><button class="icon-btn" id="mo-m" aria-label="Mehr">${ic("more")}</button><button class="icon-btn aitog" id="ai-m" aria-label="AI ein- und ausklappen" title="AI ein- und ausklappen">${ic("aipanel")}<span class="hide-sm">AI</span></button></div></div>
  <div class="pdfwrap"><article class="ned-paper pdfpaper viewer" id="paperc">${!blob ? `<p class="empty">Datei nicht gefunden.</p>` : isImg ? `<img src="${url}" alt="${esc(d.title)}">` : isPdf ? `<iframe src="${url}" title="${esc(d.title)}"></iframe>` : isTxt ? `<pre id="txtv">Lädt…</pre>` : `<div class="emptybox"><div class="big-ic">${ic("file")}</div><h3>${esc(d.title)}</h3><p>${(d.size / 1024).toFixed(0)} KB – für diesen Dateityp gibt es keine Vorschau. Lade die Datei herunter.</p></div>`}</article></div></div>`;
  setScroller($("#paperc", m)); if (url) LEAVE.push(() => URL.revokeObjectURL(url));
  if (isTxt && blob) blob.text().then(t => $("#txtv", m).textContent = t);
  $("#eb", m).onclick = () => go("docs/" + (d.folderId || "")); $$("[data-p]", m).forEach(b => b.onclick = () => go("docs/" + b.dataset.p));
  const rename = () => {
    const b = $("#cr", m); if (!b) return; const inp = document.createElement("input"); inp.className = "nb-in"; inp.value = d.title; inp.maxLength = 120; b.replaceWith(inp); inp.focus(); inp.select();
    let done = false; const fin = ok => { if (done) return; done = true; if (ok && inp.value.trim()) { d.title = inp.value.trim(); d.updated = Date.now(); save(); } const nb = document.createElement("b"); nb.id = "cr"; nb.title = "Zum Umbenennen klicken"; nb.textContent = d.title; inp.replaceWith(nb); nb.onclick = rename; };
    inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); else if (e.key === "Escape") fin(false); };
  };
  $("#cr", m).onclick = rename;
  $("#mo-m", m).onclick = e => menu(e.currentTarget, [{ label: "Umbenennen", icon: "pen", fn: rename },
    { label: "Fach zuordnen…", icon: "star", fn: () => { const { el, close } = modal(`<h3>Fach zuordnen</h3><div class="chips">${[{ id: "", name: "Kein Fach", color: "#999" }, ...D.subjects].map(x => `<button class="chip ${x.id === d.subjectId ? "on" : ""}" data-s="${x.id}"><i class="sdot" style="background:${x.color}"></i>${esc(x.name)}</button>`).join("")}</div>`); $$("[data-s]", el).forEach(b => b.onclick = () => { d.subjectId = b.dataset.s; save(); close(); refreshNav(); toast("Zugeordnet"); }); } },
    ...(blob ? [{ label: "Herunterladen", icon: "download", fn: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = d.title; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); } }, { label: "Drucken", icon: "file", fn: () => { const u = URL.createObjectURL(blob), w = open(u); if (w) w.addEventListener("load", () => w.print()); else toast("Pop-ups erlauben, um zu drucken"); setTimeout(() => URL.revokeObjectURL(u), 60000); } }] : []),
    ...(isImg && blob ? [{ label: "Bild von Studix AI erklären lassen", icon: "camera", fn: async () => { const r = await explainImage(blob); if (r) modal(`<h3>Studix-AI-Erklärung</h3><div class="result">${esc(r)}</div>`, "wide"); } }] : []),
    "-", { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); toast(d.pinned ? "Angeheftet" : "Gelöst"); } },
    { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); go("docs/" + (d.folderId || "")); } }]);
}
async function blobToJpeg(b, max = 1400) { const bmp = await createImageBitmap(b), s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = bmp.width * s; c.height = bmp.height * s; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .85).split(",")[1]; }
async function explainImage(b) { if (!hasKey()) { toast("Bild-Analyse braucht die eingerichtete Studix AI (Einstellungen → Studix AI)."); return null; } toast("Studix AI schaut sich das Bild an…"); return ai("Beschreibe und erkläre, was auf dem Bild zu sehen ist (Aufgabe, Skizze, Tafelbild o. Ä.). Falls es eine Aufgabe ist, gib Hinweise zum Lösungsweg statt nur das Ergebnis.", { image: { data: await blobToJpeg(b), type: "image/jpeg" } }); }
