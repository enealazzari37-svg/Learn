"use strict";
/* Studix study app – flashcards, quiz, planner, grades, focus timer, AI chat, search, settings */

var LEAVE = [];          // cleanup callbacks run when the view changes
let chatPrefill = "", searchPrefill = "";

/* ---------- flashcards ---------- */
const INTERVALS = [0, 1, 3, 7, 16, 35];
async function newDeck(subjectId = "") {
  const t = await ask("Neuer Karteikarten-Stapel", { placeholder: "z. B. Vokabeln Unit 4", ok: "Erstellen" }); if (!t?.trim()) return;
  const d = { id: uid(), title: t.trim(), subjectId, cards: [] }; D.decks.unshift(d); save(); go("cards/" + d.id);
}
V.cards = (m, id) => {
  if (id) return V.deck(m, id);
  m.innerHTML = `<div class="page">${pageHead("<b>Karteikarten</b>", dkAct("spark", "Mit Studix AI erstellen", 'id="gen"') + '<i class="sdk-sep" aria-hidden="true"></i>' + dkAct("plus", "Neuer Stapel", 'id="nd"'))}
  ${D.decks.length ? `<div class="deckgrid">${D.decks.map(d => { const due = d.cards.filter(c => c.due <= iso()).length, s = subj(d.subjectId), mastered = d.cards.filter(c => c.box >= 4).length; return `<div class="deck" data-k="${d.id}"><div class="dtop">${s ? `<span class="sdot" style="background:${s.color}"></span>${esc(s.name)}` : "&nbsp;"}</div><h3>${esc(d.title)}</h3><p>${d.cards.length} Karten · ${mastered} gelernt</p><div class="bar2"><i style="width:${d.cards.length ? mastered / d.cards.length * 100 : 0}%"></i></div><div class="row"><span class="due ${due ? "on" : ""}">${due ? due + " fällig" : "alles erledigt"}</span><button class="btn small" data-s="${d.id}" ${d.cards.length ? "" : "disabled"}>Lernen</button></div></div>`; }).join("")}</div>` : `<div class="emptybox"><div class="big-ic">${ic("cards")}</div><h3>Noch keine Stapel</h3><p>Erstelle Karten selbst oder lass sie von Studix AI aus deinen Notizen, PDFs oder einem Thema erzeugen.</p><div class="row" style="justify-content:center"><button class="btn accent" id="nd2">Stapel erstellen</button><button class="btn ghost" id="gen2">Mit Studix AI erstellen</button></div></div>`}</div>`;
  const gen = () => genCardsModal(); $("#gen", m).onclick = gen; $("#gen2", m) && ($("#gen2", m).onclick = gen);
  $("#nd", m).onclick = () => newDeck(); $("#nd2", m) && ($("#nd2", m).onclick = () => newDeck());
  $$("[data-k]", m).forEach(c => c.onclick = e => { if (e.target.closest("[data-s]")) return; go("cards/" + c.dataset.k); });
  $$("[data-s]", m).forEach(b => b.onclick = () => go("study/" + b.dataset.s));
};
function genCardsModal(deck) {
  const { el, close } = modal(`<h3>Karteikarten mit Studix AI erstellen</h3><label class="lbl">Quelle</label><div class="seg" id="gs"><button data-s="topic" class="on">Thema</button><button data-s="doc">Dokument</button></div>
  <div id="g-topic"><input class="field" id="gt" placeholder="z. B. Zellatmung, Französische Revolution, Pythagoras"></div><div id="g-doc" hidden><select class="field" id="gd">${D.docs.filter(d => d.type !== "draw").map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join("") || "<option value=''>Keine Dokumente</option>"}</select></div>
  <label class="lbl">Anzahl</label><select class="field" id="gn"><option>8</option><option selected>12</option><option>20</option></select><div class="row end"><button class="btn accent" id="go">Erstellen</button></div>`);
  let src = "topic"; $$("#gs button", el).forEach(b => b.onclick = () => { src = b.dataset.s; $$("#gs button", el).forEach(x => x.classList.toggle("on", x === b)); $("#g-topic", el).hidden = src !== "topic"; $("#g-doc", el).hidden = src !== "doc"; });
  $("#go", el).onclick = async () => {
    const n = +$("#gn", el).value; let title = "", text = "";
    if (src === "topic") { title = $("#gt", el).value.trim(); if (!title) return toast("Bitte ein Thema eingeben"); if (!hasKey()) return toast("Themen-Karten brauchen die eingerichtete Studix AI. Mit „Dokument“ geht es auch offline."); }
    else { const d = D.docs.find(x => x.id === $("#gd", el).value); if (!d) return toast("Kein Dokument vorhanden"); title = d.title; text = await docText(d); if (text.length < 20) return toast("Dokument enthält zu wenig Text"); }
    close(); toast("Studix AI arbeitet…");
    let cards = null;
    if (src === "topic") cards = parseJSON(await ai(`Erstelle ${n} Karteikarten zum Thema „${title}“ auf dem Niveau ${isUni() ? "Universität" : "Schule"}. Antworte NUR mit JSON: [{"q":"Frage","a":"Antwort"}].`, { max: 3500, quiet: true }));
    else { cards = parseJSON(await ai(`Erstelle ${n} Karteikarten aus dem Text. Antworte NUR mit JSON: [{"q":"Frage","a":"Antwort"}].\nTEXT:\n${clip(text)}`, { max: 3500, quiet: true })); if (!Array.isArray(cards)) cards = localCards(text); }
    if (!Array.isArray(cards) || !cards.length) return toast("Es konnten keine Karten erstellt werden");
    if (deck) { cards.forEach(c => c.q && c.a && deck.cards.push({ id: uid(), q: c.q, a: c.a, box: 0, due: iso() })); save(); toast(cards.length + " Karten ergänzt"); renderView(); } else cardsModal(cards.filter(c => c.q && c.a), title, "");
  };
}
V.deck = (m, id) => {
  const d = D.decks.find(x => x.id === id); if (!d) return go("cards");
  const due = d.cards.filter(c => c.due <= iso()).length;
  m.innerHTML = `<div class="page"><div class="hd"><div class="row" style="align-items:center"><button class="icon-btn" id="bk" aria-label="Zurück">${ic("back")}</button><div><p class="eyebrow">${subj(d.subjectId)?.name || "Stapel"}</p><h1 id="dt" contenteditable spellcheck="false">${esc(d.title)}</h1></div></div>
  <div class="row"><button class="btn accent" id="st" ${d.cards.length ? "" : "disabled"}>${ic("play")}Lernen${due ? ` (${due})` : ""}</button><button class="btn ghost" id="mo">${ic("more")}</button></div></div>
  <div class="deckbar">${subjectSelect(d.subjectId)}<button class="btn ghost" id="ai1">${ic("spark")}Studix AI ergänzen</button><button class="btn ghost" id="imp">${ic("upload")}Importieren</button><button class="btn ghost" id="all" ${d.cards.length ? "" : "disabled"}>Alle durchgehen</button></div>
  <div class="cardlist" id="cl">${d.cards.map((c, i) => `<div class="crow" data-i="${i}"><span class="num">${i + 1}</span><textarea rows="2" data-f="q" placeholder="Frage">${esc(c.q)}</textarea><textarea rows="2" data-f="a" placeholder="Antwort">${esc(c.a)}</textarea><span class="lvl-dots" title="Lernstufe">${[0, 1, 2, 3, 4].map(k => `<i class="${c.box > k ? "on" : ""}"></i>`).join("")}</span><button class="icon-btn" data-x="${i}" aria-label="Löschen">${ic("x")}</button></div>`).join("")}</div>
  <button class="addcard" id="ac">${ic("plus")}Karte hinzufügen</button></div>`;
  $("#bk", m).onclick = () => go("cards"); $("#st", m).onclick = () => go("study/" + d.id);
  $("#dt", m).onblur = e => { d.title = e.target.textContent.trim() || d.title; save(); };
  $("select", m).onchange = e => { d.subjectId = e.target.value; save(); };
  $("#ai1", m).onclick = () => genCardsModal(d); $("#all", m).onclick = () => go("study/" + d.id + "/all");
  $("#mo", m).onclick = e => menu(e.currentTarget, [{ label: "Stapel löschen", icon: "trash", danger: true, fn: async () => { if (await confirmBox(`Stapel „${d.title}“ löschen?`)) { D.decks = D.decks.filter(x => x !== d); save(); go("cards"); } } }, { label: "Lernstand zurücksetzen", icon: "rot", fn: () => { d.cards.forEach(c => { c.box = 0; c.due = iso(); }); save(); renderView(); } }]);
  $$("textarea", m).forEach(t => t.onchange = () => { const i = +t.closest(".crow").dataset.i; d.cards[i][t.dataset.f] = t.value; save(); });
  $$("[data-x]", m).forEach(b => b.onclick = () => { d.cards.splice(+b.dataset.x, 1); save(); renderView(); });
  $("#ac", m).onclick = () => { d.cards.push({ id: uid(), q: "", a: "", box: 0, due: iso() }); save(); renderView(); setTimeout(() => $$(".crow textarea", $("#main")).slice(-2)[0]?.focus(), 30); };
  $("#imp", m).onclick = async () => { const t = await ask("Karten importieren", { multiline: true, placeholder: "Frage;Antwort\nBonjour;Hallo", hint: "Eine Karte pro Zeile, getrennt durch ; oder Tabulator (Quizlet/Excel-Export).", ok: "Importieren" }); if (!t) return; let n = 0; t.split("\n").forEach(l => { const p = l.split(/\t|;/); if (p.length >= 2 && p[0].trim()) { d.cards.push({ id: uid(), q: p[0].trim(), a: p.slice(1).join(";").trim(), box: 0, due: iso() }); n++; } }); save(); toast(n + " Karten importiert"); renderView(); };
};
V.study = (m, id, mode) => {
  const d = D.decks.find(x => x.id === id); if (!d) return go("cards");
  let queue = (mode === "all" ? d.cards : d.cards.filter(c => c.due <= iso())).map(c => c); queue = shuffle(queue);
  const total = queue.length; let done = 0, flipped = false, again = 0;
  const finish = () => { m.innerHTML = `<div class="page narrow"><div class="emptybox"><div class="big-ic">${ic("check")}</div><h3>${total ? "Geschafft!" : "Alles erledigt"}</h3><p>${total ? `${total} Karten durchgearbeitet, ${again}× „Nochmal“.` : "Heute sind keine Karten fällig. Komm morgen wieder – oder geh alle durch."}</p><div class="row" style="justify-content:center"><button class="btn accent" id="bk">Zum Stapel</button>${total ? "" : `<button class="btn ghost" id="al">Alle durchgehen</button>`}</div></div></div>`; $("#bk", m).onclick = () => go("cards/" + d.id); $("#al", m) && ($("#al", m).onclick = () => go("study/" + d.id + "/all")); };
  const show = () => {
    if (!queue.length) return finish(); const c = queue[0];
    m.innerHTML = `<div class="page narrow"><div class="hd"><button class="icon-btn" id="bk" aria-label="Beenden">${ic("x")}</button><span class="note">${done}/${total} · ${esc(d.title)}</span><span></span></div><div class="bar3"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    <div class="flip ${flipped ? "on" : ""}" id="fl"><div class="face front"><small>Frage</small><p>${esc(c.q)}</p><span class="tap">Tippen zum Umdrehen</span></div><div class="face back"><small>Antwort</small><p>${esc(c.a)}</p></div></div>
    <div class="rate" ${flipped ? "" : "hidden"}><button data-r="0" class="r0">Nochmal<small>1</small></button><button data-r="1" class="r1">Schwer<small>2</small></button><button data-r="2" class="r2">Gut<small>3</small></button><button data-r="3" class="r3">Leicht<small>4</small></button></div>${flipped ? "" : `<div class="row" style="justify-content:center;margin-top:18px"><button class="btn big accent" id="rv">Antwort zeigen</button></div>`}</div>`;
    $("#bk", m).onclick = () => go("cards/" + d.id); const flip = () => { flipped = true; show(); };
    $("#fl", m).onclick = () => { if (!flipped) flip(); }; $("#rv", m)?.addEventListener("click", flip);
    $$("[data-r]", m).forEach(b => b.onclick = () => rate(+b.dataset.r));
  };
  const rate = r => {
    const c = queue.shift(), real = d.cards.find(x => x.id === c.id); flipped = false; addRev(1);
    const dt = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };
    if (r === 0) { real.box = 0; real.due = iso(); queue.push(c); again++; } else { real.box = r === 1 ? real.box : Math.min(5, real.box + (r === 3 ? 2 : 1)); real.due = dt(r === 1 ? 1 : INTERVALS[real.box] || 1); done++; }
    save(); show();
  };
  const key = e => { if (!$("#fl")) return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!flipped) { flipped = true; show(); } } else if (flipped && /^[1-4]$/.test(e.key)) rate(+e.key - 1); };
  document.addEventListener("keydown", key); LEAVE.push(() => document.removeEventListener("keydown", key));
  show();
};

