"use strict";
/* Studix – Startseite anpassen: echtes Raster (6 Spalten × 4 Reihen). Blöcke liegen auf festen Zellen, lassen sich ersetzen, verschieben und in der Größe ziehen.
   Unter dem Raster bleibt immer ein Bereich für die Studix-AI-Eingabe frei. Layout liegt in D.profile.home = [{id,type,c,r,w,h}]. */
const HB = {
  tasks: { n: "Aufgaben", d: "Heutige Aufgaben abhaken", i: "list", w: 2, h: 2, mw: 2, mh: 1 },
  cal: { n: "Kalender", d: "Termine, Prüfungen, Abgaben", i: "cal", w: 2, h: 2, mw: 2, mh: 2 },
  goal: { n: "Fokus", d: "Timer zum Einstellen", i: "timer", w: 2, h: 2, mw: 1, mh: 1 },
  ring: { n: "Tagesziel", d: "Lernzeit heute als Ring", i: "timer", w: 2, h: 2, mw: 1, mh: 1 },
  ex: { n: "Prüfungen", d: "Die nächsten Prüfungen", i: "book", w: 2, h: 2, mw: 2, mh: 1 },
  hw: { n: "Hausaufgaben", d: "Offene Hausaufgaben", i: "list", w: 2, h: 2, mw: 2, mh: 2 },
  tt: { n: "Stundenplan", d: "Die Stunden von heute", i: "cal", w: 2, h: 2, mw: 2, mh: 2 },
  rec: { n: "Zuletzt", d: "Zuletzt bearbeitete Dokumente", i: "folder", w: 2, h: 2, mw: 2, mh: 1 },
  pinned: { n: "Angeheftet", d: "Deine angehefteten Dokumente", i: "star", w: 2, h: 2, mw: 2, mh: 2 },
  cards: { n: "Karteikarten", d: "Fällige Karten", i: "cards", w: 2, h: 1, mw: 2, mh: 1 },
  grades: { n: "Noten", d: "Gesamtschnitt", i: "award", w: 1, h: 1, mw: 1, mh: 1 },
  streak: { n: "Lernserie", d: "Tage in Folge", i: "flame", w: 1, h: 1, mw: 1, mh: 1 },
  week: { n: "Woche", d: "Lernzeit der letzten 7 Tage", i: "chart", w: 2, h: 2, mw: 2, mh: 2 },
  subjects: { n: "Fächer", d: "Deine Fächer mit offenen Aufgaben", i: "folder", w: 2, h: 1, mw: 2, mh: 1 },
  quick: { n: "Schnellstart", d: "Dokument, Quiz, Karteikarten", i: "spark", w: 2, h: 1, mw: 2, mh: 1 },
  note: { n: "Notizzettel", d: "Schneller Notizzettel auf der Startseite", i: "note", w: 2, h: 2, mw: 2, mh: 2 },
  clock: { n: "Uhr & Datum", d: "Uhrzeit und heutiges Datum", i: "timer", w: 2, h: 1, mw: 2, mh: 1 },
};
const HOME_COLS = 6, HOME_ROWS = 4, HOME_MAXROW = 8, HOME_DOCK = null;
const HOME_TPL = {
  std: { n: "Standard", d: "Uhr, Zuletzt, Kalender, Noten, Prüfungen, Aufgaben", l: [["clock", 1, 1, 2, 1], ["rec", 1, 2, 2, 1], ["cal", 3, 1, 2, 2], ["grades", 5, 1, 2, 2], ["ex", 1, 3, 2, 2], ["tasks", 3, 3, 4, 2]] },
  /* früherer Standard: wer ihn nie verändert hat, bekommt automatisch den neuen */
  _old: { n: "", d: "", l: [["clock", 1, 1, 2, 1], ["rec", 1, 2, 2, 1], ["cal", 3, 1, 2, 2], ["goal", 5, 1, 2, 2], ["ex", 1, 3, 2, 2], ["tasks", 3, 3, 2, 2], ["grades", 5, 3, 2, 2]] },
  classic: { n: "Klassisch", d: "Aufgaben, Kalender, Fokus, Prüfungen, Zuletzt", l: [["tasks", 1, 1, 2, 2], ["cal", 3, 1, 2, 2], ["goal", 5, 1, 2, 2], ["ex", 1, 3, 2, 2], ["rec", 3, 3, 2, 2], ["cards", 5, 3, 2, 1]] },
  focus: { n: "Fokus", d: "Großer Timer, dazu Aufgaben und Kalender", l: [["goal", 1, 1, 2, 4], ["tasks", 3, 1, 2, 2], ["cal", 5, 1, 2, 2], ["ex", 3, 3, 2, 2], ["cards", 5, 3, 2, 1]] },
  plan: { n: "Planer", d: "Großer Kalender mit Aufgaben und Prüfungen", l: [["cal", 1, 1, 3, 4], ["tasks", 4, 1, 3, 2], ["ex", 4, 3, 3, 1], ["cards", 4, 4, 1, 1]] },
  learn: { n: "Lernen", d: "Karteikarten, Fokus und Wochenverlauf", l: [["cards", 1, 1, 2, 2], ["goal", 3, 1, 2, 2], ["week", 5, 1, 2, 2], ["rec", 1, 3, 2, 2], ["tasks", 3, 3, 2, 2], ["ex", 5, 3, 2, 1]] },
  school: { n: "Schule", d: "Stundenplan, Hausaufgaben, Prüfungen, Noten", l: [["tt", 1, 1, 2, 2], ["hw", 3, 1, 2, 2], ["ex", 5, 1, 2, 2], ["tasks", 1, 3, 2, 2], ["grades", 3, 3, 1, 2], ["streak", 4, 3, 1, 2], ["cards", 5, 3, 2, 1]] },
  over: { n: "Übersicht", d: "Uhr, Serie, Noten, Tagesziel und Aufgaben", l: [["clock", 1, 1, 2, 1], ["streak", 3, 1, 1, 1], ["grades", 4, 1, 1, 1], ["ring", 5, 1, 2, 2], ["tasks", 1, 2, 4, 2], ["ex", 1, 4, 4, 1], ["rec", 5, 3, 2, 1]] },
  mini: { n: "Minimal", d: "Nur Aufgaben und Kalender", l: [["tasks", 1, 1, 3, 4], ["cal", 4, 1, 3, 3], ["quick", 4, 4, 1, 1]] },
};
const homeUid = () => "b" + Math.random().toString(36).slice(2, 7);
const homeOv = (a, b) => a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;
const homeMin = b => ({ w: HB[b.type]?.mw || 1, h: HB[b.type]?.mh || 1 });
const homeClamp = (b) => { const mn = homeMin(b); b.w = Math.max(mn.w, Math.min(HOME_COLS, b.w | 0 || 2)); b.h = Math.max(mn.h, Math.min(HOME_ROWS, b.h | 0 || 2)); b.c = Math.max(1, Math.min(HOME_COLS + 1 - b.w, b.c | 0 || 1)); b.r = Math.max(1, Math.min(HOME_MAXROW + 1 - b.h, b.r | 0 || 1)); return b; };
/* Kollisionen auflösen: der bewegte Block behält seinen Platz, andere rutschen nach unten (Studix-AI-Platz bleibt frei) */
function homeResolve(L, firstId) {
  const placed = [], order = [...L].sort((a, b) => (a.id === firstId ? -1 : b.id === firstId ? 1 : 0) || a.r - b.r || a.c - b.c);
  for (const b of order) {
    homeClamp(b);
    if (placed.some(p => homeOv(p, b))) {   // nächstgelegene freie Stelle (z. B. der Platz, den der bewegte Block verlassen hat)
      let best = null;
      for (let r = 1; r + b.h - 1 <= HOME_MAXROW; r++) for (let c = 1; c + b.w - 1 <= HOME_COLS; c++) { const t = { c, r, w: b.w, h: b.h }; if (!placed.some(p => homeOv(p, t))) { const d = Math.abs(c - b.c) + Math.abs(r - b.r) * 1.5; if (!best || d < best.d) best = { c, r, d }; } }
      if (best) { b.c = best.c; b.r = best.r; } else { while (placed.some(p => homeOv(p, b))) b.r++; }
    }
    placed.push(b);
  }
  return L;
}
function homeFree(L, w, h) {
  const all = [...L];
  for (let r = 1; r <= HOME_MAXROW; r++) for (let c = 1; c + w - 1 <= HOME_COLS; c++) { const t = { c, r, w, h }; if (!all.some(p => homeOv(p, t))) return { c, r }; }
  return { c: 1, r: HOME_MAXROW };
}
const homeFromTpl = k => HOME_TPL[k].l.map(([type, c, r, w, h]) => ({ id: homeUid(), type, c, r, w, h }));
function homeLayout() {
  let raw = Array.isArray(D.profile.home) ? D.profile.home : [];
  const sig = a => JSON.stringify(a.map(b => [b.type, b.c, b.r, b.w, b.h]).sort()); if (raw.length && sig(raw) === sig(HOME_TPL._old.l.map(([type, c, r, w, h]) => ({ type, c, r, w, h })))) raw = [];   // unveränderter alter Standard → neuer Standard
  const seen = new Set(), L = [];
  for (const b of raw) { if (!b || !HB[b.type] || seen.has(b.type)) continue; seen.add(b.type); const x = { id: b.id || homeUid(), type: b.type, w: b.w, h: b.h, c: b.c, r: b.r }; homeClamp({ ...x, c: 1, r: 1 }); x.w = Math.max(HB[b.type].mw || 1, Math.min(HOME_COLS, x.w | 0 || HB[b.type].w)); x.h = Math.max(HB[b.type].mh || 1, Math.min(HOME_ROWS, x.h | 0 || HB[b.type].h)); if (!x.c || !x.r) { const f = homeFree(L, x.w, x.h); x.c = f.c; x.r = f.r; } L.push(x); }
  if (!L.length) return homeFromTpl("std");
  return homeResolve(L);
}

