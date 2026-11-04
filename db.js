"use strict";
/* Studix databases – table, board and calendar views over the same rows (AppFlowy/Notion-style, own implementation) */

const DB_COLORS = ["#e6defe", "#dbeafe", "#d1fae5", "#fef3c7", "#ffe4e6", "#e0f2fe", "#fce7f3", "#ede9fe"];
const DB_TYPES = { text: "Text", num: "Zahl", date: "Datum", select: "Auswahl", check: "Checkbox" };
const DB_TPL = {
  blank: () => ({ cols: [{ id: "c1", name: "Name", type: "text" }, { id: "c2", name: "Tags", type: "select", opts: [] }], rows: [], view: "table" }),
  plan: () => ({ cols: [{ id: "c1", name: "Aufgabe", type: "text" }, { id: "c2", name: "Status", type: "select", opts: [{ n: "Offen", c: 3 }, { n: "In Arbeit", c: 1 }, { n: "Fertig", c: 2 }] }, { id: "c3", name: D.profile.level === "uni" ? "Modul" : "Fach", type: "select", opts: D.subjects.map((s, i) => ({ n: s.name, c: i % 8 })) }, { id: "c4", name: "Fällig", type: "date" }, { id: "c5", name: "Minuten", type: "num" }], rows: [], view: "board", group: "c2" }),
  exams: () => ({ cols: [{ id: "c1", name: "Prüfung", type: "text" }, { id: "c2", name: D.profile.level === "uni" ? "Modul" : "Fach", type: "select", opts: D.subjects.map((s, i) => ({ n: s.name, c: i % 8 })) }, { id: "c3", name: "Datum", type: "date" }, { id: "c4", name: "Note", type: "num" }, { id: "c5", name: "Gelernt", type: "check" }], rows: [], view: "table" }),
  read: () => ({ cols: [{ id: "c1", name: "Titel", type: "text" }, { id: "c2", name: "Art", type: "select", opts: [{ n: "Buch", c: 0 }, { n: "Artikel", c: 1 }, { n: "Video", c: 4 }] }, { id: "c3", name: "Status", type: "select", opts: [{ n: "Geplant", c: 3 }, { n: "Lese ich", c: 1 }, { n: "Fertig", c: 2 }] }, { id: "c4", name: "Bewertung", type: "num" }], rows: [], view: "board", group: "c3" }),
};

async function newDatabase(folderId = docFolder, kind) {
  if (limitHit("doc")) return;
  if (!kind) return menu($("#newbtn") || document.body, [{ label: "Lernplan (Board)", icon: "todo", fn: () => newDatabase(folderId, "plan") }, { label: "Prüfungen & Noten", icon: "award", fn: () => newDatabase(folderId, "exams") }, { label: "Leseliste", icon: "book", fn: () => newDatabase(folderId, "read") }, { label: "Leere Datenbank", icon: "table", fn: () => newDatabase(folderId, "blank") }]);
  const names = { plan: "Lernplan", exams: "Prüfungen", read: "Leseliste", blank: "Neue Datenbank" }, id = uid();
  D.docs.unshift({ id, type: "db", title: names[kind], subjectId: subjectOfFolder(folderId), folderId, updated: Date.now(), created: Date.now(), text: "" });
  await KV.set("db:" + id, DB_TPL[kind]()); save(); go("doc/" + id);
}

