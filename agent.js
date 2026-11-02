"use strict";
/* Studix agent – the chat can run app functions. The model appends a <lumi-actions>[…]</lumi-actions> block; the app parses and executes it. */

const AGENT_RULES = `Du bist auch ein Assistent, der die App bedienen kann. Wenn der Nutzer etwas erstellen, ändern oder eintragen will, führe es aus: schreibe zuerst EINEN kurzen Satz auf Deutsch, was du tust, und hänge ans Ende genau einen Block mit JSON an:
<lumi-actions>[{"action":"...", ...}]</lumi-actions>
Wichtig: Kündige NIE an, etwas zu tun („ich füge hinzu“, „ich schreibe weiter“), ohne den <lumi-actions>-Block zu senden – sonst passiert nichts. Bei „weiter schreiben“ / „fortsetzen“ schreibst du den nächsten Teil selbst (passend zum Text des geöffneten Dokuments) und hängst ihn mit append_to_note (doc = geöffnete Notiz) an.
Verfügbare Aktionen (Felder in Klammern sind optional):
- create_note {title, content, (folder), (subject)} – neue Notiz; content ist Text, "- " für Listen, Leerzeile für Absätze; folder z. B. "Mathe" oder "Mathe/Analysis"
- append_to_note {doc, content} – Text an eine Notiz anhängen
- suggest_edits {edits:[{find, replace} oder {after, insert}]} – Änderungen am GERADE GEÖFFNETEN Notiztext als Vorschläge direkt im Dokument markieren (alt durchgestrichen, neu markiert, Nutzer übernimmt oder verwirft). find = EXAKTER kurzer Originaltext aus dem Dokument (ein Satz oder Absatzteil), replace = neuer Text ("" zum Löschen); after = Textstelle, hinter die insert eingefügt wird. Nutze das, wenn der Nutzer den Text verbessern, kürzen, korrigieren, übersetzen oder ergänzen will (nicht append_to_note). Nur möglich, wenn unten „Text des geöffneten Dokuments“ steht.
- format_doc {(font), (size), (align), (lineHeight), (design), (width), (scope:"all"|"headings"|"selection")} – Formatierung des GERADE GEÖFFNETEN Dokuments ändern, ohne den Text umzuschreiben. font: Standard, Arial, Verdana, Georgia, Times New Roman, Garamond, Trebuchet, Courier New, Schreibschrift. size in pt (6–96). align: left|center|right|justify. lineHeight 1–3 (1, 1.15, 1.5, 2). design: Standard, Klassisch, Modern, Hausarbeit, Kompakt, Schreibmaschine. width: Schmal, Normal, Breit, Volle Breite. scope "all" (Standard) = ganzes Dokument, "headings" = nur Überschriften. Mehrere Wünsche in EINER Aktion bündeln. Nur möglich, wenn unten „Text des geöffneten Dokuments“ steht.
- set_block {find, as:"h1"|"h2"|"h3"|"p"|"blockquote"} – einen Absatz des geöffneten Dokuments (find = sein Text oder Anfang davon) in eine Überschrift, ein Zitat oder normalen Text umwandeln
- rename_doc {doc, title} – Dokument umbenennen
- move_doc {doc, folder} – Dokument in Ordner verschieben ("" = Home)
- create_folder {name, (parent)} – neuen Ordner erstellen
- create_database {title, (template:"plan"|"exams"|"read"|"blank"), (columns:[{name, type:"text"|"num"|"date"|"select"|"check", (options:[...])}]), (rows:[{"Spaltenname":"Wert"}]), (folder)} – Datenbank (Tabelle/Board/Kalender) anlegen
- create_cards {deck, cards:[{q,a}], (subject)} – Karteikarten in einem Stapel (wird bei Bedarf erstellt)
- add_task {title, type:"task"|"hw"|"exam", due:"JJJJ-MM-TT", (subject), (note)} – Aufgabe, Hausaufgabe oder Prüfung/Test eintragen
- complete_task {task} – Aufgabe als erledigt markieren
- add_grade {subject, title, value, (weight)} – Note eintragen
- delete_doc {doc} – Dokument löschen (der Nutzer muss bestätigen)
- search_docs {query} – LESEN: durchsucht Titel und Inhalt ALLER Dokumente und liefert Treffer mit Ausschnitt. Nutze es, wenn der Nutzer ein Dokument sucht oder die Liste unten nicht reicht.
- read_doc {doc, (from)} – LESEN: liefert den Text eines Dokuments (ab Zeichen "from", höchstens 6000). Nutze es, bevor du über Inhalt antwortest, den du nicht siehst.
- open {view:"today"|"docs"|"cards"|"quiz"|"planner"|"grades"|"focus"|"settings"|"search"} oder {doc} – Bereich oder Dokument öffnen
LESEN-Aktionen (search_docs, read_doc) sendest du ALLEIN im Block, ohne Text davor und ohne andere Aktionen; die App liefert dir das Ergebnis, danach antwortest du richtig. Maximal 3 Leseschritte. Steht unten „Automatisch gefunden“, nutze diesen Text sofort und antworte direkt – kündige nichts an. Die Liste unten enthält alle Dokumente (Titel nach Ordner) – ohne Inhalt, spare Tokens: lies nur, was nötig ist.
"doc", "task", "deck" und "subject" gibst du mit der ID oder dem Titel aus der Liste unten an. Rechne relative Datumsangaben („nächsten Freitag“) anhand von „Heute“ in ein echtes Datum um. Erfinde keine Dokumente, die nicht in der Liste stehen. Neu erstellte Notizen, Datenbanken und Kartenstapel öffnet die App automatisch. Schreibe Notizen vollständig und gut strukturiert in content mit dieser Syntax: "# " / "## " / "### " für Überschriften, "- " für Listen, "1. " für nummerierte Listen, "> " für Zitate, **fett**, *kursiv*, Tabellen mit | Spalte | Spalte | (erste Zeile = Kopf), Leerzeile zwischen Absätzen. Für Schrift, Grösse, Ausrichtung, Zeilenabstand, Design oder Seitenbreite nutze format_doc statt den Text neu zu schreiben. "Aktuell geöffnet" in der Liste ist das Dokument, auf das sich „dieses Dokument“ bezieht. Wenn nur eine Frage gestellt wird, antworte normal ohne Block. Frage kurz nach, wenn eine wichtige Angabe fehlt (z. B. das Datum einer Prüfung).`;