/* ---------- quiz ---------- */
V.quiz = m => {
  m.innerHTML = `<div class="page">${pageHead("<b>Quiz</b>")}
  <div class="panel"><h2>Neues Quiz</h2><div class="seg" id="qs"><button data-s="topic" class="on">Thema</button><button data-s="doc">Aus Dokument</button></div>
  <div id="q-topic"><input class="field" id="qt" placeholder="Thema, z. B. „Mitose und Meiose“ oder „Ableitungsregeln“"></div><div id="q-doc" hidden><select class="field" id="qd">${D.docs.filter(d => d.type !== "draw").map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join("") || "<option value=''>Keine Dokumente</option>"}</select></div>
  <div class="row"><div><label class="lbl">Fragen</label><select class="field" id="qn"><option>5</option><option selected>8</option><option>12</option><option>20</option></select></div><div><label class="lbl">Schwierigkeit</label><select class="field" id="ql"><option>leicht</option><option selected>mittel</option><option>schwer</option></select></div></div>
  <div class="row end"><button class="btn accent big" id="qg">${ic("spark")}Quiz starten</button></div></div>
  ${D.quizzes.length ? `<div class="panel"><h2>Verlauf</h2>${D.quizzes.slice(0, 8).map(q => `<div class="li"><b>${esc(q.title)}</b><small>${q.score}/${q.total} richtig · ${fmtAgo(q.date)}</small><span class="pct ${q.score / q.total >= .7 ? "ok" : ""}">${Math.round(q.score / q.total * 100)}%</span></div>`).join("")}</div>` : ""}</div>`;
  if (quizPrefill) { $("#qt", m).value = quizPrefill.topic || ""; quizPrefill = null; if (!hasKey()) toast("Tipp: Themen-Quiz braucht die eingerichtete Studix AI – mit „Aus Dokument“ geht es offline."); }
  let src = "topic"; $$("#qs button", m).forEach(b => b.onclick = () => { src = b.dataset.s; $$("#qs button", m).forEach(x => x.classList.toggle("on", x === b)); $("#q-topic", m).hidden = src !== "topic"; $("#q-doc", m).hidden = src !== "doc"; });
  $("#qg", m).onclick = async () => {
    const n = +$("#qn", m).value, lv = $("#ql", m).value; let title, text = "", qs = null;
    if (src === "topic") { title = $("#qt", m).value.trim(); if (!title) return toast("Bitte ein Thema eingeben"); if (!hasKey()) return toast("Themen-Quiz braucht die eingerichtete Studix AI. Mit „Aus Dokument“ geht es auch offline."); }
    else { const d = D.docs.find(x => x.id === $("#qd", m).value); if (!d) return toast("Kein Dokument vorhanden"); title = d.title; text = await docText(d); if (text.length < 80) return toast("Dokument enthält zu wenig Text"); }
    $("#qg", m).disabled = true; $("#qg", m).textContent = "Studix AI erstellt Fragen…";
    const fmt = `Antworte NUR mit JSON: [{"q":"","o":["","",""],"a":0,"e":"kurze Erklärung"}] (a = Index der richtigen Option).`;
    qs = parseJSON(await ai(src === "topic" ? `Erstelle ${n} Multiple-Choice-Fragen (Niveau ${isUni() ? "Universität" : "Schule"}, Schwierigkeit ${lv}) zum Thema „${title}“. ${fmt}` : `Erstelle ${n} Multiple-Choice-Fragen (Schwierigkeit ${lv}) zum Text. ${fmt}\nTEXT:\n${clip(text)}`, { max: 3500, quiet: true }));
    if (!Array.isArray(qs)) qs = localQuiz(text, n);
    if (!qs.length) { $("#qg", m).disabled = false; $("#qg", m).textContent = "Quiz starten"; return toast("Quiz konnte nicht erstellt werden"); }
    pendingQuiz = { title, qs: qs.filter(q => q.q && Array.isArray(q.o) && q.o.length > 1) }; go("quizrun");
  };
};
V.quizrun = m => {
  const Q = pendingQuiz; if (!Q || !Q.qs.length) return go("quiz");
  let i = 0, score = 0; const wrong = [];
  const show = () => {
    if (i >= Q.qs.length) return end(); const q = Q.qs[i];
    m.innerHTML = `<div class="page narrow"><div class="hd"><button class="icon-btn" id="bk" aria-label="Beenden">${ic("x")}</button><span class="note">${esc(Q.title)}</span><span class="note">${i + 1}/${Q.qs.length}</span></div><div class="bar3"><i style="width:${i / Q.qs.length * 100}%"></i></div>
    <div class="qcard"><h2>${esc(q.q)}</h2>${q.o.map((o, k) => `<button class="opt" data-k="${k}"><span>${"ABCD"[k]}</span>${esc(o)}</button>`).join("")}<div id="ex" class="explain" hidden></div><div class="row end"><button class="btn accent" id="nx" hidden>${i === Q.qs.length - 1 ? "Ergebnis" : "Weiter"}</button></div></div></div>`;
    $("#bk", m).onclick = () => go(Q.examId ? "exam/" + Q.examId : "quiz"); let answered = false;
    $$(".opt", m).forEach(b => b.onclick = () => { if (answered) return; answered = true; const k = +b.dataset.k, ok = k === q.a; if (ok) score++; else wrong.push(q); b.classList.add(ok ? "ok" : "no"); $$(".opt", m)[q.a]?.classList.add("ok"); if (q.e) { $("#ex", m).hidden = false; $("#ex", m).innerHTML = (ok ? "<b>Richtig.</b> " : "<b>Leider falsch.</b> ") + esc(q.e); } $("#nx", m).hidden = false; });
    $("#nx", m).onclick = () => { i++; show(); };
  };
  const end = () => {
    addRev(Q.qs.length); D.quizzes.unshift({ title: Q.title, score, total: Q.qs.length, date: Date.now(), ...(Q.examId ? { examId: Q.examId, qs: Q.qs } : {}) }); D.quizzes = D.quizzes.slice(0, 60); save();
    const p = Math.round(score / Q.qs.length * 100);
    m.innerHTML = `<div class="page narrow"><div class="result-big"><div class="ring" style="--p:${p}"><b>${p}%</b></div><h2>${p >= 85 ? "Hervorragend!" : p >= 60 ? "Gut gemacht!" : "Weiter üben!"}</h2><p>${score} von ${Q.qs.length} richtig</p><div class="row" style="justify-content:center">${wrong.length ? `<button class="btn ghost" id="wc">Falsche als Karteikarten</button>` : ""}<button class="btn ghost" id="ag">Nochmal</button><button class="btn accent" id="dn">Fertig</button></div></div>${wrong.length ? `<div class="panel"><h2>Zum Wiederholen</h2>${wrong.map(q => `<div class="wr"><b>${esc(q.q)}</b><span>Richtig: ${esc(q.o[q.a])}</span>${q.e ? `<small>${esc(q.e)}</small>` : ""}</div>`).join("")}</div>` : ""}</div>`;
    $("#dn", m).onclick = () => go(Q.examId ? "exam/" + Q.examId : "quiz"); $("#ag", m).onclick = () => { i = 0; score = 0; wrong.length = 0; show(); };
    $("#wc", m) && ($("#wc", m).onclick = () => cardsModal(wrong.map(q => ({ q: q.q.replace("_____", "…"), a: q.o[q.a] + (q.e ? " – " + q.e : "") })), Q.title + " – Wiederholen", Q.subjectId, Q.examId));
  };
  show();
};