async function dbEditor(m, d) {
  m.classList.add("doc-full");
  const data = (await KV.get("db:" + d.id)) || DB_TPL.blank(); data.cols ||= []; data.rows ||= []; data.view ||= "table";
  const fp = folderPath(d.folderId); let calY = new Date().getFullYear(), calM = new Date().getMonth();
  m.innerHTML = `<div class="ned dfull dbed"><div class="ned-bar">
    <div class="nb-l"><button class="icon-btn" id="eb" aria-label="Zurück">${ic("back")}</button><div class="nb-name"><b id="cr" title="Zum Umbenennen klicken">${esc(d.title)}</b><button class="nb-folder" data-p="${d.folderId || ""}">${ic("folder")}<span>${["Home", ...fp.map(f => f.name)].map(esc).join(" / ")}</span></button></div></div>
    <div class="ned-tools" id="tb"><div class="modesw viewsw" id="vsw" data-m="table"><i class="knob"></i><button data-v="table">Tabelle</button><button data-v="board">Board</button><button data-v="cal">Kalender</button></div><i class="sep"></i><button class="tt" id="addc">${ic("plus")}<span>Spalte</span></button><button class="tt" id="grp" hidden><span id="grp-l"></span>${ic("chev")}</button></div>
    <div class="nb-r"><span class="saved" id="sv">Gespeichert</span><button class="icon-btn" id="mo-m" aria-label="Mehr">${ic("more")}</button><button class="icon-btn aitog" id="ai-m" aria-label="AI ein- und ausklappen" title="AI ein- und ausklappen">${ic("aipanel")}<span class="hide-sm">AI</span></button></div></div>
  <article class="ned-paper dbpaper" id="paperc"><div class="dbbody" id="dbb"></div></article></div>`;
  const paper = $("#paperc", m), box = $("#dbb", m), svEl = $("#sv", m); setScroller(paper);
  $$("[data-p]", m).forEach(b => b.onclick = () => go("docs/" + b.dataset.p)); $("#eb", m).onclick = () => go("docs/" + (d.folderId || ""));
  const flat = () => data.rows.map(r => data.cols.map(c => dbText(c, r.v[c.id])).filter(Boolean).join(" · ")).join("\n").slice(0, 60000);
  const persist = debounce(async () => { if (!D.docs.includes(d)) return; d.updated = Date.now(); d.text = d.title + "\n" + flat(); await KV.set("db:" + d.id, data); save(); svEl.textContent = "Gespeichert"; }, 500);
  const touch = () => { svEl.textContent = "Speichert…"; persist(); };
  const opt = (c, n) => c.opts?.find(o => o.n === n);
  const dbText = (c, v) => c.type === "check" ? (v ? c.name : "") : c.type === "date" && v ? fmtD(v) : (v ?? "") + "";
  const colOf = t => data.cols.find(c => c.type === t), titleCol = () => colOf("text") || data.cols[0];
  const selCols = () => data.cols.filter(c => c.type === "select");
  const chip = (c, v) => { if (!v) return ""; const o = opt(c, v); return `<span class="dchip" style="background:${DB_COLORS[(o?.c ?? 0) % 8]}">${esc(v)}</span>`; };
  async function pickOpt(anchor, c, cur, set) {
    menu(anchor, [...(c.opts || []).map(o => ({ label: o.n, icon: cur === o.n ? "check" : "", fn: () => set(o.n) })), "-", { label: "Neue Option …", icon: "plus", fn: async () => { const n = (await ask("Neue Option", { placeholder: "z. B. Wichtig", ok: "Hinzufügen" }))?.trim(); if (!n) return; c.opts ||= []; if (!opt(c, n)) c.opts.push({ n, c: c.opts.length % 8 }); set(n); } }, ...(cur ? ["-", { label: "Leeren", icon: "x", fn: () => set("") }] : [])]);
  }
  const addRow = (v = {}) => { const r = { id: uid(), v }; data.rows.push(r); touch(); return r; };
  function rowModal(r) {
    const { el, close } = modal(`<h3>${esc(r.v[titleCol()?.id] || "Eintrag")}</h3>${data.cols.map(c => `<label class="lbl">${esc(c.name)}</label>${c.type === "check" ? `<label class="chkrow"><input type="checkbox" data-c="${c.id}" ${r.v[c.id] ? "checked" : ""}> Erledigt</label>` : c.type === "select" ? `<select class="field" data-c="${c.id}"><option value="">–</option>${(c.opts || []).map(o => `<option ${r.v[c.id] === o.n ? "selected" : ""}>${esc(o.n)}</option>`).join("")}</select>` : `<input class="field" data-c="${c.id}" type="${c.type === "num" ? "number" : c.type === "date" ? "date" : "text"}" value="${esc(r.v[c.id] ?? "")}">`}`).join("")}<div class="row end"><button class="btn danger ghost" id="rd">Löschen</button><button class="btn accent" id="rs">Fertig</button></div>`);
    $("#rs", el).onclick = () => { $$("[data-c]", el).forEach(i => { const c = data.cols.find(x => x.id === i.dataset.c); r.v[c.id] = c.type === "check" ? i.checked : c.type === "num" ? (i.value === "" ? "" : +i.value) : i.value; }); touch(); close(); draw(); };
    $("#rd", el).onclick = () => { data.rows = data.rows.filter(x => x !== r); touch(); close(); draw(); };
  }
  function colMenu(anchor, c) {
    menu(anchor, [{ label: "Umbenennen", icon: "pen", fn: async () => { const n = (await ask("Spaltenname", { value: c.name, ok: "Speichern" }))?.trim(); if (n) { c.name = n; touch(); draw(); } } }, ...Object.entries(DB_TYPES).map(([k, l]) => ({ label: "Typ: " + l, icon: c.type === k ? "check" : "", fn: () => { c.type = k; if (k === "select") c.opts ||= []; touch(); draw(); } })), "-", { label: "Spalte löschen", icon: "trash", danger: true, fn: async () => { if (data.cols.length < 2) return toast("Mindestens eine Spalte bleibt"); if (await confirmBox(`Spalte „${c.name}“ löschen?`, "Löschen")) { data.cols = data.cols.filter(x => x !== c); touch(); draw(); } } }]);
  }
  /* views */
  function viewTable() {
    box.innerHTML = `<div class="dbt-w"><table class="dbt"><thead><tr>${data.cols.map(c => `<th data-c="${c.id}"><span>${esc(c.name)}</span><small>${DB_TYPES[c.type]}</small></th>`).join("")}<th class="act"></th></tr></thead><tbody>${data.rows.map(r => `<tr data-r="${r.id}">${data.cols.map(c => { const v = r.v[c.id]; return `<td data-c="${c.id}">${c.type === "check" ? `<button class="tc ${v ? "on" : ""}" data-k="check" role="checkbox" aria-checked="${!!v}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>` : c.type === "select" ? `<button class="dsel" data-k="sel">${chip(c, v) || '<em>–</em>'}</button>` : `<input data-k="in" type="${c.type === "num" ? "number" : c.type === "date" ? "date" : "text"}" value="${esc(v ?? "")}" ${c === titleCol() ? 'placeholder="Neu …"' : ""}>`}</td>`; }).join("")}<td class="act"><button class="rx" data-k="open" aria-label="Öffnen">${ic("chev")}</button><button class="rx" data-k="del" aria-label="Zeile löschen">${ic("x")}</button></td></tr>`).join("")}</tbody></table></div><button class="dbadd" id="addr">${ic("plus")}Neue Zeile</button>`;
    $$("th[data-c]", box).forEach(th => th.onclick = () => colMenu(th, data.cols.find(c => c.id === th.dataset.c)));
    $$("tr[data-r]", box).forEach(tr => { const r = data.rows.find(x => x.id === tr.dataset.r);
      $$("[data-k]", tr).forEach(el => { const c = data.cols.find(x => x.id === el.closest("td")?.dataset.c), k = el.dataset.k;
        if (k === "in") el.oninput = () => { r.v[c.id] = c.type === "num" ? (el.value === "" ? "" : +el.value) : el.value; touch(); };
        else if (k === "check") el.onclick = () => { r.v[c.id] = !r.v[c.id]; el.classList.toggle("on", !!r.v[c.id]); el.setAttribute("aria-checked", !!r.v[c.id]); touch(); }
        else if (k === "sel") el.onclick = () => pickOpt(el, c, r.v[c.id], v => { r.v[c.id] = v; touch(); draw(); });
        else if (k === "open") el.onclick = () => rowModal(r);
        else if (k === "del") el.onclick = () => { data.rows = data.rows.filter(x => x !== r); touch(); draw(); }; }); });
    $("#addr", box).onclick = () => { addRow(); draw(); const ins = $$("tbody tr:last-child input", box)[0]; ins?.focus(); };
  }
  function viewBoard() {
    let g = data.cols.find(c => c.id === data.group && c.type === "select") || selCols()[0];
    if (!g) { box.innerHTML = `<div class="emptybox"><h3>Für das Board brauchst du eine Auswahl-Spalte</h3><p>Füge z. B. „Status“ hinzu, um Karten in Spalten zu gruppieren.</p><button class="btn accent" id="mkg">Status-Spalte anlegen</button></div>`; $("#mkg", box).onclick = () => { data.cols.push({ id: "c" + uid().slice(0, 4), name: "Status", type: "select", opts: [{ n: "Offen", c: 3 }, { n: "In Arbeit", c: 1 }, { n: "Fertig", c: 2 }] }); touch(); draw(); }; return; }
    data.group = g.id; const lanes = [...(g.opts || []).map(o => o.n), ""], tc = titleCol();
    const pc = selCols().find(c => c !== g && /prior|wichtig|dringl/i.test(c.name)), dc2 = data.cols.find(c => c.type === "text" && c !== tc), BOLT = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M9 1L3 9h4l-1 6 6-8H8z" fill="currentColor"/></svg>`;
    const lvl = v => /hoch|high|dringend|wichtig|urgent/i.test(v) ? "hi" : /mittel|medium|normal/i.test(v) ? "md" : /niedrig|low|gering|später/i.test(v) ? "lo" : "";
    const badge = r => { const v = pc && r.v[pc.id]; return v ? `<span class="kprio ${lvl(v) || ""}" ${lvl(v) ? "" : `style="background:${DB_COLORS[(opt(pc, v)?.c ?? 0) % 8]}"`}>${BOLT}${esc(v)}</span>` : "<span></span>"; };
    const dot = n => `<i class="ldot" style="background:${n ? DB_COLORS[(opt(g, n)?.c ?? 0) % 8] : "#cfcfd8"}"></i>`;
    box.innerHTML = `<div class="dbb-top"><button class="btn primary" id="kadd">${ic("plus")}Neue Aufgabe</button></div><div class="dbb">${lanes.map(n => { const rows = data.rows.filter(r => (r.v[g.id] || "") === n); return `<section class="lane" data-l="${esc(n)}"><header>${dot(n)}<b>${n ? esc(n) : "Ohne"}</b><small>${rows.length}</small></header><div class="cards">${rows.map(r => `<article class="kcard" draggable="true" data-r="${r.id}"><div class="kc-top">${badge(r)}<button class="kc-more" data-km="${r.id}" aria-label="Mehr">${ic("more")}</button></div><b>${esc(r.v[tc?.id] || "Unbenannt")}</b>${dc2 && r.v[dc2.id] ? `<p class="kdesc">${esc(r.v[dc2.id])}</p>` : ""}<div class="kmeta">${data.cols.filter(c => c !== tc && c !== g && c !== pc && c !== dc2 && r.v[c.id] !== undefined && r.v[c.id] !== "" && r.v[c.id] !== false).map(c => c.type === "select" ? chip(c, r.v[c.id]) : `<span class="kt">${esc(dbText(c, r.v[c.id]))}</span>`).join("")}</div></article>`).join("")}</div><button class="dbadd sm" data-add="${esc(n)}">${ic("plus")}Karte</button></section>`; }).join("")}</div>`;
    $("#kadd", box).onclick = () => $("[data-add]", box)?.click();
    $$("[data-km]", box).forEach(bt => bt.onclick = e => { e.stopPropagation(); const r = data.rows.find(x => x.id === bt.dataset.km); menu(bt, [{ label: "Bearbeiten", icon: "edit", fn: () => rowModal(r) }, { label: "Duplizieren", icon: "copy", fn: () => { addRow({ ...r.v }); draw(); } }, "-", { label: "Löschen", icon: "trash", danger: true, fn: () => { data.rows = data.rows.filter(x => x !== r); touch(); draw(); } }]); });
    $$(".kcard", box).forEach(el => { const r = data.rows.find(x => x.id === el.dataset.r); el.onclick = () => rowModal(r); el.ondragstart = e => { e.dataTransfer.setData("text/plain", r.id); el.classList.add("drag"); }; el.ondragend = () => el.classList.remove("drag"); });
    $$(".lane", box).forEach(l => { l.ondragover = e => { e.preventDefault(); l.classList.add("over"); }; l.ondragleave = () => l.classList.remove("over"); l.ondrop = e => { e.preventDefault(); const r = data.rows.find(x => x.id === e.dataTransfer.getData("text/plain")); if (r) { r.v[g.id] = l.dataset.l; touch(); draw(); } }; });
    $$("[data-add]", box).forEach(b => b.onclick = async () => { const t = (await ask("Neue Karte", { placeholder: "Titel", ok: "Hinzufügen" }))?.trim(); if (!t) return; addRow({ [tc.id]: t, [g.id]: b.dataset.add }); draw(); });
  }
  function viewCal() {
    const dc = colOf("date"); if (!dc) { box.innerHTML = `<div class="emptybox"><h3>Für den Kalender brauchst du eine Datums-Spalte</h3><button class="btn accent" id="mkd">Datums-Spalte anlegen</button></div>`; $("#mkd", box).onclick = () => { data.cols.push({ id: "c" + uid().slice(0, 4), name: "Datum", type: "date" }); touch(); draw(); }; return; }
    const tc = titleCol(), first = (new Date(calY, calM, 1).getDay() + 6) % 7, dim = new Date(calY, calM + 1, 0).getDate(), today = iso();
    let cells = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => `<span class="wd">${w}</span>`).join("") + Array(first).fill("<i></i>").join("");
    for (let n = 1; n <= dim; n++) { const ds = `${calY}-${pad(calM + 1)}-${pad(n)}`, rs = data.rows.filter(r => r.v[dc.id] === ds); cells += `<div class="dcell ${ds === today ? "today" : ""}" data-d="${ds}"><b>${n}</b>${rs.slice(0, 3).map(r => `<span class="dev" data-r="${r.id}">${esc(r.v[tc?.id] || "Eintrag")}</span>`).join("")}${rs.length > 3 ? `<small>+${rs.length - 3}</small>` : ""}</div>`; }
    box.innerHTML = `<div class="dcal"><div class="dcal-h"><button class="icon-btn sm" id="cp" aria-label="Zurück">${ic("back")}</button><h2>${new Date(calY, calM, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })}</h2><button class="icon-btn sm nx" id="cn" aria-label="Weiter">${ic("back")}</button></div><div class="dcg">${cells}</div></div>`;
    $("#cp", box).onclick = () => { if (--calM < 0) { calM = 11; calY--; } draw(); }; $("#cn", box).onclick = () => { if (++calM > 11) { calM = 0; calY++; } draw(); };
    $$(".dev", box).forEach(e => e.onclick = ev => { ev.stopPropagation(); rowModal(data.rows.find(x => x.id === e.dataset.r)); });
    $$(".dcell", box).forEach(c => c.onclick = async () => { const t = (await ask("Neuer Eintrag am " + fmtD(c.dataset.d), { placeholder: "Titel", ok: "Hinzufügen" }))?.trim(); if (!t) return; addRow({ [tc.id]: t, [dc.id]: c.dataset.d }); draw(); });
  }
  function draw() {
    const v = data.view; $("#vsw", m).dataset.m = v; $$("#vsw button", m).forEach(b => b.classList.toggle("on", b.dataset.v === v));
    const sc = paper.scrollTop; (v === "board" ? viewBoard : v === "cal" ? viewCal : viewTable)(); paper.scrollTop = sc;
    const gb = $("#grp", m); gb.hidden = v !== "board"; const g = data.cols.find(c => c.id === data.group); $("#grp-l", m).textContent = "Gruppieren: " + (g?.name || "–");
  }
  $$("#vsw button", m).forEach(b => b.onclick = () => { data.view = b.dataset.v; touch(); draw(); });
  $("#addc", m).onclick = e => menu(e.currentTarget, Object.entries(DB_TYPES).map(([k, l]) => ({ label: l, fn: async () => { const n = (await ask("Neue Spalte (" + l + ")", { placeholder: "Name", ok: "Hinzufügen" }))?.trim(); if (!n) return; data.cols.push({ id: "c" + uid().slice(0, 4), name: n, type: k, ...(k === "select" ? { opts: [] } : {}) }); touch(); draw(); } })));
  $("#grp", m).onclick = e => menu(e.currentTarget, selCols().map(c => ({ label: c.name, icon: data.group === c.id ? "check" : "", fn: () => { data.group = c.id; touch(); draw(); } })));
  const rename = () => { const b = $("#cr", m); if (!b) return; const inp = document.createElement("input"); inp.className = "nb-in"; inp.value = d.title; inp.maxLength = 80; b.replaceWith(inp); inp.focus(); inp.select(); let done = false; const fin = ok => { if (done) return; done = true; if (ok && inp.value.trim()) { d.title = inp.value.trim(); d.updated = Date.now(); save(); } const nb = document.createElement("b"); nb.id = "cr"; nb.textContent = d.title; inp.replaceWith(nb); nb.onclick = rename; }; inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); else if (e.key === "Escape") fin(false); }; };
  $("#cr", m).onclick = rename;
  $("#ai-m", m).onclick = e => menu(e.currentTarget, [{ label: "Zeilen mit Studix AI vorschlagen …", icon: "spark", fn: async () => {
    if (!hasKey()) return toast(aiOff() ? AI_OFF_MSG : "Studix AI ist noch nicht eingerichtet (Einstellungen → Studix AI).");
    const topic = (await ask("Wofür soll Studix AI Einträge erstellen?", { placeholder: "z. B. Lernplan für die Bio-Klausur in 2 Wochen", ok: "Erstellen" }))?.trim(); if (!topic) return;
    toast("Studix AI erstellt Einträge …"); const spec = data.cols.map(c => `"${c.name}" (${DB_TYPES[c.type]}${c.type === "select" ? ": " + (c.opts || []).map(o => o.n).join("/") : c.type === "date" ? ", JJJJ-MM-TT" : ""})`).join(", ");
    const r = await ai(`Erzeuge höchstens 8 Zeilen für eine Tabelle zum Thema: ${topic}. Heute ist ${iso()}. Spalten: ${spec}. Antworte NUR mit einem JSON-Array aus Objekten, deren Schlüssel die Spaltennamen sind.`, { system: sysBase(), max: 1200, quiet: true });
    let arr; try { arr = JSON.parse((r || "").replace(/```(json)?/g, "").trim()); } catch { return toast("Die Studix-AI-Antwort war nicht lesbar – bitte nochmal versuchen."); }
    let n = 0; for (const o of (Array.isArray(arr) ? arr : []).slice(0, 8)) { const v = {}; data.cols.forEach(c => { const x = o[c.name]; if (x === undefined || x === null) return; if (c.type === "select") { const s = String(x); c.opts ||= []; if (!opt(c, s)) c.opts.push({ n: s, c: c.opts.length % 8 }); v[c.id] = s; } else if (c.type === "num") v[c.id] = +x || 0; else if (c.type === "check") v[c.id] = !!x; else v[c.id] = String(x); }); data.rows.push({ id: uid(), v }); n++; }
    touch(); draw(); toast(n + " Einträge hinzugefügt"); } }, { label: "Zusammenfassen", icon: "list", fn: () => aiTool("summary", d.title + "\n" + flat(), { title: d.title, subjectId: d.subjectId }) }]);
  $("#mo-m", m).onclick = e => menu(e.currentTarget, [{ label: "Umbenennen", icon: "pen", fn: rename }, { label: "Als CSV exportieren", icon: "download", fn: () => { const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`; dlFile(d.title + ".csv", "text/csv", [data.cols.map(c => q(c.name)).join(";"), ...data.rows.map(r => data.cols.map(c => q(c.type === "check" ? (r.v[c.id] ? "ja" : "nein") : r.v[c.id])).join(";"))].join("\n")); } }, { label: "Zeilen als Aufgaben in den Planer", icon: "cal", fn: () => { const dc = colOf("date"), tc = titleCol(); if (!dc) return toast("Keine Datums-Spalte vorhanden"); let n = 0; data.rows.filter(r => r.v[dc.id] && r.v[tc.id]).forEach(r => { if (!D.tasks.some(t => t.title === r.v[tc.id] && t.due === r.v[dc.id])) { D.tasks.push({ id: uid(), title: r.v[tc.id], type: /pr(ü|ue)fung|klausur|test/i.test(r.v[tc.id]) ? "exam" : "task", due: r.v[dc.id], subjectId: d.subjectId || "", note: "Aus Datenbank „" + d.title + "“", done: false }); n++; } }); save(); toast(n + " Aufgaben übernommen"); } }, "-", { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); } }, { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); go("docs/" + (d.folderId || "")); } }]);
  draw();
  if (window.__aiReveal === d.id) { window.__aiReveal = ""; $$("tbody tr, .kcard", box).forEach((el, i) => { el.classList.add("ai-in"); el.style.setProperty("--d", i * 110 + "ms"); }); setTimeout(() => $$(".ai-in", box).forEach(el => el.classList.remove("ai-in")), 2600); }
}
function newDatabaseMenu(anchor) { menu(anchor, [{ label: "Lernplan (Board)", icon: "todo", fn: () => newDatabase(docFolder, "plan") }, { label: "Prüfungen & Noten", icon: "award", fn: () => newDatabase(docFolder, "exams") }, { label: "Leseliste", icon: "book", fn: () => newDatabase(docFolder, "read") }, { label: "Leere Datenbank", icon: "table", fn: () => newDatabase(docFolder, "blank") }]); }
function dlFile(name, mime, data) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