function agentContext() {
  const path = f => folderPath(f).map(x => x.name).join("/");
  const L = (t, a) => a.length ? `${t}:\n${a.join("\n")}\n` : "";
  const cur = (location.hash.match(/#\/app\/doc\/([^/]+)/) || [])[1], cd = cur && D.docs.find(x => x.id === cur);
  const edTxt = cd && window.__lumiEd ? (window.__lumiFmt ? `Format: ${window.__lumiFmt.state()}\n` : "") + `Text des geöffneten Dokuments (für suggest_edits):\n"""\n${window.__lumiEd.text().slice(0, 7000)}\n"""\n` : "";
  /* alle Dokumente, nach Ordner gruppiert: "Ordner: [id] Titel; [id] Titel" – ohne Inhalt, damit wenige Tokens anfallen */
  const groups = new Map();
  [...D.docs].sort((a, b) => b.updated - a.updated).slice(0, 400).forEach(d => { const k = d.folderId ? path(d.folderId) : "Home"; (groups.get(k) || groups.set(k, []).get(k)).push(`[${d.id}] ${String(d.title || "Ohne Titel").slice(0, 45)}${d.type && d.type !== "note" ? " (" + d.type + ")" : ""}`); });
  return (cd ? `Aktuell geöffnet: [${cd.id}] ${cd.title}\n` : "") + edTxt + `Heute: ${iso()} (${new Date().toLocaleDateString("de-CH", { weekday: "long" })})\n` +
    `Notenskala: ${SC().n}${gradeKey() === "ch" ? " (Schweiz: 4 = genügend, Dezimalpunkt)" : gradeKey() === "de" || gradeKey() === "at" ? " (1 = beste Note, bis 4 genügend, Dezimalpunkt)" : ""}\n` +
    L("Fächer", D.subjects.map(s => `- ${s.name}`)) +
    L("Ordner", D.folders.slice(0, 60).map(f => `- ${path(f.id)}`)) +
    L(`Dokumente (${D.docs.length})`, [...groups].map(([k, v]) => `${k}: ${v.join("; ")}`)) +
    L("Kartenstapel", D.decks.slice(0, 30).map(k => `- [${k.id}] ${k.title} (${k.cards.length} Karten)`)) +
    L("Offene Aufgaben", D.tasks.filter(t => !t.done).slice(0, 30).map(t => `- [${t.id}] ${t.title}${t.type === "exam" ? " (Prüfung)" : ""}${t.due ? " bis " + t.due : ""}`));
}

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
function pick(list, key, ref, title = x => x.title) { ref = norm(ref); if (!ref) return null; return list.find(x => x.id === ref || norm(x[key]) === ref) || list.find(x => norm(title(x)) === ref) || list.find(x => norm(title(x)).includes(ref)) || list.find(x => ref.includes(norm(title(x))) && norm(title(x)).length > 3) || null; }
const findDoc = r => pick(D.docs, "id", r), findSubject = r => { r = norm(r); return r ? D.subjects.find(s => norm(s.name) === r) || D.subjects.find(s => norm(s.name).includes(r) || r.includes(norm(s.name))) || null : null; };
function ensureFolderPath(p) {
  const parts = String(p || "").split("/").map(x => x.trim()).filter(Boolean); let parent = "";
  for (const name of parts) {
    let f = D.folders.find(x => norm(x.name) === norm(name) && (x.parent || "") === parent);
    if (!f) { const sub = !parent && findSubject(name); f = { id: uid(), name, parent, color: sub?.color || COLORS[D.folders.length % COLORS.length], subjectId: sub?.id || "" }; D.folders.push(f); }
    parent = f.id;
  }
  return parent;
}

const ACTIONS = {
  async create_note(a) { const fid = ensureFolderPath(a.folder), sid = findSubject(a.subject)?.id || subjectOfFolder(fid), html = textToHtml(String(a.content || "")), id = uid(); D.docs.unshift({ id, type: "note", title: String(a.title || "Neue Notiz").slice(0, 120), subjectId: sid || "", folderId: fid, paper: D.profile.paper || "white", updated: Date.now(), created: Date.now(), text: htmlToText(html) }); await KV.set("html:" + id, html); window.__aiReveal = id; return { label: `Notiz „${D.docs[0].title}“ erstellt`, go: "doc/" + id, open: true }; },
  async suggest_edits(a) { const ed = window.__lumiEd; if (!ed) throw "Öffne zuerst eine Notiz, damit ich Änderungen vorschlagen kann"; const r = ed.suggest(Array.isArray(a.edits) ? a.edits : []); if (!r.applied) throw "Die Textstelle wurde im Dokument nicht gefunden"; return { label: `${r.applied} ${r.applied === 1 ? "Änderung" : "Änderungen"} im Text vorgeschlagen${r.missed ? " (" + r.missed + " nicht gefunden)" : ""}` }; },
  async append_to_note(a) { const d = findDoc(a.doc); if (!d || d.type !== "note") throw "Notiz nicht gefunden"; if (window.__lumiEd && location.hash.includes("/doc/" + d.id)) { if (!window.__lumiEd.suggestAppend(String(a.content || ""), (window.lastAiSources || []).slice())) throw "Kein Text zum Anhängen"; return { label: `Text am Ende von „${d.title}“ als Vorschlag eingefügt` }; } const h = ((await KV.get("html:" + d.id)) || "") + textToHtml(String(a.content || "")); await KV.set("html:" + d.id, h); d.text = htmlToText(h); d.updated = Date.now(); return { label: `Text zu „${d.title}“ hinzugefügt`, go: "doc/" + d.id }; },
  async format_doc(a) { const f = window.__lumiFmt; if (!f) throw "Öffne zuerst eine Notiz, damit ich sie formatieren kann"; const r = f.apply(a); if (!r.done.length) throw r.bad[0] || "Nichts zu formatieren"; return { label: "Formatiert: " + r.done.join(", ") + (r.bad.length ? " (" + r.bad.join("; ") + ")" : "") + " – Strg+Z macht es rückgängig" }; },
  async set_block(a) { const f = window.__lumiFmt; if (!f) throw "Öffne zuerst eine Notiz"; if (!f.setBlock(a.find, a.as)) throw "Absatz nicht gefunden"; return { label: "Absatz als " + ({ h1: "Überschrift 1", h2: "Überschrift 2", h3: "Überschrift 3", p: "Normaltext", blockquote: "Zitat" }[a.as] || a.as) + " formatiert" }; },
  async rename_doc(a) { const d = findDoc(a.doc); if (!d || !String(a.title || "").trim()) throw "Dokument nicht gefunden"; const old = d.title; d.title = String(a.title).trim().slice(0, 120); d.updated = Date.now(); return { label: `„${old}“ umbenannt in „${d.title}“`, go: "doc/" + d.id }; },
  async move_doc(a) { const d = findDoc(a.doc); if (!d) throw "Dokument nicht gefunden"; d.folderId = ensureFolderPath(a.folder); d.subjectId = subjectOfFolder(d.folderId) || d.subjectId; d.updated = Date.now(); return { label: `„${d.title}“ verschoben nach ${["Home", ...folderPath(d.folderId).map(f => f.name)].join(" / ")}`, go: "docs/" + d.folderId }; },
  async create_folder(a) { const fid = ensureFolderPath((a.parent ? a.parent + "/" : "") + (a.name || "")); if (!fid) throw "Kein Name"; return { label: `Ordner „${D.folders.find(f => f.id === fid).name}“ erstellt`, go: "docs/" + fid }; },
  async create_cards(a) {
    const cards = (a.cards || []).filter(c => c && c.q && c.a); if (!cards.length) throw "Keine Karten";
    let k = pick(D.decks, "id", a.deck); if (!k) { k = { id: uid(), title: String(a.deck || "Neuer Stapel").slice(0, 80), subjectId: findSubject(a.subject)?.id || "", cards: [] }; D.decks.unshift(k); }
    cards.forEach(c => k.cards.push({ id: uid(), q: String(c.q), a: String(c.a), box: 0, due: iso() })); return { label: `${cards.length} Karten in „${k.title}“`, go: "cards/" + k.id, open: true };
  },
  async create_database(a) {
    const kinds = ["plan", "exams", "read", "blank"], tpl = DB_TPL[kinds.includes(a.template) ? a.template : "blank"](), fid = ensureFolderPath(a.folder), id = uid();
    if (Array.isArray(a.columns) && a.columns.length) tpl.cols = a.columns.slice(0, 10).map((c, i) => ({ id: "c" + (i + 1), name: String(c.name || "Spalte " + (i + 1)).slice(0, 40), type: ["text", "num", "date", "select", "check"].includes(c.type) ? c.type : "text", ...(c.type === "select" ? { opts: (c.options || []).map((n, j) => ({ n: String(n), c: j % 8 })) } : {}) }));
    if (tpl.view === "board" && !tpl.cols.some(c => c.id === tpl.group && c.type === "select")) { tpl.view = "table"; delete tpl.group; }
    if (Array.isArray(a.rows)) tpl.rows = a.rows.slice(0, 40).map(r => ({ id: uid(), v: Object.fromEntries(tpl.cols.map(c => { let x = r?.[c.name]; if (x === undefined || x === null) return [c.id, undefined]; if (c.type === "select") { x = String(x); c.opts ||= []; if (!c.opts.some(o => o.n === x)) c.opts.push({ n: x, c: c.opts.length % 8 }); } else if (c.type === "num") x = +x || 0; else if (c.type === "check") x = !!x; else x = String(x); return [c.id, x]; }).filter(e => e[1] !== undefined)) }));
    D.docs.unshift({ id, type: "db", title: String(a.title || "Neue Datenbank").slice(0, 100), subjectId: subjectOfFolder(fid) || "", folderId: fid, updated: Date.now(), created: Date.now(), text: "" }); await KV.set("db:" + id, tpl);
    window.__aiReveal = id; return { label: `Datenbank „${D.docs[0].title}“ erstellt`, go: "doc/" + id, open: true };
  },
  async add_task(a) { if (!String(a.title || "").trim()) throw "Kein Titel"; const due = /^\d{4}-\d{2}-\d{2}$/.test(a.due || "") ? a.due : ""; const t = { id: uid(), title: String(a.title).trim().slice(0, 140), type: ["task", "hw", "exam"].includes(a.type) ? a.type : "task", due, subjectId: findSubject(a.subject)?.id || "", note: String(a.note || "").slice(0, 500), done: false, source: "ki" }; D.tasks.push(t); return { label: `${t.type === "exam" ? "Prüfung" : "Aufgabe"} „${t.title}“${due ? " am " + fmtD(due) : ""} eingetragen`, go: "planner" }; },
  async complete_task(a) { const t = pick(D.tasks.filter(x => !x.done), "id", a.task); if (!t) throw "Aufgabe nicht gefunden"; t.done = true; t.doneAt = Date.now(); return { label: `„${t.title}“ erledigt`, go: "planner" }; },
  async add_grade(a) { const s = findSubject(a.subject), v = parseFloat(String(a.value).replace(",", ".")); if (isNaN(v) || v < SC().min || v > SC().max) throw `Ungültige Note (erlaubt: ${SC().min}–${SC().max})`; D.grades.push({ id: uid(), subjectId: s?.id || "", title: String(a.title || "Note").slice(0, 80), value: v, weight: parseFloat(a.weight) || 1, date: iso() }); return { label: `Note ${v}${s ? " in " + s.name : ""} eingetragen`, go: "grades" }; },
  async delete_doc(a) { const d = findDoc(a.doc); if (!d) throw "Dokument nicht gefunden"; if (!(await confirmBox(`„${d.title}“ wirklich löschen?`, "Löschen"))) return { label: "Löschen abgebrochen" }; await deleteDoc(d); return { label: `„${d.title}“ gelöscht` }; },
  async open(a) { if (a.doc) { const d = findDoc(a.doc); if (!d) throw "Dokument nicht gefunden"; return { label: `„${d.title}“ öffnen`, go: (d.type === "draw" ? "draw/" : "doc/") + d.id }; } const v = String(a.view || ""); if (!V[v]) throw "Bereich unbekannt"; return { label: "Öffnen: " + (NAVS.find(n => n[0] === v)?.[1] || v), go: v }; },
};

/* Lese-Werkzeuge: liefern der KI Daten zurück (kein Eintrag in der Oberfläche) */
const LOOKUPS = {
  async search_docs(a) {
    const q = norm(a.query), words = q.split(" ").filter(w => w.length > 1); if (!words.length) return "Keine Suchbegriffe.";
    const hits = [];
    for (const d of D.docs) {
      if (d.type === "draw") continue; const title = norm(d.title); let txt = ""; try { txt = await docText(d); } catch {}
      const low = norm(txt), sc = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (low.includes(w) ? 1 : 0), 0); if (!sc) continue;
      const i = Math.max(0, low.indexOf(words.find(w => low.includes(w)) || "")); hits.push([sc, `[${d.id}] ${d.title}${txt ? " – …" + txt.replace(/\s+/g, " ").slice(Math.max(0, i - 40), i + 140) + "…" : ""}`]);
    }
    return hits.sort((x, y) => y[0] - x[0]).slice(0, 6).map(h => h[1]).join("\n") || "Keine Treffer.";
  },
  async read_doc(a) {
    const d = findDoc(a.doc); if (!d) return "Dokument nicht gefunden."; const t = (await docText(d)).replace(/\n{3,}/g, "\n\n"), from = Math.max(0, +a.from || 0);
    return `„${d.title}“ (${t.length} Zeichen)\n` + (t.slice(from, from + 6000) || "(leer)") + (t.length > from + 6000 ? `\n… weiter mit from=${from + 6000}` : "");
  },
};
let lastAsk = null;
/* Vorab-Suche ohne KI-Aufruf: passt ein Dokumenttitel (oder Ordnername) zur Anfrage, bekommt die KI den Text gleich mitgeliefert – nichts muss „vorgelesen“ werden */
const STOP = new Set("fasse fass zusammen zusammenfassung mir mein meine meinen meiner meinem das den der die dem des ein eine einen und oder von vom für über ueber mit zum zur aus bitte kannst kanst kannst du ich mal noch dazu dieses diese diesem dokument datei notiz erkläre erklaere erklär lies lese lesen suche such finde öffne oeffne zeige zeig mach mache erstelle schreibe schreib was wie warum wann welche welcher alle aktuell aktuelle aktuellen neueste letzte letzten".split(" "));
async function agentPrefetch(text) {
  const words = [...new Set(norm(text).replace(/[^a-zäöüß0-9 ]/g, " ").split(" ").filter(w => w.length >= 3 && !STOP.has(w)))].map(w => w.length > 6 ? w.slice(0, 5) : w);
  if (!words.length) return "";
  const path = f => folderPath(f).map(x => x.name).join(" ");
  const sc = D.docs.filter(d => d.type !== "draw").map(d => { const t = norm(d.title + " " + (d.folderId ? path(d.folderId) : "")); return [words.filter(w => t.includes(w)).length + (words.every(w => t.includes(w)) ? 1 : 0), d]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0] || b[1].updated - a[1].updated);
  if (!sc.length) return "";
  const top = sc[0][1]; let body = ""; try { body = (await docText(top)).replace(/\n{3,}/g, "\n\n").slice(0, 6000); } catch {}
  const more = sc.slice(1, 4).map(x => `[${x[1].id}] ${x[1].title}`);
  return `\nAutomatisch gefunden (passt zur Anfrage): [${top.id}] ${top.title}${more.length ? "\nWeitere mögliche: " + more.join("; ") : ""}\nText von „${top.title}“:\n"""\n${body || "(leer oder keine Textvorschau)"}\n"""\nNutze diesen Text direkt für die Antwort. Sag NIE „ich lese gleich“ – lies nicht vor, antworte sofort.\n`;
}
/* ai() mit gemerkter Anfrage, damit Lese-Schritte die Unterhaltung fortsetzen können */
function agentAi(prompt, opts) { lastAsk = { prompt, opts }; return ai(prompt, opts); }

/* returns {text, acts} – text without the action block; acts = [{label, go?, err?}] */
async function runAgent(reply, opt = {}, depth = 0) {
  const m = String(reply || "").match(/<lumi-actions>([\s\S]*?)<\/lumi-actions>/i);
  const text = String(reply || "").replace(/<lumi-actions>[\s\S]*?(<\/lumi-actions>|$)/i, "").trim();
  if (!m) {
    /* Die KI kündigt Lesen an, sendet aber keinen Block → automatisch suchen und weiterfragen */
    if (lastAsk && depth < 2 && /\b(ich lese|lese ich|ich schaue|schaue ich|ich sehe .{0,30}nach|ich durchsuche|ich öffne|ich suche|ich prüfe)\b/i.test(text)) {
      const q = lastAsk.prompt, pre = await agentPrefetch(q), found = pre || await LOOKUPS.search_docs({ query: norm(q).replace(/[^a-zäöüß0-9 ]/g, " ").split(" ").filter(w => w.length >= 3 && !STOP.has(w)).join(" ") });
      const ask = { prompt: "Ergebnis der Suche:\n" + found + "\n\nAntworte jetzt direkt auf die Anfrage: " + q, opts: { ...lastAsk.opts, sources: false, image: null } };
      lastAsk = ask; const r2 = await ai(ask.prompt, ask.opts); if (r2) return runAgent(r2, opt, depth + 1);
    }
    return { text, acts: [] };
  }
  let list; try { list = JSON.parse(m[1].trim().replace(/^```(json)?|```$/g, "")); } catch { return { text: text + "\n\n(Die Aktion konnte nicht gelesen werden.)", acts: [] }; }
  const arr = Array.isArray(list) ? list : [list], reads = arr.filter(a => LOOKUPS[a?.action]);
  if (reads.length && lastAsk && depth < 3) {
    const out = []; for (const a of reads.slice(0, 3)) { try { out.push(`${a.action}: ${await LOOKUPS[a.action](a)}`); } catch (e) { out.push(`${a.action}: Fehler`); } }
    const { prompt, opts } = lastAsk, ask = { prompt: "Ergebnis deiner Leseaktion(en):\n" + out.join("\n\n") + "\n\nAntworte jetzt dem Nutzer (und führe nötige Aktionen aus).", opts: { ...opts, sources: false, image: null, history: [...(opts.history || []), { role: "user", text: prompt }, { role: "assistant", text: String(reply).slice(0, 600) }] } };
    lastAsk = ask; const r2 = await ai(ask.prompt, ask.opts); if (!r2) return { text: "Das hat leider nicht geklappt. Versuche es bitte noch einmal.", acts: [] };
    return runAgent(r2, opt, depth + 1);
  }
  const acts = [];
  for (const a of arr.filter(a => !LOOKUPS[a?.action]).slice(0, 12)) {
    try { const fn = ACTIONS[a?.action]; if (!fn) throw "Unbekannte Aktion"; acts.push(await fn(a)); }
    catch (e) { acts.push({ label: String(e?.message || e), err: true }); }
  }
  save(); refreshNav();
  const op = [...acts].reverse().find(x => x.open && x.go);
  if (op && !opt.stay) setTimeout(() => go(op.go), 700); else if (op) {} else if (["docs", "planner", "cards", "grades"].includes(curView)) renderView();
  return { text: text || "Erledigt.", acts };
}


/* ---------- AI everywhere: command bar (Strg/Cmd + Umschalt + K, "Neu" menus, document bars) ---------- */
async function agentAsk(text) {
  const pre = await agentPrefetch(text), r = await agentAi(text, { system: sysBase(AGENT_RULES + "\n\nAktueller Stand der App:\n" + agentContext() + pre), max: 2000, quiet: true });
  if (!r) return null; return runAgent(r);
}
function openAiCommand(prefill = "") {
  document.getElementById("aicmd")?.remove();
  const el = document.createElement("div"); el.id = "aicmd";
  const SUG = ["Erstelle eine Notiz zur Zellatmung", "Erstelle einen Lernplan für die nächste Woche als Datenbank", "Trage morgen einen Vokabeltest ein", "Erstelle 10 Karteikarten zu diesem Dokument"];
  el.innerHTML = `<div class="aic-bg"></div><div class="aic-box" role="dialog" aria-label="Studix AI"><form class="aic-in">${ic("spark")}<input id="aic-i" autocomplete="off" placeholder="Was soll Studix AI für dich tun? z. B. „Erstelle eine Notiz zu …“" value="${esc(prefill)}"><button class="send" aria-label="Senden">${ic("up")}</button></form><div class="aic-sug">${SUG.map(x => `<button type="button">${esc(x)}</button>`).join("")}</div><div class="aic-out" hidden></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("on"));
  const close = () => { el.classList.remove("on"); setTimeout(() => el.remove(), 250); document.removeEventListener("keydown", kd); }, kd = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", kd); $(".aic-bg", el).onclick = close; const inp = $("#aic-i", el), out = $(".aic-out", el);
  setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 60);
  $$(".aic-sug button", el).forEach(b => b.onclick = () => { inp.value = b.textContent; $(".aic-in", el).requestSubmit(); });
  $(".aic-in", el).onsubmit = async e => {
    e.preventDefault(); const q = inp.value.trim(); if (!q) return;
    if (!hasKey()) { out.hidden = false; out.innerHTML = `<p class="note">Studix AI ist noch nicht eingerichtet – siehe Einstellungen → Studix AI.</p>`; return; }
    $(".aic-sug", el).hidden = true; out.hidden = false; out.innerHTML = `<div class="aic-think">${ic("spark")}<span>Studix AI schreibt …</span></div>`;
    const r = await agentAsk(q);
    if (!r) { out.innerHTML = `<p class="note">Das hat leider nicht geklappt. Versuche es bitte noch einmal.</p>`; return; }
    out.innerHTML = `<p>${streamHtml(r.text)}</p>${r.acts.length ? `<div class="acts" style="--base:${streamMs(r.text)}ms">${r.acts.map(a => `<${a.go ? "button" : "span"} class="act ${a.err ? "err" : ""}" ${a.go ? `data-ag="${esc(a.go)}"` : ""}>${ic(a.err ? "x" : /^doc\//.test(a.go || "") ? "note" : "check")}<span>${esc(a.label)}</span></${a.go ? "button" : "span"}>`).join("")}</div>` : ""}`;
    $$("[data-ag]", out).forEach(b => b.onclick = () => { close(); go(b.dataset.ag); });
    if (r.acts.some(a => a.open)) setTimeout(close, 900);
  };
}
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k" && document.getElementById("app") && !document.getElementById("app").hidden) { e.preventDefault(); openAiCommand(); } });

/* Wort-für-Wort-Einblendung: Aufzählungspunkte erscheinen erst, wenn der Text der Zeile da ist; streamMs = Gesamtdauer (für die Box darunter) */
const streamStep = text => Math.min(34, 2400 / Math.max(1, String(text || "").split(/\s+/).filter(Boolean).length));
const streamMs = text => Math.round(String(text || "").split(/\s+/).filter(Boolean).length * streamStep(text)) + 380;
function streamHtml(text) {
  const step = streamStep(text); let n = 0;
  return String(text || "").split("\n").map(line => {
    const b = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/), body = b ? b[1] : line, num = b && /^\s*\d/.test(line) ? line.match(/\d+/)[0] + "." : "";
    const html = body.split(/(\s+)/).map(p => p.trim() ? `<span class="sw" style="animation-delay:${Math.round(n++ * step)}ms">${esc(p)}</span>` : esc(p)).join("");
    return b ? `<span class="sli"><i class="sb" style="animation-delay:${Math.round(n * step + 60)}ms">${num ? esc(num) : ""}</i>${html}</span>` : html + "<br>";
  }).join("").replace(/(<br>)+$/, "").replace(/<\/span><br>(?=<span class="sli")/g, "</span>");
}
function wordReveal(root, maxMs = 4800) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n; while ((n = w.nextNode())) if (n.nodeValue.trim() && !n.parentElement.closest("table,pre,input")) nodes.push(n);
  const total = nodes.reduce((a, t) => a + t.nodeValue.split(/\s+/).filter(Boolean).length, 0), step = Math.min(42, maxMs / Math.max(1, total)); let i = 0;
  nodes.forEach(t => { const f = document.createDocumentFragment(); t.nodeValue.split(/(\s+)/).forEach(p => { if (!p) return; if (!p.trim()) f.appendChild(document.createTextNode(p)); else { const sp = document.createElement("span"); sp.className = "sw"; sp.textContent = p; sp.style.animationDelay = Math.round(i++ * step) + "ms"; f.appendChild(sp); } }); t.replaceWith(f); });
  return Math.round(total * step) + 650;
}

/* ---------- Studix AI Seitenleiste (in Dokumenten ausklappbar) ---------- */
let aiSideTools = null;
function aiSideDoc() { const m = location.hash.match(/#\/app\/doc\/([^/?]+)/); return m ? D.docs.find(d => d.id === m[1]) : null; }
function aiSide(open, trigger) {
  let el = document.getElementById("aiside");
  if (open === undefined) open = !(el && el.classList.contains("on"));
  if (!el) {
    el = document.createElement("aside"); el.id = "aiside"; el.setAttribute("aria-label", "Studix AI");
    el.innerHTML = `<header><span class="as-l">${ic("spark")}<b>Studix AI</b></span><span class="as-r"><button class="icon-btn" id="as-x" aria-label="Schließen">${ic("x")}</button></span></header><div class="chatbox flat" id="as-box"></div>`;
    document.body.appendChild(el);
    $("#as-x", el).onclick = () => aiSide(false);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && el.classList.contains("on") && !document.querySelector(".mask,#aicmd")) aiSide(false); });
  }
  if (trigger) aiSideTools = trigger;
  $$("#ai-m,#aicb").forEach(b => { b.classList.toggle("on", open); const sv = b.querySelector("svg"); if (sv && b.id === "ai-m") { sv.outerHTML = ic(open ? "aipanelOn" : "aipanel"); b.querySelector("svg").classList.add("ic-flip"); } });
  if (open) {
    D.chats = D.chats || []; const d = aiSideDoc(); if (d) { let dc = D.chats.find(x => x.docId === d.id); if (!dc) { dc = { id: uid(), title: "Chat – " + d.title, docId: d.id, projectId: "", instr: "", msgs: [], updated: Date.now() }; D.chats.push(dc); save(); } window.__docChat = dc.id; } else window.__docChat = null; chatCtx.clear(); if (d && d.type !== "draw" && d.type !== "db") chatCtx.add(d.id);
    mountChat($("#as-box", el), false);
    el.classList.add("on"); document.body.classList.add("aiside-open");
    setTimeout(() => $(".tin", el)?.focus(), 350);
  } else { el.classList.remove("on"); document.body.classList.remove("aiside-open"); window.__docChat = null; }
}
/* Klick auf den AI-Knopf in Editoren/Dokumenten klappt die Seitenleiste aus (die alten Werkzeuge liegen hinter „…“) */
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#ai-m,#aicb"); if (!b || !document.getElementById("app") || document.getElementById("app").hidden) return;
  e.stopPropagation(); e.preventDefault(); aiSide(undefined, b);
}, true);
addEventListener("hashchange", () => { if (!/^#\/app\/(doc|docs|draw|board)(\/|$)/.test(location.hash)) aiSide(false); else { const el = document.getElementById("aiside"), d = aiSideDoc(); if (el && el.classList.contains("on")) { const cur = D.chats.find(x => x.id === window.__docChat); if (!d || !cur || cur.docId !== d.id) aiSide(true); } } });