function homeEditor() {
  let L = homeLayout().map(b => ({ ...b }));
  const root = document.createElement("div"); root.className = "hed"; root.tabIndex = -1; document.body.appendChild(root); document.body.classList.add("hed-open");
  const commit = () => { D.profile.home = L.map(b => ({ ...b })); save(); };
  const close = () => { root.remove(); document.body.classList.remove("hed-open"); if (typeof curView !== "undefined" && (curView === "today" || curView === "settings")) renderView(); };
  const used = () => new Set(L.map(b => b.type));
  const rowsN = () => Math.max(HOME_ROWS, ...L.map(b => b.r + b.h - 1));
  const pos = b => `--c:${b.c};--r:${b.r};--w:${b.w};--h:${b.h}`;
  const blockEl = b => `<div class="hb" data-b="${b.id}" style="${pos(b)}"><div class="hb-in"><span class="hb-i">${ic(HB[b.type].i)}</span><b>${HB[b.type].n}</b><small>${HB[b.type].d}</small></div><span class="hb-sz">${b.w} × ${b.h}${homeMin(b).w > 1 || homeMin(b).h > 1 ? " · min " + homeMin(b).w + " × " + homeMin(b).h : ""}</span><div class="hb-bar"><button data-sw="${b.id}" title="Block ersetzen">${ic("pen")}<span>Ersetzen</span></button><button data-rm="${b.id}" title="Entfernen" aria-label="Entfernen">${ic("trash")}</button></div><i class="hb-rz" data-rz="${b.id}" title="Größe ändern"></i></div>`;
  const draw = () => {
    const N = rowsN(), cells = Array.from({ length: N * HOME_COLS }, (_, i) => `<i class="hc" style="grid-column:${i % HOME_COLS + 1};grid-row:${Math.floor(i / HOME_COLS) + 1}"></i>`).join("");
    root.innerHTML = `<div class="hed-top"><div><h2>Startseite bearbeiten</h2><p>Blöcke ziehen rastet auf das Raster ein · Ecke unten rechts ändert die Größe · „Ersetzen“ tauscht den Inhalt.</p></div><div class="hed-act"><button class="btn ghost" id="hd-t">${ic("table")}Vorlagen</button><button class="btn ghost" id="hd-a">${ic("plus")}Block</button><button class="btn ghost" id="hd-r">Zurücksetzen</button><button class="btn accent" id="hd-d">Fertig</button></div></div>
    <div class="hed-stage"><div class="hed-grid" id="hd-g" style="--n:${N}">${cells}${L.map(blockEl).join("")}<i class="hed-fold" style="top:${12 + Math.max(0, innerHeight - 180)}px"><span>Ab hier scrollt die Startseite</span></i></div></div><p class="hed-note">Ganz unten bleibt immer Platz für die Studix-AI-Eingabe. Auf dem Handy stehen die Blöcke untereinander – in der Reihenfolge von oben nach unten wie hier.</p>`;
    bind();
  };
  const metrics = () => { const g = $("#hd-g", root), cs = $$(".hc", g), a = cs[0].getBoundingClientRect(), b = cs[1].getBoundingClientRect(), c = cs[HOME_COLS].getBoundingClientRect(); return { g, x0: a.left, y0: a.top, sx: b.left - a.left, sy: c.top - a.top }; };
  const bind = () => {
    $("#hd-d", root).onclick = () => { commit(); close(); toast("Startseite gespeichert"); };
    $("#hd-r", root).onclick = () => { L = homeFromTpl("std"); commit(); draw(); };
    $("#hd-t", root).onclick = e => menu(e.currentTarget, Object.entries(HOME_TPL).filter(([k]) => k !== "_old").map(([k, t]) => ({ label: t.n + " – " + t.d, icon: "table", fn: () => { L = homeFromTpl(k); commit(); draw(); } })));
    $("#hd-a", root).onclick = e => { const free = Object.keys(HB).filter(t => !used().has(t)); if (!free.length) return toast("Alle Blöcke sind schon auf der Startseite"); menu(e.currentTarget, free.map(t => ({ label: HB[t].n + " – " + HB[t].d, icon: HB[t].i, fn: () => { const f = homeFree(L, HB[t].w, HB[t].h); L.push({ id: homeUid(), type: t, c: f.c, r: f.r, w: HB[t].w, h: HB[t].h }); homeResolve(L); commit(); draw(); } }))); };
    $$("[data-rm]", root).forEach(b => b.onclick = () => { L = L.filter(x => x.id !== b.dataset.rm); commit(); draw(); });
    $$("[data-sw]", root).forEach(b => b.onclick = () => { const cur = L.find(x => x.id === b.dataset.sw), items = Object.keys(HB).filter(t => !used().has(t)).map(t => ({ label: HB[t].n + " – " + HB[t].d, icon: HB[t].i, fn: () => { cur.type = t; homeClamp(cur); homeResolve(L, cur.id); commit(); draw(); } })); if (!items.length) return toast("Alle anderen Blöcke sind schon in Benutzung"); menu(b, items); });
    /* Größe ändern – rastet pro Zelle ein */
    $$("[data-rz]", root).forEach(h => h.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation(); const b = L.find(x => x.id === h.dataset.rz), el = h.closest(".hb"), M = metrics(), x0 = e.clientX, y0 = e.clientY, w0 = b.w, h0 = b.h;
      const ghost = document.createElement("div"); ghost.className = "hb-ghost"; M.g.appendChild(ghost); el.classList.add("rzing");
      const calc = ev => ({ w: Math.max(homeMin(b).w, Math.min(HOME_COLS + 1 - b.c, w0 + Math.round((ev.clientX - x0) / M.sx))), h: Math.max(homeMin(b).h, Math.min(HOME_ROWS, h0 + Math.round((ev.clientY - y0) / M.sy))) });
      const mv = ev => { const n = calc(ev); el.style.setProperty("--w", n.w); el.style.setProperty("--h", n.h); $(".hb-sz", el).textContent = n.w + " × " + n.h; ghost.style.cssText = `grid-column:${b.c}/span ${n.w};grid-row:${b.r}/span ${n.h}`; };
      const up = ev => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); const n = calc(ev); b.w = n.w; b.h = n.h; homeResolve(L, b.id); commit(); draw(); };
      mv(e); addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
    /* Verschieben – Block folgt dem Zeiger, Ziel-Zelle wird markiert, beim Loslassen rastet er ein */
    $$(".hb:not(.hb-lock)", root).forEach(el => el.onpointerdown = e => {
      if (e.target.closest("button,[data-rz]")) return; e.preventDefault();
      const b = L.find(x => x.id === el.dataset.b), M = metrics(), sx = e.clientX, sy = e.clientY, r0 = el.getBoundingClientRect(); let moved = false, ghost = null, tc = b.c, tr = b.r;
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 6) return;
        if (!moved) { moved = true; el.classList.add("drag"); ghost = document.createElement("div"); ghost.className = "hb-ghost"; M.g.appendChild(ghost); }
        el.style.transform = `translate(${dx}px,${dy}px)`;
        tc = Math.max(1, Math.min(HOME_COLS + 1 - b.w, Math.round((r0.left + dx - M.x0) / M.sx) + 1)); tr = Math.max(1, Math.min(HOME_MAXROW + 1 - b.h, Math.round((r0.top + dy - M.y0) / M.sy) + 1));
        ghost.style.cssText = `grid-column:${tc}/span ${b.w};grid-row:${tr}/span ${b.h}`;
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); if (moved) { b.c = tc; b.r = tr; homeResolve(L, b.id); commit(); draw(); } };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
  };
  root.onkeydown = e => { if (e.key === "Escape" && !document.querySelector(".popmenu")) { commit(); close(); } };
  draw();
}