/* ---------- planner ---------- */
const TYPES = { hw: "Hausaufgabe", task: "Aufgabe", exam: "Prüfung", project: "Referat/Projekt" };
let plTab = "week", calMonth = new Date(), plWeek = null, plDay = null;
function taskModal(task, date = "", preset = {}) {
  const t = task || { title: "", type: preset.type || "hw", subjectId: "", due: date, note: "" };
  const { el, close } = modal(`<h3>${task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h3><label class="lbl">Titel</label><input class="field" id="tt1" value="${esc(t.title)}" placeholder="z. B. Aufgaben S. 54 Nr. 3–7">
  <div class="row"><div><label class="lbl">Art</label><select class="field" id="tt2">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === t.type ? "selected" : ""}>${v}</option>`).join("")}</select></div><div><label class="lbl">Fällig am</label><input type="date" class="field" id="tt3" value="${t.due || ""}"></div></div>
  <label class="lbl">${isUni() ? "Modul" : "Fach"}</label>${subjectSelect(t.subjectId, "tt4")}<label class="lbl">Lernmaterial (zum Üben & für Lernziele)</label><select class="field" id="tt6"><option value="">– keins –</option>${D.docs.filter(d => d.type !== "draw").map(d => `<option value="${d.id}" ${d.id === t.docId ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</select>
  <label class="lbl">Wiederholen</label><select class="field" id="tt7">${[["", "Nie"], ["daily", "Täglich"], ["weekly", "Jede Woche"], ["monthly", "Jeden Monat"]].map(([k, l]) => `<option value="${k}" ${(t.repeat || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select>
  <label class="lbl">Notiz / Lernziele</label><textarea class="field" id="tt5" rows="4">${esc(t.note || "")}</textarea><button class="btn ghost small" id="lz" type="button" style="margin-top:8px">${ic("star")}Lernziele ermitteln (Studix AI)</button>
  <div class="row end">${task && task.type === "exam" ? `<button class="btn ghost" id="exo">${ic("book")}Prüfungsmappe</button>` : ""}${task ? `<button class="btn danger ghost" id="tdel">Löschen</button>` : ""}<button class="btn accent" id="tsv">Speichern</button></div>`);
  setTimeout(() => $("#tt1", el).focus(), 30);
  $("#tsv", el).onclick = () => { const title = $("#tt1", el).value.trim(); if (!title) return toast("Bitte einen Titel eingeben"); Object.assign(t, { title, type: $("#tt2", el).value, due: $("#tt3", el).value, subjectId: $(".tt4", el).value, note: $("#tt5", el).value, docId: $("#tt6", el).value, repeat: $("#tt7", el).value }); let nt = task; if (!task) { nt = { id: uid(), done: false, ...t }; D.tasks.push(nt); } if (nt.type === "exam") exAfterSave(nt, !task && !preset.quiet); save(); close(); if (nt.type !== "exam" || task) toast("Gespeichert"); refreshNav(); renderView(); };
  $("#lz", el).onclick = async () => { const doc = D.docs.find(x => x.id === $("#tt6", el).value); const src = doc ? await docText(doc) : $("#tt5", el).value; if (!src || src.length < 15) return toast("Wähle zuerst Lernmaterial (z. B. OneNote-Seite) oder schreibe etwas in die Notiz."); $("#lz", el).disabled = true; const g = await extractGoals(src, $("#tt1", el).value || "die Prüfung"); $("#lz", el).disabled = false; const cur = $("#tt5", el).value.replace(/\n*Lernziele:[\s\S]*$/, ""); $("#tt5", el).value = (cur ? cur + "\n\n" : "") + "Lernziele:\n" + g; toast("Lernziele ergänzt"); };
  $("#exo", el) && ($("#exo", el).onclick = () => { close(); go("exam/" + task.id); });
  $("#tdel", el) && ($("#tdel", el).onclick = () => { D.tasks = D.tasks.filter(x => x !== task); save(); close(); renderView(); });
}
function ttModal(day, ev) {
  const e = ev || { day, start: "08:00", end: "08:45", subjectId: "", title: "", room: "" };
  const { el, close } = modal(`<h3>${ev ? "Stunde bearbeiten" : "Stunde hinzufügen"}</h3><label class="lbl">${isUni() ? "Modul" : "Fach"}</label>${subjectSelect(e.subjectId, "tm1")}<label class="lbl">Titel (optional)</label><input class="field" id="tm2" value="${esc(e.title)}" placeholder="z. B. Vorlesung">
  <div class="row"><div><label class="lbl">Von</label><input type="time" class="field" id="tm3" value="${e.start}"></div><div><label class="lbl">Bis</label><input type="time" class="field" id="tm4" value="${e.end}"></div><div><label class="lbl">Tag</label><select class="field" id="tm6">${["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map((n, i) => `<option value="${i}" ${i === e.day ? "selected" : ""}>${n}</option>`).join("")}</select></div></div><label class="lbl">Raum</label><input class="field" id="tm5" value="${esc(e.room || "")}">
  <div class="row end">${ev ? `<button class="btn ghost danger" id="mdel">Löschen</button>` : ""}<button class="btn accent" id="msv">Speichern</button></div>`);
  $("#msv", el).onclick = () => { Object.assign(e, { subjectId: $(".tm1", el).value, title: $("#tm2", el).value.trim(), start: $("#tm3", el).value || "08:00", end: $("#tm4", el).value || "08:45", room: $("#tm5", el).value.trim(), day: +$("#tm6", el).value }); if (!ev) D.tt.push({ id: uid(), ...e }); save(); close(); renderView(); };
  $("#mdel", el) && ($("#mdel", el).onclick = () => { D.tt = D.tt.filter(x => x !== ev); save(); close(); renderView(); });
}

/* Wochenansicht: Tage als Pillen, Zeitleiste mit Stunden/Terminen/Aufgaben, rechts Aktivität */
const wkMon = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const hm = t => { const [h, m] = String(t || "").split(":").map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
function activityFeed() {
  const it = [];
  D.tasks.forEach(t => t.done && t.doneAt && it.push({ ts: t.doneAt, ic: "check", h: "Aufgabe erledigt", s: t.title }));
  (D.quizzes || []).forEach(q => it.push({ ts: q.date, ic: "help", h: "Quiz gespielt · " + q.score + "/" + q.total, s: q.title }));
  D.grades.forEach(g => g.date && it.push({ ts: parseISO(g.date).getTime() + 12 * 36e5, ic: "award", h: "Note eingetragen · " + gfmt(g.value), s: g.title + (subj(g.subjectId) ? " · " + subj(g.subjectId).name : "") }));
  D.docs.forEach(d => d.updated && it.push({ ts: d.updated, ic: "note", h: "Dokument bearbeitet", s: d.title }));
  (D.decks || []).forEach(k => (k.updated || k.created) && it.push({ ts: k.updated || k.created, ic: "cards", h: "Karteikarten", s: k.title + " · " + (k.cards || []).length + " Karten" }));
  return it.filter(x => x.ts && x.ts <= Date.now() + 36e5).sort((a, b) => b.ts - a.ts).slice(0, 12);
}
const actWhen = ts => { const d = new Date(ts), t = d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }), dd = daysUntil(iso(d)); return (dd === 0 ? "Heute" : dd === -1 ? "Gestern" : d.toLocaleDateString("de-CH", { day: "numeric", month: "short" })) + ", " + t; };
let plMode = "";
const plTint = c => /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#8a8a92";
function dayItems(i) {
  const d = parseISO(i), dow = (d.getDay() + 6) % 7, blocks = [], allday = [];
  D.tt.filter(e => e.day === dow).forEach(e => blocks.push({ k: "lesson", s: hm(e.start), e: hm(e.end), t: e.title || subj(e.subjectId)?.name || "Stunde", u: [subj(e.subjectId)?.name, e.room].filter(Boolean).join(" · "), id: e.id, c: plTint(subj(e.subjectId)?.color) }));
  calEventsOn(i).forEach((e, n) => { const s = hm(e.time), c = plTint(e.color || APPLE_COLORS[(n + 3) % APPLE_COLORS.length]); if (s != null) blocks.push({ k: "event", s, e: hm(e.end || e.endTime) || s + 60, t: e.title, u: e.loc || "Kalender", c }); else allday.push({ t: e.title, u: "Termin", c }); });
  D.tasks.filter(t => t.due === i).forEach(t => allday.push({ t: t.title, u: TYPES[t.type] || "Aufgabe", done: t.done, id: t.id, exam: t.type === "exam", c: plTint(subj(t.subjectId)?.color) }));
  return { blocks: blocks.filter(b => b.s != null && b.e > b.s).sort((x, y) => x.s - y.s), allday };
}
function weekView(pb, m) {
  if (!plMode) { try { plMode = localStorage.getItem("lumi-plmode") || (window.PHONE?.matches ? "day" : "week"); } catch { plMode = "week"; } } if (!plDay) plDay = iso();
  const cur = parseISO(plDay), todayIso = iso(), mon = wkMon(cur), A0 = 7 * 60, A1 = 21 * 60, px = 56, now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  const fmt = (d, o) => d.toLocaleDateString("de-CH", o);
  const label = plMode === "day" ? fmt(cur, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : plMode === "week" ? fmt(days[0], { day: "numeric", month: "short" }) + " – " + fmt(days[6], { day: "numeric", month: "short", year: "numeric" }) : plMode === "month" ? fmt(cur, { month: "long", year: "numeric" }) : "Quartal " + (Math.floor(cur.getMonth() / 3) + 1) + " · " + cur.getFullYear();
  const blk = (b, w = "") => `<button class="plw-b ${b.k}" ${b.id ? `data-l="${b.id}"` : ""} style="--c:${b.c};top:${(Math.max(b.s, A0) - A0) / 60 * px}px;height:${Math.max(44, (Math.min(b.e, A1) - Math.max(b.s, A0)) / 60 * px - 4)}px"><b>${esc(b.t)}</b><small>${pad(Math.floor(b.s / 60))}:${pad(b.s % 60)}–${pad(Math.floor(b.e / 60))}:${pad(b.e % 60)}${b.u && !w ? " · " + esc(b.u) : ""}</small></button>`;
  const chip = a => `<button class="plw-chip ${a.done ? "done" : ""} ${a.exam ? "exam" : ""}" style="--c:${a.c}" ${a.id ? `data-t="${a.id}"` : ""}><b>${esc(a.t)}</b><small>${esc(a.u)}</small></button>`;
  const hours = Array.from({ length: (A1 - A0) / 60 }, (_, i) => `<div class="plw-h" style="top:${i * px}px"><span>${pad(7 + i)}:00</span></div>`).join("");
  const nowLine = `<div class="plw-now" style="top:${(nm - A0) / 60 * px}px"><em>${now.getHours()}:${pad(now.getMinutes())}</em></div>`;
  const mcells = (y, mo) => { const off = (new Date(y, mo, 1).getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate(); return [...Array(off).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(y, mo, i + 1))]; };
  let body = "";
  if (plMode === "day" || plMode === "week") {
    const list = plMode === "day" ? [cur] : days;
    const pills = `<div class="plw-days">${days.map(d => { const i = iso(d); return `<button class="plw-d ${i === plDay ? "on" : ""} ${i === todayIso ? "today" : ""}" data-d="${i}"><b>${d.getDate()}</b><small>${fmt(d, { weekday: "short" }).replace(".", "")}</small></button>`; }).join("")}</div>`;
    const cols = list.map(d => { const i = iso(d), it = dayItems(i); return { i, d, it }; });
    body = (plMode === "day" ? pills : "") + `<div class="plw-wk ${plMode}" style="--n:${cols.length}">` + (plMode === "week" ? `<div class="plw-wh"><span></span>${cols.map(c => `<button class="plw-wd ${c.i === todayIso ? "today" : ""}" data-d="${c.i}" data-go="day"><small>${fmt(c.d, { weekday: "short" }).replace(".", "")}</small><b>${c.d.getDate()}</b></button>`).join("")}</div>` : "") +
      (cols.some(c => c.it.allday.length) ? `<div class="plw-ah"><span></span>${cols.map(c => `<div>${c.it.allday.map(chip).join("")}</div>`).join("")}</div>` : "") +
      `<div class="plw-grid" style="height:${(A1 - A0) / 60 * px}px"><div class="plw-hrs">${hours}</div><div class="plw-cols">${cols.map(c => `<div class="plw-col">${c.it.blocks.map(b => blk(b, plMode === "week" ? "w" : "")).join("")}${c.i === todayIso && nm >= A0 && nm <= A1 ? nowLine : ""}</div>`).join("")}</div>${cols.every(c => !c.it.blocks.length && !c.it.allday.length) ? `<p class="plw-empty">Nichts geplant. Füge Stunden im Stundenplan oder Aufgaben mit Datum hinzu.</p>` : ""}</div></div>`;
  } else if (plMode === "month") {
    const cells = mcells(cur.getFullYear(), cur.getMonth());
    body = `<div class="plw-mon">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(x => `<div class="plw-mh">${x}</div>`).join("")}${cells.map(d => { if (!d) return `<div class="plw-mc empty"></div>`; const i = iso(d), it = dayItems(i), all = [...it.blocks.map(b => ({ t: b.t, c: b.c })), ...it.allday.map(a => ({ t: a.t, c: a.c, done: a.done }))]; return `<button class="plw-mc ${i === todayIso ? "today" : ""}" data-d="${i}" data-go="day"><b>${d.getDate()}</b>${all.slice(0, 3).map(x => `<i style="--c:${x.c}" class="${x.done ? "done" : ""}">${esc(x.t)}</i>`).join("")}${all.length > 3 ? `<em>+${all.length - 3}</em>` : ""}</button>`; }).join("")}</div>`;
  } else {
    const q = Math.floor(cur.getMonth() / 3) * 3;
    body = `<div class="plw-qtr">${[0, 1, 2].map(k => { const y = cur.getFullYear(), mo = q + k, cells = mcells(y, mo); return `<div class="plw-qm"><button class="plw-qt" data-d="${iso(new Date(y, mo, 1))}" data-go="month">${fmt(new Date(y, mo, 1), { month: "long" })}</button><div class="plw-qg">${["M", "D", "M", "D", "F", "S", "S"].map(x => `<small>${x}</small>`).join("")}${cells.map(d => { if (!d) return "<span></span>"; const i = iso(d), it = dayItems(i), n = it.blocks.length + it.allday.length, c = (it.blocks[0] || it.allday[0] || {}).c; return `<button class="${i === todayIso ? "today" : ""} ${n ? "has" : ""}" data-d="${i}" data-go="day" ${n ? `style="--c:${c}"` : ""}>${d.getDate()}</button>`; }).join("")}</div></div>`; }).join("")}</div>`;
  }
  const feed = activityFeed();
  pb.innerHTML = `<div class="plw"><section class="plw-main"><div class="plw-hd"><button class="icon-btn" id="wp" aria-label="Zurück">${ic("back")}</button><b>${esc(label)}</b><button class="icon-btn" id="wn" aria-label="Weiter" style="transform:scaleX(-1)">${ic("back")}</button><div class="plw-sw ltr" role="tablist" aria-label="Zeitraum">${[["day", "T", "Tag"], ["week", "W", "Woche"], ["month", "M", "Monat"], ["quarter", "Q", "Quartal"]].map(([k, c, l]) => `<button type="button" class="${plMode === k ? "on" : ""}" data-pm="${k}" title="${l}" aria-label="${l}">${c}</button>`).join("")}</div><button class="btn ghost small" id="wt">Heute</button></div>${body}</section>
  <aside class="plw-act"><h3>Aktivität</h3>${feed.length ? `<ol>${feed.map(a => `<li><span class="plw-ai">${ic(a.ic)}</span><div><small>${actWhen(a.ts)}</small><b>${esc(a.h)}</b><em>${esc(a.s)}</em></div></li>`).join("")}</ol>` : `<p class="note">Sobald du lernst, Aufgaben abhakst oder Noten einträgst, erscheint hier dein Verlauf.</p>`}</aside></div>`;
  const redo = () => V.planner(m), step = n => { const d = new Date(cur); if (plMode === "day") d.setDate(d.getDate() + n); else if (plMode === "week") d.setDate(d.getDate() + 7 * n); else if (plMode === "month") d.setMonth(d.getMonth() + n, 1); else d.setMonth(d.getMonth() + 3 * n, 1); plDay = iso(d); redo(); };
  $("#wp", pb).onclick = () => step(-1); $("#wn", pb).onclick = () => step(1);
  $("#wt", pb).onclick = () => { plDay = iso(); redo(); };
  $$("[data-pm]", pb).forEach(b => b.onclick = () => { plMode = b.dataset.pm; try { localStorage.setItem("lumi-plmode", plMode); } catch {} redo(); });
  $$("[data-d]", pb).forEach(b => b.onclick = () => { plDay = b.dataset.d; if (b.dataset.go) { plMode = b.dataset.go; try { localStorage.setItem("lumi-plmode", plMode); } catch {} } redo(); });
  $$("[data-t]", pb).forEach(b => b.onclick = () => taskModal(D.tasks.find(x => x.id === b.dataset.t)));
  $$("[data-l]", pb).forEach(b => b.onclick = () => ttModal(0, D.tt.find(x => x.id === b.dataset.l)));
}
V.planner = m => {
  m.innerHTML = `<div class="page">${pageHead(`<span>Planer</span><i>/</i><b>${({ week: "Woche", tasks: "Aufgaben", tt: "Stundenplan" })[plTab] || "Woche"}</b>`, [["week", "Woche"], ["tasks", "Aufgaben"], ["tt", "Stundenplan"]].map(([k, l]) => sdkBtn(k, l, `data-t="${k}"`)).join("") + '<i class="sdk-sep" aria-hidden="true"></i>' + dkAct("plus", "Aufgabe hinzufügen", 'id="nt"'), 'id="pt"')}<div id="pb"></div></div>`;
  $$("#pt button[data-t]", m).forEach(b => { b.classList.toggle("on", b.dataset.t === plTab); b.onclick = () => { plTab = b.dataset.t; V.planner(m); }; });
  $("#nt", m).onclick = () => taskModal();
  const pb = $("#pb", m);
  if (plTab === "week") weekView(pb, m);
  else if (plTab === "tasks") {
    const gs = [["Überfällig", x => x.due && daysUntil(x.due) < 0], ["Heute", x => x.due && daysUntil(x.due) === 0], ["Morgen", x => x.due && daysUntil(x.due) === 1], ["Diese Woche", x => x.due && daysUntil(x.due) > 1 && daysUntil(x.due) <= 7], ["Später", x => x.due && daysUntil(x.due) > 7], ["Ohne Datum", x => !x.due]];
    const evs = (D.apple?.events || []).filter(e => e.date >= iso() && daysUntil(e.date) <= 14).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 8);
    const open = D.tasks.filter(x => !x.done), row = x => `<label class="li task" data-e="${x.id}"><input type="checkbox" data-c="${x.id}" ${x.done ? "checked" : ""}><span class="sdot lg" style="background:${subj(x.subjectId)?.color || "#bbb"}"></span><div class="tm2"><b class="${x.done ? "strike" : ""}">${x.type === "exam" ? '<em class="xb">Prüfung</em> ' : ""}${esc(x.title)}</b><small>${x.repeat ? "↻ " + ({ daily: "täglich", weekly: "wöchentlich", monthly: "monatlich" }[x.repeat] || "") + (subj(x.subjectId) ? " · " : "") : ""}${esc(subj(x.subjectId)?.name || "")}${x.note ? " · " + esc(x.note) : ""}</small></div><small class="${x.due && daysUntil(x.due) < 0 && !x.done ? "red" : ""}">${x.due ? fmtD(x.due) : ""}</small></label>`;
    const html = gs.map(([n, f]) => { const l = open.filter(f).sort((a, b) => (a.due || "").localeCompare(b.due || "")); return l.length ? `<section class="panel"><h2 class="${n === "Überfällig" ? "red" : ""}">${n}<small>${l.length}</small></h2>${l.map(row).join("")}</section>` : ""; }).join("");
    const done = D.tasks.filter(x => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 15);
    pb.innerHTML = (evs.length ? `<section class="panel tint2"><h2>Kalender-Termine<small>${evs.length}</small></h2>${evs.map(e => `<div class="li"><span class="tm">${e.date.slice(8)}.${e.date.slice(5, 7)}.<br><small>${e.time || "ganztägig"}</small></span><div class="tm2"><b>${esc(e.title)}</b><small>${esc(e.loc)}</small></div></div>`).join("")}</section>` : "") + (html || `<div class="emptybox"><div class="big-ic">${ic("todo")}</div><h3>Keine offenen Aufgaben</h3><p>Trage Hausaufgaben, Referate und Prüfungen ein – Studix erinnert dich im Dashboard.</p></div>`) + (done.length ? `<details class="panel"><summary>Erledigt (${done.length})</summary>${done.map(row).join("")}</details>` : "");
    $$("[data-c]", pb).forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { const x = D.tasks.find(y => y.id === c.dataset.c); completeTask(x, c.checked); renderView(); }; });
    $$("[data-e]", pb).forEach(r => r.onclick = e => { if (e.target.matches("input")) return; e.preventDefault(); taskModal(D.tasks.find(x => x.id === r.dataset.e)); });
  } else if (plTab === "tt") {
    const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], n = D.tt.some(e => e.day >= 5) ? 7 : 5;
    pb.innerHTML = `<div class="ttgrid" style="--n:${n}">${days.slice(0, n).map((dn, di) => `<div class="ttcol"><div class="tth ${di === (new Date().getDay() + 6) % 7 ? "today" : ""}">${dn}</div>${D.tt.filter(e => e.day === di).sort((a, b) => a.start.localeCompare(b.start)).map(e => `<button class="ttcard" data-e="${e.id}" style="--c:${subj(e.subjectId)?.color || "#888"}"><b>${esc(e.title || subj(e.subjectId)?.name || "Stunde")}</b><small>${e.start}–${e.end}</small>${e.room ? `<small>${esc(e.room)}</small>` : ""}</button>`).join("")}<button class="ttadd" data-a="${di}">${ic("plus")}</button></div>`).join("")}</div>`;
    $$("[data-a]", pb).forEach(b => b.onclick = () => ttModal(+b.dataset.a)); $$("[data-e]", pb).forEach(b => b.onclick = () => ttModal(0, D.tt.find(x => x.id === b.dataset.e)));
  } else {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth(), first = new Date(y, mo, 1), off = (first.getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate();
    pb.innerHTML = `<div class="calhd"><button class="icon-btn" id="cp">${ic("back")}</button><h2>${first.toLocaleDateString("de-CH", { month: "long", year: "numeric" })}</h2><button class="icon-btn" id="cn" style="transform:scaleX(-1)">${ic("back")}</button></div><div class="calgrid">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<div class="calh">${d}</div>`).join("")}${Array(off).fill("<div></div>").join("")}${Array.from({ length: dim }, (_, i) => { const ds = iso(new Date(y, mo, i + 1)), ts = D.tasks.filter(t => t.due === ds && !t.done), ev = calEventsOn(ds); return `<button class="cald ${ds === iso() ? "today" : ""}" data-day="${ds}"><b>${i + 1}</b><span>${ts.slice(0, 3).map(t => `<i style="background:${t.type === "exam" ? "#e5484d" : subj(t.subjectId)?.color || "#888"}"></i>`).join("")}${ev.slice(0, 2).map(() => `<i class="sq"></i>`).join("")}</span></button>`; }).join("")}</div>`;
    $("#cp", pb).onclick = () => { calMonth = new Date(y, mo - 1, 1); V.planner(m); }; $("#cn", pb).onclick = () => { calMonth = new Date(y, mo + 1, 1); V.planner(m); };
    $$("[data-day]", pb).forEach(b => b.onclick = () => { const ts = D.tasks.filter(t => t.due === b.dataset.day), evd = calEventsOn(b.dataset.day); const { el } = modal(`<h3>${fmtD(b.dataset.day)}</h3>${evd.map(e => `<div class="li"><span class="sdot lg" style="background:#2563eb;border-radius:3px"></span><b>${esc(e.title)}</b><small>${e.time || ""} ${esc(e.loc)}</small></div>`).join("")}${ts.map(t => `<div class="li"><span class="sdot lg" style="background:${subj(t.subjectId)?.color || "#999"}"></span><b>${t.type === "exam" ? '<em class="xb">Prüfung</em> ' : ""}${esc(t.title)}</b></div>`).join("")}${ts.length || evd.length ? "" : `<p class="empty">Keine Einträge.</p>`}<div class="row end"><button class="btn accent" id="ad">Aufgabe hinzufügen</button></div>`); $("#ad", el).onclick = () => { el.closest(".mask").remove(); taskModal(null, b.dataset.day); }; });
  }
};

/* ---------- grades ---------- */
const SCALES = {
  ch: { n: "Schweiz · 1 bis 6 (6 = beste)", min: 1, max: 6, lowGood: false, step: .25 },
  de: { n: "Deutschland · 1 bis 6 (1 = beste)", min: 1, max: 6, lowGood: true, step: .25 },
  at: { n: "Österreich · 1 bis 5 (1 = beste)", min: 1, max: 5, lowGood: true, step: .25 },
  pts: { n: "Punkte · 0 bis 15 (15 = beste)", min: 0, max: 15, lowGood: false, step: 1 },
  pct: { n: "Prozent / USA · 0 bis 100 %", min: 0, max: 100, lowGood: false, step: 1 } };
const gradeKey = () => ["pts", "pct", "de", "at"].includes(D.profile.scale) ? D.profile.scale : "ch";
const gradeDec = k => k === "ch" || k === "de" || k === "at";   // Noten mit Dezimalstellen (.25)
const SC = () => SCALES[gradeKey()];
const gnorm = v => { const s = SC(); return s.lowGood ? (s.max - v) / (s.max - s.min) : (v - s.min) / (s.max - s.min); };
const gcol = v => { const k = gradeKey(); if (k === "de" || k === "at") return v <= 2.5 ? "#0e9f6e" : v <= 3.5 ? "#7cc23a" : v <= 4.5 ? "#f59e0b" : "#e5484d"; if (k === "ch") return v >= 5.25 ? "#0e9f6e" : v >= 4.5 ? "#7cc23a" : v >= 4 ? "#f59e0b" : "#e5484d"; const n = gnorm(v); return n >= .7 ? "#0e9f6e" : n >= .45 ? "#f59e0b" : "#e5484d"; };
const wavg = l => { const w = l.reduce((a, g) => a + g.weight, 0); return w ? l.reduce((a, g) => a + g.value * g.weight, 0) / w : null; };
const gfmt = v => { if (v == null || isNaN(v)) return "–"; const k = gradeKey(); if (gradeDec(k)) { let t = v.toFixed(2); if (t.endsWith("0")) t = t.slice(0, -1); return t; } return Math.round(v * 10) / 10 + ""; };
function gradeModal(g, sid) {
  const x = g || { subjectId: sid || D.subjects[0]?.id || "", title: "", value: "", weight: 1, date: iso() };
  const { el, close } = modal(`<h3>${g ? "Note bearbeiten" : "Note eintragen"}</h3><label class="lbl">${isUni() ? "Modul" : "Fach"}</label>${subjectSelect(x.subjectId, "gm1")}<label class="lbl">Bezeichnung</label><input class="field" id="gm2" value="${esc(x.title)}" placeholder="Klassenarbeit, Test, mündlich, Klausur…">
  <div class="row"><div><label class="lbl">${SC().n}${gradeKey() === "ch" ? " · ab 4 genügend" : gradeKey() === "de" || gradeKey() === "at" ? " · bis 4 genügend" : ""}</label><input class="field" id="gm3" type="number" inputmode="decimal" step="${SC().step}" min="${SC().min}" max="${SC().max}" value="${x.value}"></div><div><label class="lbl">${isUni() ? "Gewicht / ECTS" : "Gewicht"}</label><input class="field" id="gm4" type="number" step=".5" min=".5" value="${x.weight}"></div><div><label class="lbl">Datum</label><input class="field" id="gm5" type="date" value="${x.date}"></div></div>
  <div class="row end">${g ? `<button class="btn ghost danger" id="gdel">Löschen</button>` : ""}<button class="btn accent" id="gsv">Speichern</button></div>`);
  $("#gsv", el).onclick = () => { const v = parseFloat(String($("#gm3", el).value).replace(",", ".")); if (isNaN(v) || v < SC().min || v > SC().max) return toast(`Wert zwischen ${SC().min} und ${SC().max}`); Object.assign(x, { subjectId: $(".gm1", el).value, title: $("#gm2", el).value.trim() || "Note", value: v, weight: parseFloat($("#gm4", el).value) || 1, date: $("#gm5", el).value || iso() }); if (!g) D.grades.push({ id: uid(), ...x }); save(); close(); renderView(); };
  $("#gdel", el) && ($("#gdel", el).onclick = () => { D.grades = D.grades.filter(y => y !== g); save(); close(); renderView(); });
}
V.grades = m => {
  const all = D.grades, avg = wavg(all), by = D.subjects.map(s => ({ s, l: D.grades.filter(g => g.subjectId === s.id) })).filter(x => x.l.length);
  const best = by.length ? [...by].sort((a, b) => SC().lowGood ? wavg(a.l) - wavg(b.l) : wavg(b.l) - wavg(a.l))[0].s : null, W = isUni() ? "Modul" : "Fach";
  m.innerHTML = `<div class="page">${pageHead("<b>Noten</b>", dkAct("goal", "Zielrechner", 'id="goal"') + '<i class="sdk-sep" aria-hidden="true"></i>' + dkAct("plus", "Note eintragen", 'id="ng"'))}
  <div class="gsum"><div class="gs-avg"><small>Gesamtschnitt</small><b style="color:${avg == null ? "inherit" : gcol(avg)}">${gfmt(avg)}</b></div><div><small>Noten</small><b>${all.length}</b></div><div><small>${isUni() ? "Module" : "Fächer"}</small><b>${D.subjects.length}</b></div><div><small>Bestes ${W}</small><b class="gs-t">${best ? esc(best.name) : "–"}</b></div></div>
  <div class="glist">${D.subjects.length ? D.subjects.map(s => { const l = D.grades.filter(g => g.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date)), a = l.length ? wavg(l) : null; return `<div class="grow" data-sid="${s.id}"><label class="scol" title="Farbe ändern" style="--c:${s.color}"><input type="color" value="${s.color}" data-c="${s.id}" aria-label="Farbe"></label><input class="sname" value="${esc(s.name)}" data-n="${s.id}" aria-label="Name"><div class="gchips">${l.length ? l.map(g => `<button class="gchip" data-g="${g.id}" style="--c:${gcol(g.value)}" title="${esc(g.title)}${g.weight !== 1 ? " · ×" + g.weight : ""}"><b>${gfmt(g.value)}</b><small>${esc(g.title)}${g.weight !== 1 ? " ×" + g.weight : ""}</small></button>`).join("") : `<span class="gnone">Noch keine Noten</span>`}<button class="gadd" data-a="${s.id}" aria-label="Note eintragen" title="Note eintragen">${ic("plus")}</button></div><div class="gavg" ${a == null ? "" : `style="--c:${gcol(a)}"`}><small>Ø</small><b>${gfmt(a)}</b></div><button class="icon-btn" data-x="${s.id}" aria-label="Entfernen" title="Entfernen">${ic("trash")}</button></div>`; }).join("") : `<div class="emptybox"><div class="big-ic">${ic("award")}</div><h3>Noch keine Noten</h3><p>Lege zuerst ${SUBJ()} an, dann trägst du Noten ein.</p></div>`}<button class="grow add" id="as2" type="button">${ic("plus")}<span>${W} hinzufügen</span></button></div></div>`;
  const addS = async () => { await newSubject(); V.grades(m); };
  $("#as2", m).onclick = addS; $$("[data-a]", m).forEach(b => b.onclick = () => gradeModal(null, b.dataset.a));
  $$("[data-x]", m).forEach(b => b.onclick = async () => { if (await confirmBox("Entfernen? Zugeordnete Dokumente bleiben erhalten, Noten dieses Fachs werden ebenfalls entfernt.", "Entfernen")) { const id = b.dataset.x; D.subjects = D.subjects.filter(s => s.id !== id); D.grades = D.grades.filter(g => g.subjectId !== id); save(); V.grades(m); } });
  $$("[data-c]", m).forEach(i => { i.oninput = () => { subj(i.dataset.c).color = i.value; i.parentElement.style.setProperty("--c", i.value); }; i.onchange = () => save(); });
  $$("[data-n]", m).forEach(i => { i.onchange = () => { const v = i.value.trim(); if (v) subj(i.dataset.n).name = v; else i.value = subj(i.dataset.n).name; save(); }; i.onkeydown = e => { if (e.key === "Enter") i.blur(); }; });
  $("#ng", m).onclick = () => D.subjects.length ? gradeModal() : toast(`Lege zuerst ${SUBJ()} an`);
  $$("[data-g]", m).forEach(b => b.onclick = () => gradeModal(D.grades.find(g => g.id === b.dataset.g)));
  $("#goal", m).onclick = () => {
    const { el } = modal(`<h3>Zielrechner</h3><p class="note">Welche Note brauchst du noch für deinen Wunschschnitt?</p><label class="lbl">${isUni() ? "Modul" : "Fach"}</label>${subjectSelect(D.subjects[0]?.id || "", "zs")}<div class="row"><div><label class="lbl">Zielschnitt</label><input class="field" id="zt" type="number" step="${SC().step}" value="${({ ch: 5, de: 2, at: 2, pts: 12, pct: 75 })[gradeKey()]}"></div><div><label class="lbl">Gewicht nächste Note</label><input class="field" id="zw" type="number" step=".5" value="1"></div></div><div class="result" id="zr">–</div>`);
    const calc = () => { const l = D.grades.filter(g => g.subjectId === $(".zs", el).value), t = parseFloat($("#zt", el).value), w = parseFloat($("#zw", el).value) || 1; const W = l.reduce((a, g) => a + g.weight, 0), S = l.reduce((a, g) => a + g.value * g.weight, 0); const need = (t * (W + w) - S) / w; const need2 = gradeDec(gradeKey()) ? (SC().lowGood ? Math.floor(need * 4 + 1e-9) : Math.ceil(need * 4 - 1e-9)) / 4 : need; const ok = need >= SC().min - 1e-9 && need <= SC().max + 1e-9; $("#zr", el).innerHTML = isNaN(need) ? "–" : ok ? `Du brauchst mindestens <b style="font-size:26px">${gfmt(Math.round(need2 * 100) / 100)}</b>${SC().lowGood ? " (oder besser)" : ""}.` : (SC().lowGood ? need > SC().max : need < SC().min) ? "Ziel ist bereits sicher erreicht" : "Mit der nächsten Note ist dieses Ziel leider nicht mehr erreichbar."; };
    $$("input,select", el).forEach(i => i.oninput = calc); calc();
  };
};

/* ---------- focus timer ---------- */
const T = { mode: "focus", total: 25 * 60, left: 25 * 60, running: false, end: 0, subjectId: "", focusLen: 25, breakLen: 5, iv: null, started: 0 };
function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach((t, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 660 + i * 110; g.gain.setValueAtTime(.2, c.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + t + .22); o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + .25); }); } catch {} }
const fmtT = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
function timerPaint() {
  const pill = $("#tpill"); if (pill) {
    const show = (T.running || T.left < T.total) && curView !== "today"; pill.style.setProperty("--p", ((1 - T.left / T.total) * 100).toFixed(1)); pill.hidden = false; pill.classList.toggle("show", !!show); pill.classList.toggle("run", !!T.running);
    if (!pill.firstChild) { pill.innerHTML = `<div class="tb-top"><i class="pd"></i><span class="tb-l"></span></div><b class="tb-t"></b><div class="tb-bar"><i></i></div><div class="tb-act"><button data-a="t" aria-label="Start oder Pause"></button><button data-a="x" aria-label="Zurücksetzen">${ic("x")}</button></div>`; pill.onclick = e => { const a = e.target.closest("button")?.dataset.a; if (a === "t") timerToggle(); else if (a === "x") timerReset(); else go("focus"); }; }
    $(".tb-l", pill).textContent = T.mode === "focus" ? "Fokus" + (T.subjectId && subj(T.subjectId) ? " · " + subj(T.subjectId).name : "") : "Pause"; $(".tb-t", pill).textContent = fmtT(T.left); $(".tb-bar i", pill).style.width = (1 - T.left / T.total) * 100 + "%";
    const tg = $('[data-a="t"]', pill), want = T.running ? "pause" : "play"; if (tg.dataset.i !== want) { tg.dataset.i = want; tg.innerHTML = ic(want); }
  }
  const r = $("#tring"); if (r) { r.style.setProperty("--p", (1 - T.left / T.total) * 100); $("#tt-time").textContent = fmtT(T.left); $("#tt-mode").textContent = T.mode === "focus" ? "Fokus" : "Pause"; $("#tt-go").innerHTML = T.running ? ic("pause") + "Pause" : ic("play") + (T.left < T.total ? "Weiter" : "Start"); }
}
function timerTick() {
  T.left = Math.max(0, Math.round((T.end - Date.now()) / 1000));
  if (T.left <= 0) { clearInterval(T.iv); T.running = false; beep(); if (T.mode === "focus") { addMin(Math.round(T.total / 60)); toast(`${Math.round(T.total / 60)} Min. Fokus geschafft!`); } else toast("Pause vorbei – weiter geht's!"); const was = T.mode, doneMin = Math.round(T.total / 60); T.mode = T.mode === "focus" ? "break" : "focus"; T.total = T.left = (T.mode === "focus" ? T.focusLen : T.breakLen) * 60; timeUp(was, doneMin); if (curView === "focus") renderView(); }
  timerPaint(); if (curView === "focus" && T.left === T.total) timerPaint();
}
function timeUp(was, min) {
  $("#tup")?.remove(); const el = document.createElement("div"); el.id = "tup"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  const nextLbl = T.mode === "break" ? `Pause starten · ${T.breakLen} Min.` : `Nächste Runde · ${T.focusLen} Min.`;
  el.innerHTML = `<i class="tu-b b1"></i><i class="tu-b b2"></i><div class="tu-in"><div class="tu-ring"><span>${ic(was === "focus" ? "check" : "timer")}</span></div><p class="eyebrow">${was === "focus" ? "Fokuszeit geschafft" : "Pause vorbei"}</p><h1>${was === "focus" ? "Zeit abgelaufen" : "Weiter geht’s"}</h1><p class="tu-sub">${was === "focus" ? `${min} Minuten konzentriert gelernt – gönn dir jetzt eine kurze Pause.` : "Bereit für die nächste Runde?"}</p><div class="row" style="justify-content:center"><button class="btn big accent" id="tu-go">${nextLbl}</button><button class="btn big ghost" id="tu-x">Schließen</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("show"));
  const close = go2 => { el.classList.remove("show"); setTimeout(() => el.remove(), 450); document.removeEventListener("keydown", kd); if (go2 && !T.running) timerToggle(); };
  const kd = e => { if (e.key === "Escape") close(false); }; document.addEventListener("keydown", kd);
  $("#tu-go", el).onclick = () => close(true); $("#tu-x", el).onclick = () => close(false); setTimeout(() => $("#tu-go", el)?.focus(), 400);
}
function timerToggle() { if (T.running) { clearInterval(T.iv); T.running = false; } else { T.running = true; T.end = Date.now() + T.left * 1000; if (T.left === T.total && T.mode === "focus") T.started = Date.now(); T.iv = setInterval(timerTick, 500); } timerPaint(); }
function timerReset() { const el = T.total - T.left; if (T.mode === "focus" && el >= 60) { addMin(Math.floor(el / 60)); toast(`${Math.floor(el / 60)} Min. gespeichert`); } clearInterval(T.iv); T.running = false; T.left = T.total; timerPaint(); }
function timerSet(f, b) { clearInterval(T.iv); T.running = false; T.focusLen = f; T.breakLen = b; T.mode = "focus"; T.total = T.left = f * 60; }
V.focus = m => {
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return [d.toLocaleDateString("de-CH", { weekday: "short" }), D.stats.days[iso(d)] || 0]; }), mx = Math.max(30, ...week.map(w => w[1]));
  m.innerHTML = `<div class="page narrow">${pageHead("<b>Fokus</b>")}
  <div class="timerbox"><div class="tring" id="tring"><div class="inner"><small id="tt-mode">Fokus</small><b id="tt-time">25:00</b></div></div>
  <div class="row" style="justify-content:center"><button class="btn big accent" id="tt-go"></button><button class="btn big ghost" id="tt-rs">${ic("rot")}Zurück</button></div>
  <div class="chips" style="justify-content:center;margin-top:18px">${[[25, 5], [50, 10], [15, 3], [90, 15]].map(([f, b]) => `<button class="chip ${T.focusLen === f ? "on" : ""}" data-p="${f},${b}">${f}/${b} Min.</button>`).join("")}</div><div style="max-width:260px;margin:14px auto 0">${subjectSelect(T.subjectId, "ts")}</div></div>
  <div class="panel"><h2>Lernzeit der letzten 7 Tage<small>${week.reduce((a, w) => a + w[1], 0)} Min.</small></h2><div class="bars2">${week.map(([d, v]) => `<div><i style="height:${Math.max(4, v / mx * 100)}%" title="${v} Min."></i><small>${d}</small><b>${v || ""}</b></div>`).join("")}</div></div></div>`;
  $("#tt-go", m).onclick = timerToggle; $("#tt-rs", m).onclick = timerReset;
  $$("[data-p]", m).forEach(b => b.onclick = () => { const [f, bb] = b.dataset.p.split(",").map(Number); timerSet(f, bb); V.focus(m); });
  $(".ts", m).onchange = e => T.subjectId = e.target.value; timerPaint();
};

/* ---------- AI chat ---------- */
const MODES = { tutor: ["Erklären", "Erkläre Konzepte Schritt für Schritt mit Beispielen und stelle am Ende eine kurze Verständnisfrage."], quiz: ["Abfragen", "Stelle mir genau EINE Frage nach der anderen zum Thema, werte meine Antwort, erkläre kurz und stelle dann die nächste."], hw: ["Hausaufgaben", "Hausaufgabenhilfe: gib Hinweise und Teilschritte, lass mich selbst auf die Lösung kommen; zeige die vollständige Lösung nur, wenn ich ausdrücklich darum bitte."], sum: ["Zusammenfassen", "Fasse zusammen, was ich dir gebe, in klaren Stichpunkten."], plan: ["Lernplan", "Erstelle einen realistischen, konkreten Lernplan mit Zeitblöcken."] };
let chatMode = "tutor", chatCtx = new Set(), chatImg = null, chatFiles = [], recog = null;
/* Vom Computer angehängte Dateien/Bilder: nur im Arbeitsspeicher, werden nicht gespeichert, sondern nur mit der Anfrage an die KI gesendet */
const chatImgOf = new WeakMap();
async function ctxText() { let out = ""; for (const f of chatFiles) out += `\n--- ${f.name} (Anhang) ---\n${f.text.slice(0, 12000)}\n`; for (const id of chatCtx) { const d = D.docs.find(x => x.id === id); if (d) out += `\n--- ${d.title} ---\n${(await docText(d)).slice(0, 12000)}\n`; } return out.slice(0, 30000); }
function chatState() {
  D.chats = D.chats || []; D.cprojects = D.cprojects || [];
  if (window.__docChat) { const dc = D.chats.find(x => x.id === window.__docChat); if (dc) return dc; }          // Chat der Seitenleiste gehört nur zum geöffneten Dokument
  if (!D.chats.some(x => !x.docId)) { D.chats.push({ id: uid(), title: "Neuer Chat", projectId: "", instr: "", msgs: Array.isArray(D.chat) ? D.chat : [], updated: Date.now() }); D.chat = []; }
  let c = D.chats.find(x => x.id === D.curChat && !x.docId); if (!c) { c = D.chats.find(x => !x.docId); D.curChat = c.id; } return c;
}
const chatMsgs = () => chatState().msgs;
function chatInstr() { const c = chatState(), p = D.cprojects.find(x => x.id === c.projectId); return [p && p.instr ? `Projekt „${p.name}“ – Anweisungen: ${p.instr}` : "", c.instr ? `Anweisungen für diesen Chat: ${c.instr}` : ""].filter(Boolean).join("\n"); }
function newChat(projectId = "") { const c = { id: uid(), title: "Neuer Chat", projectId, instr: "", msgs: [], updated: Date.now() }; D.chats.unshift(c); D.curChat = c.id; save(); return c; }
const safeUrl = u => /^https?:\/\//i.test(u) ? u : "#";
function citeHtml(html, srcs) { if (!srcs || !srcs.length) return html; return html.replace(/\[(\d{1,2})\]/g, (m, n) => { const s = srcs.find(x => x.n === +n); return s ? `<a class="cite" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${n}</a>` : m; }); }
function srcsHtml(srcs) { return srcs && srcs.length ? `<div class="srcs"><span class="srcs-t">${ic("globe")}Quellen</span>${srcs.map(s => `<a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}"><i>${s.n}</i><span>${esc(s.title)}</span>${ic("ext")}</a>`).join("")}</div>` : ""; }
function chatHistory() {
  const raw = chatMsgs().slice(0, -1).filter(x => x && x.text && !x.sys && (x.role === "user" || x.role === "assistant")).slice(-24);
  const out = [];
  for (const x of raw) { const t = String(x.text).slice(0, 4000); if (out.length && out[out.length - 1].role === x.role) out[out.length - 1].text += "\n\n" + t; else out.push({ role: x.role, text: t }); }
  while (out.length && out[0].role !== "user") out.shift();
  let n = 0; for (let i = out.length - 1; i >= 0; i--) { n += out[i].text.length; if (n > 14000) { out.splice(0, i + 1); break; } }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
const TK_SPIN = '<svg class="tk-sp" viewBox="0 0 24 24" aria-hidden="true">' + Array.from({ length: 8 }, (_, i) => `<circle cx="${(12 + 8.6 * Math.sin(i * Math.PI / 4)).toFixed(2)}" cy="${(12 - 8.6 * Math.cos(i * Math.PI / 4)).toFixed(2)}" r="1.9" style="--i:${i}"/>`).join("") + "</svg>";
/* Trace-Zeilen (Denken, Quellen, Systemhinweise): Icon + Titel, optional aufklappbar */
const trRow = (st, icon, title, body, open) => body
  ? `<details class="tr-c" ${open ? "open" : ""}><summary class="tr-l ${st}"><i class="tr-ic">${icon}</i><span class="tr-t">${title}</span><i class="tr-chev">${ic("chev")}</i></summary><div class="tr-b">${body}</div></details>`
  : `<div class="tr-l ${st}"><i class="tr-ic">${icon}</i><span class="tr-t">${title}</span></div>`;
const trSources = srcs => srcs && srcs.length ? trRow("", ic("globe"), `${srcs.length} ${srcs.length === 1 ? "Quelle" : "Quellen"} verwendet`, srcs.map(s => `<a class="tr-l link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer"><i class="tr-ic">${ic("globe")}</i><span class="tr-t">${esc(s.title)}</span><i class="tr-ic">${ic("ext")}</i></a>`).join("")) : "";
const traceHtml = x => { const rows = [];
  if (x.thought) rows.push(trRow("", ic("check"), `Nachgedacht für ${x.thought} Sek.`, x.seen && x.seen.length ? `Gelesen: ${x.seen.map(t => `<b>${esc(t)}</b>`).join(", ")}` : ""));
  const so = trSources(x.sources); if (so) rows.push(so);
  return rows.length ? `<div class="trace">${rows.join("")}</div>` : ""; };
const sysHtml = sy => { const hasU = typeof AIU !== "undefined" && AIU.on && !AIU.unl && (sy.kind === "limit" || sy.kind === "pro") && typeof aiuRows === "function";
  return `<div class="trace">${trRow("err", ic("alert"), esc(sy.title), `<p>${esc(sy.text)}</p>${hasU ? `<div class="aiu-rows">${aiuRows()}</div>` : ""}${sy.kind === "pro" || sy.kind === "limit" ? `<button class="btn small" data-up="1">Study Pro ansehen</button>` : ""}`, true)}</div>`; };
/* Denk-Animation: Schritte erscheinen nacheinander (Nachdenken → Gelesen → Formulieren), erledigte bekommen einen Haken */
function thinkSeq(el, msgs) {
  const tr = el.firstElementChild;
  const row = (st, icon, title) => { if (!el.isConnected) return null; const r = document.createElement("div"); r.className = "tr-l " + st; r.innerHTML = `<i class="tr-ic">${icon}</i><span class="tr-t">${title}</span>`; tr.appendChild(r); msgs.scrollTop = msgs.scrollHeight; return r; };
  const done = (r, txt, icon = "check") => { if (!r) return; r.classList.remove("run"); r.innerHTML = `<i class="tr-ic">${ic(icon)}</i><span class="tr-t">${txt}</span>`; };
  const seen = [...chatCtx].map(id => D.docs.find(x => x.id === id)).filter(Boolean).slice(0, 3);
  const r1 = tr.firstElementChild;
  setTimeout(() => { if (!el.isConnected) return; done(r1, "Nachgedacht", "check");
    if (seen.length) { const r2 = row("run", TK_SPIN, `<span class="shim">Liest ${seen.map(d => `<b>${esc(d.title)}</b>`).join(", ")} …</span>`); setTimeout(() => { done(r2, `Gelesen: ${seen.map(d => `<b>${esc(d.title)}</b>`).join(", ")}`, "eye"); row("run", TK_SPIN, `<span class="shim">Formuliert die Antwort …</span>`); }, 1500); }
    else row("run", TK_SPIN, `<span class="shim">Formuliert die Antwort …</span>`); }, 1400);
}
/* Chat-Antworten: Markdown (#, **fett**, Listen) wird direkt als Formatierung angezeigt; frische Antworten erscheinen Wort für Wort */
function chatMd(text, fresh) {
  const d = document.createElement("div"); d.innerHTML = textToHtml(String(text || ""));
  if (fresh) wordReveal(d, 2600);
  return d.innerHTML;
}
function mountChat(box, compact) {
  const draw = () => {
    const msgs = $(".msgs", box); msgs.innerHTML = (chatMsgs().length ? chatMsgs() : [{ role: "assistant", text: `Hi${D.profile.name ? " " + D.profile.name.split(" ")[0] : ""}! Ich bin dein Lern-Tutor. Frag mich etwas, lass dir ein Thema erklären.${hasKey() ? "" : "\n\n(Studix AI ist noch nicht eingerichtet – siehe Einstellungen → Studix AI.)"}` }]).map((x, i) => `<div class="m ${x.role === "user" ? "u" : "a"}${x.sys ? " sysm" : ""}">${x.sys ? sysHtml(x.sys) : `${x.img || chatImgOf.get(x) ? `<img src="${x.img || chatImgOf.get(x)}" alt="">` : ""}${x.role === "user" ? "" : traceHtml(x)}${citeHtml(x.role === "user" ? esc(x.text) : chatMd(x.text, x.fresh), x.sources)}`}${x.acts?.length ? `<div class="acts" style="--base:${x.fresh ? Math.min(2600, (x.text.split(/\s+/).length) * 30 + 200) : 0}ms">${x.acts.map(a => `<${a.go ? "button" : "span"} class="act ${a.err ? "err" : ""}" ${a.go ? `data-ag="${esc(a.go)}"` : ""}>${ic(a.err ? "x" : /^doc\//.test(a.go || "") ? "note" : "check")}<span>${esc(a.label)}</span></${a.go ? "button" : "span"}>`).join("")}</div>` : ""}${x.role === "assistant" && !x.sys && chatMsgs().length ? `<div class="macts"><button data-cp="${i}" title="Kopieren">${ic("copy")}</button><button data-sv="${i}" title="Als Notiz speichern">${ic("note")}</button></div>` : ""}</div>`).join("");
    msgs.scrollTop = msgs.scrollHeight;
    $$("[data-ag]", msgs).forEach(b => b.onclick = () => go(b.dataset.ag));
    $$("[data-up]", msgs).forEach(b => b.onclick = () => { if (typeof proUpsell === "function") proUpsell(); else go("settings"); });
    $$("[data-cp]", msgs).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(chatMsgs()[+b.dataset.cp].text); toast("Kopiert"); });
    $$("[data-sv]", msgs).forEach(b => b.onclick = () => limitHit("doc") || newNote("", textToHtml(chatMsgs()[+b.dataset.sv].text), "Studix-AI-Notiz"));
    const cx = $(".ctxbar", box); if (cx) { cx.innerHTML = [...chatCtx].map(id => { const d = D.docs.find(x => x.id === id); return d ? `<span class="cx" title="${esc(d.title)}">${ic("file")}<b>${esc(d.title)}</b><button type="button" data-rm="${id}" aria-label="Entfernen">${ic("x")}</button></span>` : ""; }).join(""); cx.innerHTML += chatFiles.map((f, i) => `<span class="cx" title="${esc(f.name)}">${ic("file")}<b>${esc(f.name)}</b><button type="button" data-rf="${i}" aria-label="Entfernen">${ic("x")}</button></span>`).join(""); cx.hidden = !chatCtx.size && !chatFiles.length; $$("[data-rm]", cx).forEach(b => b.onclick = () => { chatCtx.delete(b.dataset.rm); draw(); }); $$("[data-rf]", cx).forEach(b => b.onclick = () => { chatFiles.splice(+b.dataset.rf, 1); draw(); }); $("#att", box)?.classList.toggle("on", chatCtx.size > 0 || chatFiles.length > 0); }
    const pv = $(".imgprev", box); if (pv) { pv.hidden = !chatImg; pv.innerHTML = chatImg ? `<img src="${chatImg.url}" alt=""><button aria-label="Entfernen">${ic("x")}</button>` : ""; $("button", pv)?.addEventListener("click", () => { chatImg = null; draw(); }); }
  };
  const pickCtx = () => { const { el, close } = modal(`<h3>Kontext wählen</h3><p class="note">Studix AI beantwortet Fragen anhand dieser Dokumente.</p><div class="pick">${D.docs.filter(d => d.type !== "draw").map(d => `<label class="li"><input type="checkbox" value="${d.id}" ${chatCtx.has(d.id) ? "checked" : ""}><b>${esc(d.title)}</b><small>${esc(subj(d.subjectId)?.name || "")}</small></label>`).join("") || `<p class="empty">Keine Dokumente.</p>`}</div><div class="row end"><button class="btn accent" id="ok">Übernehmen</button></div>`); $("#ok", el).onclick = () => { chatCtx = new Set($$("input:checked", el).map(i => i.value)); close(); draw(); }; };
  const send = async text => {
    text = (text || "").trim(); if (!text && !chatImg) return; const img = chatImg, c0 = await ctxText(); chatImg = null; chatFiles = [];
    { const cc = chatState(); cc.msgs.push({ role: "user", text: text || "Bitte erkläre das Bild.", img: undefined }); chatImgOf.set(cc.msgs[cc.msgs.length - 1], img?.url); cc.updated = Date.now(); if (cc.title === "Neuer Chat" && text) cc.title = text.slice(0, 40); } draw(); window.onChatsChanged && window.onChatsChanged();
    const msgs = $(".msgs", box); const tkEl = document.createElement("div"); tkEl.className = "m a think tkb"; tkEl.innerHTML = `<div class="trace"><div class="tr-l run">${TK_SPIN.replace("tk-sp","tk-sp")}<span class="tr-t"><span class="shim">Denkt nach …</span></span></div></div>`; msgs.appendChild(tkEl); thinkSeq(tkEl, msgs); msgs.scrollTop = msgs.scrollHeight;
    const t0 = Date.now(), seenT = [...chatCtx].map(id => D.docs.find(x => x.id === id)).filter(Boolean).slice(0, 3).map(d => d.title), c = c0, hist = chatHistory(); let r;
    if (hasKey()) r = await agentAi(text || "Bitte erkläre das Bild.", { sources: sourcesOn() && !img && aiModelProv(aiModelId()) === "Gemini", history: hist, system: sysBase(MODES[chatMode][1] + "\n\nFormatiere Antworten mit Markdown: **fett** für Schlüsselbegriffe, ## kurze Überschriften bei längeren Antworten, \"- \" Listen und \"1. \" nummerierte Listen. Keine Tabellen." + (chatInstr() ? "\n\n" + chatInstr() : "") + "\n\n" + AGENT_RULES + "\n\nAktueller Stand der App:\n" + agentContext() + await agentPrefetch(text || "") + (c ? `\nNutze diese Unterlagen des Lernenden als Grundlage:\n${c}` : "")), max: 2000, quiet: true, image: img ? { data: img.data, type: "image/jpeg" } : null });
    else { await new Promise(r => setTimeout(r, 500)); r = c && chatMode === "sum" ? "Zusammenfassung (lokal):\n" + localSummary(c) : "Studix AI ist noch nicht eingerichtet, deshalb kann ich keine echten Antworten erzeugen. Hinterlege unter Einstellungen → Studix AI den Gemini-Key (Vercel) – dann erkläre ich Themen, frage dich ab und helfe bei Hausaufgaben. Zusammenfassungen, Karteikarten und Quiz aus Dokumenten funktionieren schon jetzt auch offline."; }
    const srcs = (window.lastAiSources || []).slice(); let acts = []; if (r && hasKey()) { try { const o = await runAgent(r); r = o.text; acts = o.acts; } catch (e) { r = r.replace(/<lumi-actions>[\s\S]*/i, "").trim(); } }
    { const cc = chatState(); const issue = !r && hasKey() ? window.lastAiIssue : null; cc.msgs.push(issue ? { role: "assistant", text: issue.text, sys: issue } : { role: "assistant", text: r || "Das hat leider nicht geklappt. Versuche es bitte noch einmal.", acts, sources: srcs, fresh: true, thought: Math.max(1, Math.round((Date.now() - t0) / 1000)), seen: seenT }); cc.msgs = cc.msgs.slice(-80); cc.updated = Date.now(); draw(); cc.msgs.forEach(x => delete x.fresh); }
    save();
  };
  box.innerHTML = `${compact ? `<header>${ic("spark")}<b>Studix AI</b><button class="icon-btn" data-full title="Vollbild">${ic("up")}</button><button class="icon-btn" data-close aria-label="Schließen">${ic("x")}</button></header>` : ""}<div class="msgs"></div><div class="imgprev" hidden></div>
  <form class="t-in cmp"><div class="ctxbar"></div><input class="tin" name="lumi-chat" type="text" placeholder="Frag Studix AI etwas …" aria-label="Nachricht" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" writingsuggestions="false" data-form-type="other" data-lpignore="true" data-1p-ignore><input type="file" id="cfi" accept="image/*,application/pdf,text/plain,text/markdown,text/csv,.pdf,.txt,.md,.csv,.json" multiple hidden><button type="button" id="cam" hidden aria-hidden="true"></button><div class="cmp-bar"><button type="button" class="cmp-b" id="att" title="Dateien und Dokumente" aria-label="Dateien und Dokumente">${ic("clip")}</button>${serverAI ? `<button type="button" class="mdl" id="mdl" title="Modell wählen" aria-label="Modell wählen">${(provLogo(aiModelProv(aiModelId())) || ic(aiModelProv(aiModelId()).toLowerCase()))}<span>${aiModelName(aiModelId())}</span>${ic("chev")}</button>` : ""}${serverInfo && serverInfo.gemini ? `<button type="button" class="cmp-b src ${sourcesOn() ? "on" : ""}" id="src" title="Quellen an / aus" aria-label="Quellen an oder aus">${ic("globe")}</button>` : ""}<span class="cmp-sp"></span><button class="send" aria-label="Senden">${ic("up")}</button></div></form><p class="ai-note"><span>Studix AI ist eine KI und kann Fehler machen – prüfe wichtige Antworten. Studix AI wird mit Unterstützung von Google Gemini und Groq betrieben.</span></p>`;
  $(".t-in", box).onsubmit = e => { e.preventDefault(); const i = $(".tin", box); const v = i.value; i.value = ""; send(v); };
  $("#cam", box).onclick = () => $("#cfi", box).click();
  $("#cfi", box).onchange = async e => { const fs = [...e.target.files]; e.target.value = ""; for (const f of fs) { if (/^image\//.test(f.type)) chatImg = { data: await blobToJpeg(f), url: "data:image/jpeg;base64," + (await blobToJpeg(f, 300)) }; else { const t = await fileText(f, f.name, f.type); if (t.trim()) chatFiles.push({ name: f.name, text: t.slice(0, 60000) }); else toast(`„${f.name}“ enthält keinen lesbaren Text`); } } draw(); if (!hasKey()) toast("Anhänge brauchen die eingerichtete Studix AI"); };
  $("#att", box).onclick = e => menu(e.currentTarget, [{ label: "Datei oder Bild vom Computer", icon: "clip", fn: () => $("#cfi", box).click() }, { label: "Dokument aus Studix", icon: "file", fn: pickCtx }]);
  $("#src", box)?.addEventListener("click", e => { D.profile.sources = !sourcesOn(); save(); e.currentTarget.classList.toggle("on", sourcesOn()); toast(sourcesOn() ? "Quellen an" : "Quellen aus"); });
  $("#mdl", box)?.addEventListener("click", e => {
    const b = e.currentTarget; document.querySelectorAll(".mpop").forEach(x => x.remove());
    const L = aiModelList(), pop = document.createElement("div"); pop.className = "mpop"; let html = "", last = "";
    for (const [id, n, d, prov] of L) { if (prov !== last) { html += `<div class="mp-h">${(provLogo(prov) || ic(prov.toLowerCase()))}<span>${AI_PROV[prov] || prov}</span></div>`; last = prov; } html += `<button type="button" class="mp-i ${id === aiModelId() ? "on" : ""}" data-id="${id}">${(provLogo(prov) || ic(prov.toLowerCase()))}<span class="mp-t"><b>${n}</b><small>${d}</small></span>${id === aiModelId() ? ic("check") : ""}</button>`; }
    if (serverInfo && serverInfo.gemini) html += `<button type="button" class="mp-i mp-src ${sourcesOn() ? "on" : ""}" id="mp-src">${ic("globe")}<span class="mp-t"><b>Quellen</b><small>Mit Google-Suche, direkt anklickbar</small></span><i class="mp-sw"></i></button>`;
    pop.innerHTML = html; document.body.appendChild(pop);
    $("#mp-src", pop)?.addEventListener("click", ev => { ev.stopPropagation(); D.profile.sources = !sourcesOn(); save(); ev.currentTarget.classList.toggle("on", sourcesOn()); });
    /* Liste scrollbar und immer sichtbar (iPad: viele Modelle, Auswahl liegt unten) */
    const r = b.getBoundingClientRect(), vh = (window.visualViewport ? visualViewport.height : innerHeight), pw = pop.offsetWidth, full = pop.scrollHeight;
    const above = r.top - 18, below = vh - r.bottom - 18, up = full <= above || above >= below, room = Math.max(120, up ? above : below), ph = Math.min(full, room);
    pop.style.maxHeight = room + "px";
    pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left)) + "px"; pop.style.top = (up ? Math.max(8, r.top - ph - 10) : r.bottom + 10) + "px";
    requestAnimationFrame(() => pop.classList.add("on"));
    const close = () => { pop.classList.remove("on"); setTimeout(() => pop.remove(), 180); document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", kd, true); }, out = ev => { if (!pop.contains(ev.target) && !b.contains(ev.target)) close(); }, kd = ev => { if (ev.key === "Escape") close(); };
    setTimeout(() => { document.addEventListener("mousedown", out, true); document.addEventListener("keydown", kd, true); }, 0);
    $$(".mp-i[data-id]", pop).forEach(x => x.onclick = () => { D.profile.aiModel = x.dataset.id; save(); const m = AI_MODELS.find(y => y[0] === x.dataset.id); b.innerHTML = `${ic(m[3].toLowerCase())}<span>${m[1]}</span>${ic("chev")}`; close(); });
  });
  $("[data-close]", box)?.addEventListener("click", () => box.hidden = true); $("[data-full]", box)?.addEventListener("click", () => { box.hidden = true; go("ai"); });
  draw();
  phCycle($(".tin", box));
  if (chatPrefill) { const p = chatPrefill; chatPrefill = ""; send(p); }
}
V.ai = m => {
  m.classList.add("aipg"); if ($("#cpanel")) $("#cpanel").hidden = true;
  let filter = "";
  const page = () => {
    const cur = chatState();
    m.innerHTML = `<div class="aip"><aside class="aip-l" id="aipl"></aside><section class="aip-r"><header class="aip-t setcrumb pagehead"><button class="icon-btn aip-mob" id="cmob" aria-label="Chats">${ic("menu")}</button><span>Studix AI</span><i>/</i><input id="ct" value="${esc(cur.title)}" aria-label="Chat-Titel" maxlength="60"><nav class="settabs sdock aip-ta"><span class="aip-pj" id="cpj"></span>${aiuRingHtml()}${dkAct("instr", "Anweisungen", 'id="ci"')}</nav></header><div class="chatbox flat" id="cbox"></div></section></div>`;
    aside(); mountChat($("#cbox", m), false); hdr();
    $("#ct", m).onchange = e => { chatState().title = e.target.value.trim() || "Neuer Chat"; save(); aside(); };
    $("#ci", m).onclick = instrModal; $(".aiu", m) && ($(".aiu", m).onclick = e => { e.stopPropagation(); aiuPop(e.currentTarget); }); aiuLoad().then(() => { const ta = $(".aip-ta", m); if (ta && !$(".aiu", ta)) aiuMount(ta, $("#ci", ta)); }); $("#cmob", m).onclick = e => menu(e.currentTarget, [{ label: "Neuer Chat", icon: "plus", fn: () => { newChat(filter); page(); } }, ...D.chats.slice(0, 12).map(c => ({ label: c.title, icon: "note", fn: () => { D.curChat = c.id; page(); } }))]);
  };
  const hdr = () => { const c = chatState(), p = D.cprojects.find(x => x.id === c.projectId); const e = $("#cpj", m); if (e) e.textContent = p ? p.name : ""; };
  const aside = () => {
    const box = $("#aipl", m); if (!box) return; const cur = chatState();
    const list = D.chats.filter(c => !c.docId && (!filter || c.projectId === filter)).sort((a, b) => b.updated - a.updated);
    box.innerHTML = `<div class="aip-top"><button class="aip-new" id="cn">${ic("plus")}<span>Neuer Chat</span></button><button class="aip-new aip-voice" id="cvc">${ic("mic")}<span>AI Voice</span></button></div>
      <div class="aip-h"><span>Projekte</span><button class="icon-btn sm" id="pn" aria-label="Neues Projekt">${ic("plus")}</button></div>
      <div class="aip-list">${D.cprojects.map(p => `<div class="aip-i ${filter === p.id ? "on" : ""}" data-p="${p.id}" tabindex="0">${ic("folder")}<span>${esc(p.name)}</span><button class="aip-m" data-pm="${p.id}" aria-label="Projekt-Menü">${ic("more")}</button></div>`).join("") || `<p class="aip-e">Gruppiere Chats mit gemeinsamen Anweisungen.</p>`}</div>
      <div class="aip-h"><span>${filter ? esc(D.cprojects.find(x => x.id === filter)?.name || "Chats") : "Chats"}</span>${filter ? `<button class="link" id="pall">Alle</button>` : ""}</div>
      <div class="aip-list aip-chats">${list.map(c => `<div class="aip-i ${c.id === cur.id ? "on" : ""}" data-c="${c.id}" tabindex="0"><span>${esc(c.title)}</span><button class="aip-m" data-cm="${c.id}" aria-label="Chat-Menü">${ic("more")}</button></div>`).join("") || `<p class="aip-e">Keine Chats</p>`}</div>`;
    $("#cn", box).onclick = () => { newChat(filter); page(); }; $("#cvc", box).onclick = () => go("voice");
    $("#pn", box).onclick = () => projModal();
    $("#pall", box) && ($("#pall", box).onclick = () => { filter = ""; aside(); });
    $$("[data-c]", box).forEach(b => b.onclick = e => { if (e.target.closest("[data-cm]")) return; D.curChat = b.dataset.c; save(); page(); });
    $$("[data-p]", box).forEach(b => b.onclick = e => { if (e.target.closest("[data-pm]")) return; filter = filter === b.dataset.p ? "" : b.dataset.p; aside(); });
    $$("[data-cm]", box).forEach(b => b.onclick = e => { e.stopPropagation(); const c = D.chats.find(x => x.id === b.dataset.cm); menu(b, [{ label: "Anweisungen", icon: "spark", fn: () => { D.curChat = c.id; page(); instrModal(); } }, { label: "Löschen", icon: "trash", fn: async () => { if (!await confirmBox(`„${c.title}“ löschen?`)) return; D.chats = D.chats.filter(x => x.id !== c.id); if (!D.chats.length) newChat(); D.curChat = D.chats[0].id; save(); page(); } }]); });
    $$("[data-pm]", box).forEach(b => b.onclick = e => { e.stopPropagation(); const p = D.cprojects.find(x => x.id === b.dataset.pm); menu(b, [{ label: "Bearbeiten", icon: "edit", fn: () => projModal(p) }, { label: "Neuer Chat im Projekt", icon: "plus", fn: () => { filter = p.id; newChat(p.id); page(); } }, { label: "Löschen", icon: "trash", fn: async () => { if (!await confirmBox(`Projekt „${p.name}“ löschen? Die Chats bleiben erhalten.`)) return; D.chats.forEach(c => { if (c.projectId === p.id) c.projectId = ""; }); D.cprojects = D.cprojects.filter(x => x.id !== p.id); if (filter === p.id) filter = ""; save(); aside(); hdr(); } }]); });
  };
  window.onChatsChanged = () => { if ($("#aipl", m)) { aside(); const t = $("#ct", m); if (t && document.activeElement !== t) t.value = chatState().title; } else window.onChatsChanged = null; };
  const instrModal = () => {
    const c = chatState(), p = D.cprojects.find(x => x.id === c.projectId);
    const { el, close } = modal(`<h3>Anweisungen für diesen Chat</h3><p class="note">Studix AI beachtet diese Regeln in jeder Antwort dieses Chats.</p>
      <textarea class="field" id="in-c" rows="5" placeholder="z. B. Antworte kurz, in einfachen Worten und mit einem Beispiel aus dem Alltag.">${esc(c.instr)}</textarea>
      <label class="lbl">Projekt</label><select class="field" id="in-p"><option value="">Kein Projekt</option>${D.cprojects.map(x => `<option value="${x.id}" ${x.id === c.projectId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      ${p ? `<p class="note">Zusätzlich gelten die Anweisungen des Projekts „${esc(p.name)}“.</p>` : ""}
      <div class="row end" style="margin-top:14px"><button class="btn primary" id="in-s">Speichern</button></div>`);
    $("#in-s", el).onclick = () => { c.instr = $("#in-c", el).value.trim(); c.projectId = $("#in-p", el).value; save(); close(); aside(); hdr(); toast("Anweisungen gespeichert"); };
  };
  const projModal = p => {
    const { el, close } = modal(`<h3>${p ? "Projekt bearbeiten" : "Neues Projekt"}</h3><label class="lbl">Name</label><input class="field" id="pj-n" maxlength="40" value="${esc(p?.name || "")}" placeholder="z. B. Biologie-Abitur">
      <label class="lbl">Anweisungen für alle Chats im Projekt</label><textarea class="field" id="pj-i" rows="5" placeholder="z. B. Ich lerne für das Abitur. Erkläre auf Oberstufen-Niveau und frage mich am Ende ab.">${esc(p?.instr || "")}</textarea>
      <div class="row end" style="margin-top:14px"><button class="btn primary" id="pj-s">${p ? "Speichern" : "Anlegen"}</button></div>`);
    setTimeout(() => $("#pj-n", el).focus(), 50);
    $("#pj-s", el).onclick = () => { const n = $("#pj-n", el).value.trim(); if (!n) return toast("Bitte einen Namen eingeben"); if (p) { p.name = n; p.instr = $("#pj-i", el).value.trim(); } else { const np = { id: uid(), name: n, instr: $("#pj-i", el).value.trim() }; D.cprojects.push(np); filter = np.id; } save(); close(); aside(); hdr(); };
  };
  page();
};
/* Unten auf der Startseite bleibt ein Bereich frei: nur die Eingabe. Beim Schreiben wird der ganze Bereich weiß und der Chat groß. */
function mountDock(m) {
  document.getElementById("hdock")?.remove();
  const el = document.createElement("div"); el.id = "hdock"; el.className = "hdock";
  el.innerHTML = `<div class="hd-bg"></div><div class="hd-in"><div class="hd-top"><button type="button" class="btn small hd-new">${ic("plus")}Neuer Chat</button>${aiuRingHtml()}<button type="button" class="icon-btn hd-x" aria-label="Schließen">${ic("x")}</button></div><div class="chatbox flat" id="hcb"></div></div>`;
  document.body.appendChild(el);
  if (!window.__dockFresh) { window.__dockFresh = true; if (chatMsgs().length) newChat(); }
  const mount = () => { mountChat($("#hcb", el), false); const t = $(".tin", el); t.addEventListener("input", () => tog(true)); $(".t-in", el).addEventListener("submit", () => tog(true), true); };
  const fit = () => { const r0 = m.getBoundingClientRect(), r = { left: r0.left, width: r0.width, top: Math.max(0, r0.top), bottom: Math.min(innerHeight, r0.bottom) }; el.style.setProperty("--dl", r.left + "px"); el.style.setProperty("--dw", r.width + "px"); el.style.setProperty("--gx", (parseFloat(getComputedStyle(m).paddingLeft) || 22) + "px"); el.style.setProperty("--dt", r.top + "px"); const tin = $(".t-in", el), bh = (tin ? tin.offsetHeight : 100) + 24; el.style.setProperty("--dtc", r.bottom - bh + "px"); if (innerWidth > 900) m.style.setProperty("padding-bottom", bh + "px", "important"); el.style.setProperty("--db", innerHeight - r.bottom + "px"); };
  const tog = o => { if (o === el.classList.contains("open")) return; fit(); el.classList.toggle("open", o); document.body.classList.toggle("hd-open2", o); if (!o) { document.activeElement?.blur?.(); $(".msgs", el).scrollTop = 1e9; } else setTimeout(() => { const ms = $(".msgs", el); ms.scrollTop = ms.scrollHeight; }, 60); };
  const key = e => { if (e.key === "Escape" && el.classList.contains("open") && !document.querySelector(".popmenu,.mpop,.modal")) tog(false); };
  $(".hd-x", el).onclick = () => tog(false); $(".aiu", el) && ($(".aiu", el).onclick = e => { e.stopPropagation(); aiuPop(e.currentTarget); }); aiuLoad().then(() => { const h = $(".hd-top", el); if (h && !$(".aiu", h)) aiuMount(h, $(".hd-x", h)); });
  $(".hd-new", el).onclick = () => { newChat(); mount(); $(".tin", el).focus(); };
  addEventListener("resize", fit); document.addEventListener("keydown", key); mount(); fit(); setTimeout(fit, 300);
  /* folgt dem Raster, wenn die Seitenleiste ein-/ausgeklappt wird (iPad, Drehen, Fenstergröße) */
  let lw = 0, ll = 0; const ro = new ResizeObserver(() => { const r = m.getBoundingClientRect(); if (Math.abs(r.width - lw) > 0.5 || Math.abs(r.left - ll) > 0.5) { lw = r.width; ll = r.left; fit(); } }); ro.observe(m);
  const shell = document.querySelector(".shell"), mo = shell && new MutationObserver(() => { fit(); setTimeout(fit, 120); setTimeout(fit, 320); }); if (mo) mo.observe(shell, { attributes: true, attributeFilter: ["class"] });
  LEAVE.push(() => { el.remove(); document.body.classList.remove("hd-open2"); try { ro.disconnect(); mo && mo.disconnect(); } catch {} removeEventListener("resize", fit); document.removeEventListener("keydown", key); });
}
function toggleChatPanel() { const p = $("#cpanel"); if (p.hidden) { p.hidden = false; mountChat(p, true); } else p.hidden = true; }

/* ---------- search ---------- */
V.search = async m => {
  m.innerHTML = `<div class="page"><div class="hd"><div><p class="eyebrow">Strg/Cmd + K</p><h1>Suche</h1></div></div><div class="searchbox big">${ic("search")}<input id="sq" placeholder="Dokumente, Aufgaben, Karteikarten durchsuchen…" autofocus></div><div id="sr"></div></div>`;
  const draw = () => {
    const q = $("#sq", m).value.trim().toLowerCase(); const sr = $("#sr", m); if (!q) { sr.innerHTML = `<p class="empty">Tippe, um alles zu durchsuchen.</p>`; return; }
    const docs = D.docs.filter(d => (d.title + " " + (d.text || "")).toLowerCase().includes(q)), tasks = D.tasks.filter(t => (t.title + " " + (t.note || "")).toLowerCase().includes(q)), cards = D.decks.flatMap(d => d.cards.map(c => ({ ...c, d }))).filter(c => (c.q + " " + c.a).toLowerCase().includes(q)).slice(0, 12);
    const snip = d => { const t = d.text || "", i = t.toLowerCase().indexOf(q); return i < 0 ? "" : "…" + esc(t.slice(Math.max(0, i - 40), i + 80)) + "…"; };
    sr.innerHTML = `${docs.length ? `<section class="panel"><h2>Dokumente<small>${docs.length}</small></h2>${docs.slice(0, 15).map(d => `<button class="li hit" data-d2="${d.id}">${ic(d.type === "note" ? "note" : d.type === "draw" ? "brush" : "file")}<div class="tm2"><b>${esc(d.title)}</b><small>${snip(d)}</small></div></button>`).join("")}</section>` : ""}${tasks.length ? `<section class="panel"><h2>Aufgaben<small>${tasks.length}</small></h2>${tasks.map(t => `<button class="li hit" data-go="planner">${ic("todo")}<b>${esc(t.title)}</b><small>${t.due ? fmtD(t.due) : ""}</small></button>`).join("")}</section>` : ""}${cards.length ? `<section class="panel"><h2>Karteikarten<small>${cards.length}</small></h2>${cards.map(c => `<button class="li hit" data-k2="${c.d.id}">${ic("cards")}<div class="tm2"><b>${esc(c.q)}</b><small>${esc(c.a)}</small></div></button>`).join("")}</section>` : ""}${docs.length + tasks.length + cards.length ? "" : `<p class="empty">Nichts gefunden.</p>`}`;
    $$("[data-d2]", sr).forEach(b => b.onclick = () => openDoc(D.docs.find(d => d.id === b.dataset.d2))); $$("[data-k2]", sr).forEach(b => b.onclick = () => go("cards/" + b.dataset.k2)); $$("[data-go]", sr).forEach(b => b.onclick = () => go("planner"));
  };
  if (searchPrefill) { $("#sq", m).value = searchPrefill; searchPrefill = ""; }
  $("#sq", m).oninput = debounce(draw, 150); draw(); setTimeout(() => $("#sq", m)?.focus(), 30);
};

/* ---------- settings ---------- */
async function exportAll() {
  toast("Export wird vorbereitet…"); const out = { app: "lumi", v: 1, data: D, html: {}, draw: {}, ink: {}, ann: {}, db: {}, blobs: {} };
  for (const d of D.docs) { if (d.type === "note") { out.html[d.id] = await KV.get("html:" + d.id); const ik = await KV.get("ink:" + d.id); if (ik?.length) out.ink[d.id] = ik; } else if (d.type === "draw") out.draw[d.id] = await KV.get("draw:" + d.id); else { const b = await KV.get("blob:" + d.id); if (b) out.blobs[d.id] = await blobToDataURL(b); } }
  for (const d of D.docs) { const ik = await KV.get("ink:" + d.id); if (ik?.length) out.ink[d.id] = ik; const an = await KV.get("ann:" + d.id); if (an?.length) out.ann[d.id] = an; if (d.type === "db") out.db[d.id] = await KV.get("db:" + d.id); }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" })); a.download = `lumi-backup-${iso()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function importAll(file) {
  try { const j = JSON.parse(await file.text()); if (j.app !== "lumi") throw 0; if (!(await confirmBox("Aktuelle Daten durch das Backup ersetzen?", "Ersetzen"))) return;
    D = Object.assign(DEFAULT(), j.data); for (const [k, v] of Object.entries(j.html || {})) await KV.set("html:" + k, v); for (const [k, v] of Object.entries(j.draw || {})) await KV.set("draw:" + k, v); for (const [k, v] of Object.entries(j.ink || {})) await KV.set("ink:" + k, v); for (const [k, v] of Object.entries(j.ann || {})) await KV.set("ann:" + k, v); for (const [k, v] of Object.entries(j.db || {})) await KV.set("db:" + k, v); for (const [k, v] of Object.entries(j.blobs || {})) await KV.set("blob:" + k, await (await fetch(v)).blob()); await KV.set("data", D); toast("Backup geladen"); location.reload();
  } catch { toast("Ungültige Backup-Datei"); }
}
const KVI = Object.fromEntries(Object.entries({
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3.5"/><path d="M4.5 8l7.5 5.5L19.5 8"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 4.2 4.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A15 15 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z"/>',
  pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  book: '<path d="M5 4.5h10a3 3 0 0 1 3 3V19.5H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10"/>',
  cap: '<path d="M2.8 9.5L12 5l9.2 4.5L12 14z"/><path d="M6.5 11.8V16c1.4 1.3 3.2 2 5.5 2s4.1-.7 5.5-2v-4.2"/>',
  link: '<path d="M10.3 13.7l3.4-3.4"/><path d="M8.6 15.4l-1.2 1.2a3.1 3.1 0 01-4.4-4.4l3.2-3.2a3.1 3.1 0 014.4 0"/><path d="M15.4 8.6l1.2-1.2a3.1 3.1 0 014.4 4.4l-3.2 3.2a3.1 3.1 0 01-4.4 0"/>',
  star: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
}).map(([k, v]) => [k, `<svg class="kvi" viewBox="0 0 24 24" aria-hidden="true">${v}</svg>`]));
V.settings = m => {
  const p = D.profile;
  if (!p.scale) { p.scale = obScaleFor(proCountry()); save(); }
  m.innerHTML = `<div class="page setpage"><div class="setcrumb"><span>Einstellungen</span><i>/</i><b id="setcrumb">Profil</b><nav class="settabs sdock" role="tablist" aria-label="Einstellungen">${[["gen", "Profil", '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5"/>'], ["ai", "Studix AI", '<path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>'], ["acc", "Konto", '<path d="M7.2 18.5a4.6 4.6 0 01-.7-9.1 6 6 0 0111.6 1.2 3.95 3.95 0 01-.6 7.9z"/>'], ["pro", "Pro", '<path d="M4 8.5l4.2 3.6L12 5.5l3.8 6.6L20 8.5l-1.6 9.5H5.6z"/><path d="M6 20.5h12"/>'], ["con", "Verbindungen", '<path d="M10.3 13.7l3.4-3.4"/><path d="M8.6 15.4l-1.2 1.2a3.1 3.1 0 01-4.4-4.4l3.2-3.2a3.1 3.1 0 014.4 0"/><path d="M15.4 8.6l1.2-1.2a3.1 3.1 0 014.4 4.4l-3.2 3.2a3.1 3.1 0 01-4.4 0"/>'], ["dat", "Daten", '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>']].map(([k, n, p]) => `<button type="button" role="tab" data-s="${k}" aria-label="${n}" title="${n}"><span class="sdk-i"><svg viewBox="0 0 24 24">${p}</svg></span><span class="stl">${n}</span></button>`).join("")}<i class="sdk-sep" aria-hidden="true"></i><button class="theme-tg" id="theme-tg" type="button" aria-label="Hell oder dunkel umschalten" title="Hell / Dunkel"><svg class="tg-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="tg-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></nav></div><div class="setbody">
  <div class="setsec" data-s="gen">
  <div class="prof-head"><div class="pgrid" aria-hidden="true">${(() => { let x = 7; return Array.from({ length: 140 }, () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return `<i class="${x % 100 < 24 ? "f" : ""}"></i>`; }).join(""); })()}</div><span class="av-xl" style="background:${meCol()}">${esc((p.name || CLOUD.user?.email || "L").trim()[0].toUpperCase())}</span><div><h1>${esc(p.name || "Dein Name")}${proBadgeHtml()}</h1><p>${esc(CLOUD.user?.email || "Nicht angemeldet")}</p>${proPillHtml()}</div>${CLOUD.user ? `<button class="btn ghost small pf-auth" id="pf-auth" type="button">${ic("x")}Abmelden</button>` : cloudOn() ? `<button class="btn accent small pf-auth" id="pf-auth" type="button">${ic("adduser")}Anmelden</button>` : ""}</div>
  ${proBannerHtml()}
  <div class="panel kvcard kv-wide"><h2>${ic("adduser")}Persönliche Angaben<button class="kv-edit" type="button" aria-label="Bearbeiten" title="Bearbeiten">${ic("pen")}</button></h2>
    <div class="kvg">
    <div class="kv"><span>${KVI.user}Name</span><input class="field flat" id="sn" value="${esc(p.name)}" placeholder="Dein Name"></div>
    <div class="kv"><span>${KVI.mail}E-Mail</span><b>${esc(CLOUD.user?.email || "Nicht angemeldet")}</b></div>
    <div class="kv"><span>${KVI.phone}Telefon</span><input class="field flat" id="sph" type="tel" value="${esc(p.phone || "")}" placeholder="+41 79 123 45 67" autocomplete="tel"></div>
    <div class="kv"><span>${KVI.cal}Geburtstag<em class="kvreq">Pflicht</em></span><input class="field flat" id="sbd" type="date" required max="${iso()}" value="${esc(p.birthday || "")}"><small class="kvh">Bitte angeben – wird für die Altersangabe (Jugendschutz) benötigt.</small></div>
    <div class="kv"><span>${KVI.globe}Land / Region</span><div class="kvc"><select class="field flat" id="sc">${countryOptions(proCountry())}</select><small id="sch">${priceHint(proCountry()) ? "Studix Study Pro: " + priceHint(proCountry()) : ""}</small></div></div>
    <div class="kv"><span>${KVI.pin}Ort</span><input class="field flat" id="sci" value="${esc(p.city || "")}" placeholder="z. B. Zürich"></div>
    <div class="kv"><span>${KVI.book}${p.level === "uni" ? "Hochschule" : "Schule"}</span><input class="field flat" id="ssc" value="${esc(p.school || "")}" placeholder="${p.level === "uni" ? "z. B. ETH Zürich" : "z. B. Kantonsschule"}"></div>
    <div class="kv"><span>${KVI.cap}${p.level === "uni" ? "Studiengang" : "Klasse"}</span><input class="field flat" id="scl" value="${esc(p.course || "")}" placeholder="${p.level === "uni" ? "z. B. Biologie, 3. Semester" : "z. B. 3b"}"></div>
    <div class="kv"><span>${KVI.user}Ich bin</span><div class="seg" id="sl"><button data-l="school" class="${p.level === "school" ? "on" : ""}">Schüler:in</button><button data-l="uni" class="${p.level === "uni" ? "on" : ""}">Student:in</button></div></div>
    <div class="kv"><span>${KVI.star}Sprache</span><div class="kvc" data-nolang><select class="lang-sel" id="slang" aria-label="Sprache"><option value="en"${LPL.lang === "en" ? " selected" : ""}>English</option><option value="de"${LPL.lang === "de" ? " selected" : ""}>Deutsch</option><option value="fr"${LPL.lang === "fr" ? " selected" : ""}>Français</option></select></div></div>
    <div class="kv"><span>${KVI.star}Profilfarbe</span><div class="avsw" id="avsw">${CO_COL.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${meCol() === c ? "on" : ""}" aria-label="Farbe"></button>`).join("")}</div></div>
    </div>
  </div>
  <div class="panel aiuse" id="aiuse" hidden></div>
  ${cloudOn() && BILL.cfg && BILL.cfg.enabled ? `<div class="sthome setfull"><span class="sth-i">${ic("gift")}</span><div><b>Freunde einladen</b><small>Ihr bekommt beide 1 Monat Pro und ${money(200)} Guthaben – mit Essential und Pro.</small></div><button class="btn ghost small" type="button" data-invite>Einladen</button></div>` : ""}
  <div class="sthome setfull"><span class="sth-i">${ic("table")}</span><div><b>Startseite</b><small>Blöcke ersetzen, verschieben und in der Größe ändern – mit Vorlagen.</small></div><button class="btn ghost small" id="hed-open" type="button">${ic("pen")}Bearbeiten</button></div>
  ${CLOUD.user && cloudOn() ? `<div class="sthome setfull rc-card"><span class="sth-i">${ic("gift")}</span><div><b>Code einlösen</b><small class="rc-m" id="rc-msg">Einladungs- oder Early-Access-Code eingeben – schaltet z. B. Pro für einen Monat frei.</small></div><input class="field pill" id="rc-in" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" aria-label="Code"><button class="btn small" id="rc-go" type="button">Einlösen</button></div>` : ""}
  ${CLOUD.user ? `<div class="accbot"><button class="btn ghost" id="set-out" type="button">${ic("logout")}Abmelden</button><button class="btn danger-o" id="set-del" type="button">${ic("trash")}Konto löschen</button></div>` : ""}
  </div><div class="setsec" data-s="ai">
  <div class="panel"><h2>${ic("spark")}Studix AI</h2>
  ${serverAI ? `<div class="msstate ok"><b><i class="ldot on"></i>Studix AI aktiv – ${[serverInfo?.gemini ? "Google Gemini" : "", serverInfo?.groq ? "Groq" : "", serverInfo?.openrouter ? "weitere Modelle" : ""].filter(Boolean).join(" + ") || "Server-KI"}</b><span>Läuft serverseitig über Vercel, du musst nichts eintragen.${serverInfo?.groq ? "" : " Für schnelle Auto-Korrektur zusätzlich <code>GROQ_API_KEY</code> in Vercel setzen."}</span></div>` : `<div class="msstate"><b><i class="ldot"></i>Server-KI noch nicht aktiv</b><span>Hinterlege in Vercel die Variable GEMINI_API_KEY und/oder GROQ_API_KEY und deploye neu – oder nutze unten einen eigenen Key.</span></div>`}
  ${serverAI && serverInfo?.gemini ? `<label class="chk" style="display:flex;gap:10px;align-items:center;margin:12px 0 2px;font-size:14px"><input type="checkbox" id="srcs" ${sourcesOn() ? "checked" : ""}> Quellen anzeigen (Google-Suche, verlinkt) – lässt sich im Chat jederzeit ein- und ausschalten</label>` : ""}
  <div class="acset"><label class="lbl">Automatische Korrektur beim Schreiben</label><div class="seg" id="ac-m"><button data-v="suggest" class="${(p.autoCorrect || "suggest") === "suggest" ? "on" : ""}">Unterstreichen</button><button data-v="auto" class="${p.autoCorrect === "auto" ? "on" : ""}">Automatisch</button><button data-v="off" class="${p.autoCorrect === "off" ? "on" : ""}">Aus</button></div>
  ${serverAI ? `<label class="lbl">Modell für die Korrektur</label><select class="field" id="ac-s">${autoModelList().map(([id, n, d, pv]) => `<option value="${id}" ${autoModelId() === id ? "selected" : ""}>${pv} ${n} – ${d}</option>`).join("")}</select><p class="note">Groq-Modelle sind besonders schnell. Dafür in Vercel den Key <code>GROQ_API_KEY</code> setzen (kostenlos auf console.groq.com).</p>` : ""}</div>
  <details class="msh" ${serverAI ? "" : "open"}><summary>Einrichtung: kostenlose Studix AI mit Google Gemini</summary><ol>
    <li>Auf <b>aistudio.google.com/apikey</b> einen API-Key erstellen (kostenloser Tarif).</li>
    <li>In Vercel: Projekt → <b>Settings → Environment Variables</b> → Name <code>GEMINI_API_KEY</code>, Wert = dein Key (Environment: Production).</li>
    <li>Optional <code>GEMINI_MODEL</code> setzen. Standard ist <code>gemini-flash-lite-latest</code> (Google-Alias, fällt bei abgeschalteten Modellen automatisch auf Ersatz zurück) (günstigstes Modell mit kostenlosem Kontingent).</li>
    <li>Danach <b>Deployments → Redeploy</b>. Der Key bleibt auf dem Server und gelangt nie in den Browser.</li></ol></details>
  <details class="msh"><summary>Erweitert: eigenen Anthropic-API-Key nutzen</summary><p class="note">Nur nötig, wenn die Server-KI nicht aktiv ist. Der Key wird nur in diesem Browser gespeichert.</p><label class="lbl">API-Key</label><input class="field" id="sk" type="password" placeholder="sk-ant-…" value="${esc(p.apiKey)}" autocomplete="off"><label class="lbl">Modell</label><input class="field" id="sm" value="${esc(p.model)}"></details></div>
  </div><div class="setsec" data-s="acc">
  ${cloudPanelHtml()}
  </div><div class="setsec" data-s="pro">${plusPanelHtml()}<aside class="proemb" id="pro-emb">${proEmbIdle()}</aside>
  </div><div class="setsec" data-s="con">
  ${applePanelHtml()}
  </div><div class="setsec" data-s="dat">
  <div class="panel"><h2>Daten</h2><p class="note">Alles liegt lokal auf diesem Gerät (IndexedDB) und funktioniert offline. Erstelle regelmäßig ein Backup – z. B. um auf Handy, iPad und PC dieselben Daten zu nutzen.</p><div class="row"><button class="btn ghost" id="ex">${ic("download")}Backup exportieren</button><button class="btn ghost" id="im">${ic("upload")}Backup importieren</button><input type="file" id="imf" accept="application/json" hidden><button class="btn ghost danger" id="rs">${ic("trash")}Alles löschen</button></div></div>
  </div>
  <div class="savestat" id="savestat" aria-live="polite"></div></div></div>`;
  $$(".kv-edit", m).forEach(b => b.onclick = () => { const c = b.closest(".kvcard"), on = c.classList.toggle("editing"); b.classList.toggle("on", on); b.innerHTML = ic(on ? "check" : "pen"); b.title = on ? "Fertig" : "Bearbeiten"; if (on) c.querySelector("input.field,select.field")?.focus(); });
  $$("#avsw button", m).forEach(b => b.onclick = () => { D.profile.avColor = b.dataset.c; save(); $$("#avsw button", m).forEach(x => x.classList.toggle("on", x === b)); $$(".av-xl,.prof .av", document).forEach(e => e.style.background = b.dataset.c); });
  try { codeCardBind(m); } catch {}
  $("#set-out", m) && ($("#set-out", m).onclick = () => cloudLogout()); $("#set-del", m) && ($("#set-del", m).onclick = () => accountDeleteModal());
  $$("#sl button", m).forEach(b => b.onclick = () => { $$("#sl button", m).forEach(x => x.classList.toggle("on", x === b)); });
  $("#ex", m).onclick = exportAll; $("#im", m).onclick = () => $("#imf", m).click(); $("#imf", m).onchange = e => e.target.files[0] && importAll(e.target.files[0]);
  $("#rs", m).onclick = async () => { if (await confirmBox("Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.", "Alles löschen")) { indexedDB.deleteDatabase("lumi"); localStorage.clear(); setTimeout(() => location.hash = "#/", 100); setTimeout(() => location.reload(), 300); } };
  bindApplePanel(m); cloudBindPanel(m); plusBindPanel(m);
  const SETN = { gen: "Profil", ai: "Studix AI", acc: "Konto & Cloud", pro: "Studix Study Pro", con: "Verbindungen", dat: "Daten" };
  const showT = t => { window.__setTab = t; $(".setpage", m).dataset.t = t; $("#setcrumb", m).textContent = SETN[t] || ""; if (t === "pro" && CLOUD.user && typeof plusRefresh === "function") plusRefresh(m, true).then(() => typeof plusAuto === "function" && plusAuto()); $$("#side [data-st]").forEach(b => b.classList.toggle("on", b.dataset.st === t)); $$(".settabs button[data-s]", m).forEach(b => b.classList.toggle("on", b.dataset.s === t)); $$(".setsec", m).forEach(x => x.classList.toggle("on", x.dataset.s === t)); };
  $$(".settabs button[data-s]", m).forEach(b => b.onclick = () => showT(b.dataset.s)); $("#sc", m)?.addEventListener("change", e => { p.country = e.target.value; p.scale = obScaleFor(p.country); save(); try { proApply(); } catch {} const hh = $("#sch", m); if (hh) hh.textContent = priceHint(p.country) ? "Studix Study Pro: " + priceHint(p.country) : ""; const bn = $(".probanner", m); if (bn) { bn.replaceWith(Object.assign(document.createElement("div"), { innerHTML: proBannerHtml() }).firstElementChild); $("#pro-go", m)?.addEventListener("click", () => showT("pro")); } const pp = $(".propanel", m); if (pp) { pp.replaceWith(Object.assign(document.createElement("div"), { innerHTML: plusPanelHtml() }).firstElementChild); plusBindPanel(m); } toast("Region gespeichert"); });
  aiuBlockFill(m); if (CLOUD.user) aiuLoad().then(() => aiuBlockFill(m));
  window.__showSetTab = showT; showT(window.__setTab || "gen"); $("#pro-go", m)?.addEventListener("click", () => showT("pro"));
  $("#theme-tg", m)?.addEventListener("click", e => themeToggle(e.currentTarget)); $("#pf-auth", m)?.addEventListener("click", () => CLOUD.user ? cloudLogout() : (typeof authScreen === "function" ? authScreen("in") : cloudLoginModal()));

  $("#srcs", m)?.addEventListener("change", e => { p.sources = e.target.checked; save(); });
  $("#hed-open", m)?.addEventListener("click", () => homeEditor());
  $$("#ac-m button", m).forEach(b => b.onclick = () => { p.autoCorrect = b.dataset.v; save(); $$("#ac-m button", m).forEach(x => x.classList.toggle("on", x === b)); });
  $("#ac-s", m) && ($("#ac-s", m).onchange = e => { p.autoModel = e.target.value; save(); });
  /* Automatisch speichern: beim Tippen (verzögert) und beim Ändern – mit kleiner Rückmeldung statt Speichern-Button */
  let svT = null; const stat = t => { const e = $("#savestat", m); if (!e) return; e.textContent = t; e.classList.toggle("on", !!t); };
  const commit = () => { p.name = $("#sn", m).value.trim(); [["sph", "phone"], ["sbd", "birthday"], ["sci", "city"], ["ssc", "school"], ["scl", "course"]].forEach(([id, k]) => { const e = $("#" + id, m); if (e) p[k] = e.value.trim(); }); p.level = $("#sl .on", m)?.dataset.l || p.level; p.apiKey = $("#sk", m).value.trim(); p.model = $("#sm", m).value.trim() || "claude-sonnet-5-5"; save(); refreshNav(); stat("Gespeichert ✓"); clearTimeout(svT); svT = setTimeout(() => stat(""), 1800); };
  const later = () => { stat("Speichert …"); clearTimeout(svT); svT = setTimeout(commit, 600); };
  ["#sn", "#sk", "#sm", "#sph", "#sci", "#ssc", "#scl"].forEach(id => $(id, m)?.addEventListener("input", later)); ["#sn", "#sk", "#sm", "#sph", "#sbd", "#sci", "#ssc", "#scl"].forEach(id => $(id, m)?.addEventListener("change", () => { clearTimeout(svT); commit(); }));
  $$("#sl button", m).forEach(b => b.addEventListener("click", () => setTimeout(commit, 0)));
  LEAVE.push(() => { clearTimeout(svT); });
};


/* Platzhalter im Chat-Eingabefeld: tippt nacheinander verschiedene Beispiel-Fragen (nur solange das Feld leer und nicht fokussiert ist) */
const PH_LIST = ["Frag Studix AI etwas …", "Erkläre mir die Zellatmung …", "Erstelle 10 Karteikarten zu Mathe …", "Fasse mein letztes Dokument zusammen …", "Mach ein Quiz zu meiner nächsten Prüfung …", "Was soll ich heute zuerst lernen? …", "Erstelle einen Lernplan für diese Woche …", "Hilf mir bei dieser Aufgabe …"];
function phCycle(inp) {
  if (!inp || inp.dataset.ph) return; inp.dataset.ph = "1"; const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; let i = 0, tm;
  const idle = () => document.activeElement !== inp && !inp.value;
  const step = (txt, n, dir) => {
    if (!inp.isConnected) return;
    if (!idle()) { inp.placeholder = PH_LIST[0]; return void (tm = setTimeout(() => step(PH_LIST[i % PH_LIST.length], PH_LIST[i % PH_LIST.length].length, 0), 600)); }
    if (dir === 1) { n++; inp.placeholder = txt.slice(0, n) + "▏"; if (n < txt.length) tm = setTimeout(() => step(txt, n, 1), 38 + Math.random() * 30); else tm = setTimeout(() => { inp.placeholder = txt; tm = setTimeout(() => step(txt, n, -1), 2300); }, 120); }
    else if (dir === -1) { n -= 2; inp.placeholder = txt.slice(0, Math.max(0, n)) + "▏"; if (n > 0) tm = setTimeout(() => step(txt, n, -1), 16); else { i++; tm = setTimeout(() => { const nx = PH_LIST[i % PH_LIST.length]; step(nx, 0, 1); }, 260); } }
    else { tm = setTimeout(() => step(txt, txt.length, -1), 1200); }
  };
  if (reduce) { tm = setInterval(() => { if (!inp.isConnected) return clearInterval(tm); if (idle()) inp.placeholder = PH_LIST[++i % PH_LIST.length]; }, 4000); return; }
  tm = setTimeout(() => step(PH_LIST[0], PH_LIST[0].length, -1), 2500);
}

/* Aufgabe abhaken – wiederkehrende Aufgaben erzeugen automatisch den nächsten Termin */
function completeTask(x, done = true) {
  x.done = done; if (done) { x.progress = 100; x.doneAt = Date.now(); } else { x.doneAt = undefined; }
  if (done && x.repeat && !x.spawned) {
    const base = x.due ? parseISO(x.due) : new Date(), step = d => { const n = new Date(d); if (x.repeat === "daily") n.setDate(n.getDate() + 1); else if (x.repeat === "weekly") n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1); return n; };
    let nx = step(base), guard = 0; const today = parseISO(iso()); while (nx <= today && guard++ < 400) nx = step(nx);
    D.tasks.push({ ...x, id: uid(), done: false, progress: 0, doneAt: undefined, spawned: false, due: iso(nx) }); x.spawned = true; toast("Nächste Wiederholung: " + fmtD(iso(nx)));
  }
  save(); refreshNav();
}
