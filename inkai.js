"use strict";
/* Studix – KI-Popup im Zeichnen-Modus: Wer mit dem Lasso etwas Gezeichnetes oder Handgeschriebenes auswählt, bekommt – wie bei markiertem Text – ein Popup mit Studix AI:
   Handschrift in Text verwandeln · von der KI neu zeichnen lassen · Formen begradigen (offline) · Fehler prüfen · erklären · frei fragen.
   Die Auswahl wird als Bild an die KI geschickt (Vision); Ergebnisse ersetzen die Auswahl direkt (mit Rückgängig) oder erscheinen im Popup.
   Eingebunden über createInk(…, { ai: { insertText(text, box), … } }). */

function inkAIBind(ink, host) {
  const bar = document.createElement("div"); bar.className = "inkai"; bar.hidden = true; bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "Studix AI für die Auswahl"); document.body.appendChild(bar);
  let dead = false, token = 0, locked = false, raf = 0;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const inl = x => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const mini = t => String(t || "").split(/\n{2,}/).map(par => { const ls = par.split("\n").filter(l => l.trim()); if (!ls.length) return ""; return ls.every(l => /^\s*[-•*]\s+/.test(l)) ? `<ul>${ls.map(l => `<li>${inl(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("")}</ul>` : `<p>${ls.map(inl).join("<br>")}</p>`; }).join("");
  const SP = '<i class="ia-sp"></i>';
  const ACT = [["text", "Handschrift in Text", "text"], ["redraw", "Neu zeichnen", "spark"], ["neat", "Begradigen", "square"], ["check", "Fehler prüfen", "check"], ["explain", "Erklären", "bulb"]];

  /* ---------- Position: über der Auswahl, sonst darunter; folgt beim Scrollen ---------- */
  const place = () => {
    raf = 0; if (dead || bar.hidden) return; const r = ink.selRect(); if (!r) return hide();
    const w = bar.offsetWidth, h = bar.offsetHeight; let x = r.x + r.w / 2 - w / 2, y = r.y - h - 12;
    const nb = document.querySelector(".ned-bar"), top = Math.max(70, nb ? nb.getBoundingClientRect().bottom + 6 : 70);
    if (y < top) y = r.y + r.h + 12; if (y + h > innerHeight - 8) y = Math.max(top, innerHeight - h - 8);
    bar.style.left = clamp(x, 8, Math.max(8, innerWidth - w - 8)) + "px"; bar.style.top = Math.round(y) + "px";
  };
  const sched = () => { if (!raf) raf = requestAnimationFrame(place); };
  const show = html => { bar.innerHTML = html; try { if (typeof LPL !== "undefined" && LPL.tr) LPL.tr(bar); } catch {} bar.hidden = false; bar.classList.remove("hold"); place(); };
  const hide = () => { token++; bar.hidden = true; bar.innerHTML = ""; };
  addEventListener("scroll", sched, true); addEventListener("resize", sched);

  /* ---------- Ansichten ---------- */
  const idle = () => {
    show(`<div class="ia-chips">${ACT.map(([k, l, i]) => `<button type="button" data-a="${k}">${ic(i)}<span>${l}</span></button>`).join("")}</div>
      <form class="ia-ask">${ic("spark")}<input autocomplete="off" placeholder="Studix AI zur Auswahl fragen …" aria-label="Frage an Studix AI"><button class="send" type="submit" aria-label="Fragen">${ic("up")}</button></form>`);
    $$("[data-a]", bar).forEach(b => b.onclick = () => run(b.dataset.a));
    $(".ia-ask", bar).onsubmit = e => { e.preventDefault(); const q = $("input", bar).value.trim(); if (q) run("ask", q); };
  };
  const busy = msg => { show(`<div class="ia-busy">${SP}<span>${esc(msg)}</span><button type="button" class="ia-x" data-x>Abbrechen</button></div>`); $("[data-x]", bar).onclick = () => { token++; idle(); }; };
  const back = `<button type="button" class="ia-back" data-back>${ic("back")}<span>Zurück</span></button>`;
  const wireBack = () => $$("[data-back]", bar).forEach(b => b.onclick = idle);
  const fail = msg => { show(`<div class="ia-msg err">${esc(msg)}</div><div class="ia-btns">${back}</div>`); wireBack(); };
  const done = (msg, undo = true) => { show(`<div class="ia-msg ok">${ic("check")}<span>${esc(msg)}</span></div><div class="ia-btns">${undo ? `<button type="button" class="ia-b" data-undo>${ic("rot")}<span>Rückgängig</span></button>` : ""}${back}</div>`); $("[data-undo]", bar)?.addEventListener("click", () => { ink.undo(); hide(); }); wireBack(); };

  /* ---------- KI mit Bild der Auswahl ---------- */
  async function vision(prompt, max) {
    const im = ink.selImage(); if (!im) return { stale: true };
    if (typeof hasKey === "function" && !hasKey()) return { err: "Studix AI ist noch nicht eingerichtet (Einstellungen → Studix AI)." };
    const tok = ++token, sty = ink.selStyle();
    const r = await ai(prompt, { image: { data: im.data, type: "image/jpeg" }, max, quiet: true });
    if (tok !== token || dead) return { stale: true };
    if (r == null) return { err: (window.lastAiIssue && window.lastAiIssue.text) || "Studix AI hat nicht geantwortet. Bitte noch einmal versuchen." };
    return { text: String(r), im, sty };
  }
  const RL = () => `\nAntworte auf ${typeof schLang === "function" ? schLang() : "German"}.`;
  const P = {
    text: "Das Bild zeigt eine handgeschriebene Notiz eines Lernenden. Transkribiere die Handschrift möglichst exakt: Sprache beibehalten, Zeilenumbrüche beibehalten, nichts ergänzen oder erklären. Formeln in einfacher Textschreibweise (z. B. x^2, a/b, sqrt(x)). Antworte NUR mit dem Text. Wenn nichts Lesbares zu erkennen ist, antworte exakt: NICHTS",
    redraw: `Zeichne die Skizze im Bild sauber neu. Antworte NUR mit JSON, ohne Text davor oder danach, im Format:
{"items":[{"t":"line","x1":0,"y1":0,"x2":100,"y2":0},{"t":"arrow","x1":0,"y1":0,"x2":100,"y2":50},{"t":"rect","x1":10,"y1":10,"x2":300,"y2":200},{"t":"ellipse","x1":10,"y1":10,"x2":300,"y2":200},{"t":"tri","x1":10,"y1":10,"x2":300,"y2":200},{"t":"poly","closed":false,"pts":[[0,0],[50,40]]},{"t":"text","x":20,"y":30,"h":60,"s":"Beschriftung"}]}
Alle Koordinaten sind ganze Zahlen von 0 bis 1000, bezogen auf Breite (x) und Höhe (y) des Bildes; 0,0 ist oben links. rect, ellipse und tri werden durch die Begrenzungsbox beschrieben (x1,y1 oben links, x2,y2 unten rechts). Bei "text" ist x,y die obere linke Ecke und h die Texthöhe; übernimm Beschriftungen und Handschrift exakt als Text. Mache Geraden gerade, Kreise rund und Rechtecke rechtwinklig, Kurven als "poly" mit 12 bis 40 Punkten. Behalte Anordnung, Proportionen und alle Beschriftungen bei. Höchstens 80 Elemente.`,
    check: `Du bist eine freundliche, genaue Lehrperson. Prüfe die handschriftliche Arbeit im Bild auf fachliche Fehler: Rechnungen nachrechnen, Rechtschreibung, falsche Fakten, falsche Beschriftungen in Skizzen. Antworte NUR mit JSON: {"verdict":"ok","summary":"ein kurzer Satz","issues":[{"where":"wo genau","problem":"was ist falsch","fix":"so ist es richtig"}]}. verdict ist "ok" (alles stimmt, issues leer), "errors" (mindestens ein Fehler) oder "unclear" (nicht lesbar oder noch unfertig). Höchstens 6 Punkte, kurz und konkret. Rate nicht: nur Fehler nennen, die du sicher erkennst.`,
    explain: "Erkläre, was im Bild zu sehen ist (handschriftliche Notiz, Formel oder Skizze), einfach und anschaulich in höchstens 120 Wörtern. Ergänze ein kleines Beispiel, wenn es hilft."
  };

  const nmap = (items, im, sty) => {   // KI-Elemente (0–1000) → Striche in Dokument-Koordinaten
    const [x0, y0, x1, y1] = im.box, W = x1 - x0, H = y1 - y0, num = v => (isFinite(+v) ? clamp(+v, 0, 1000) : 0), X = v => x0 + num(v) / 1000 * W, Y = v => y0 + num(v) / 1000 * H, out = [], base = { color: sty.color, size: clamp(sty.size, 2, 8), pr: false };
    for (const it of (Array.isArray(items) ? items : []).slice(0, 80)) {
      const t = it && it.t;
      if (t === "line" || t === "arrow") { const a = [X(it.x1), Y(it.y1)], b = [X(it.x2), Y(it.y2)]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 3) out.push({ ...base, type: t, pts: [a, b] }); }
      else if (t === "rect" || t === "ellipse" || t === "tri") { const xa = X(Math.min(+it.x1, +it.x2)), ya = Y(Math.min(+it.y1, +it.y2)), xb = X(Math.max(+it.x1, +it.x2)), yb = Y(Math.max(+it.y1, +it.y2)); if (xb - xa > 3 && yb - ya > 3) out.push({ ...base, type: t, pts: [[xa, ya], [xb, yb]] }); }
      else if (t === "poly" && Array.isArray(it.pts) && it.pts.length > 1) { const pts = it.pts.slice(0, 80).map(q => [X(q[0]), Y(q[1]), .5, 0]); if (it.closed) pts.push([...pts[0]]); out.push({ ...base, type: "pen", br: "pen", k: .8, pts }); }
      else if (t === "text" && it.s) out.push(ink.makeText(String(it.s).slice(0, 200), X(it.x), Y(it.y), clamp((+it.h || 40) / 1000 * H * .85, 10, 60), sty.color));
    }
    return out;
  };

  /* ---------- Aktionen ---------- */
  async function run(kind, q) {
    if (kind === "neat") { const n = ink.neaten(); return n ? done(n === 1 ? "1 Form begradigt" : n + " Formen begradigt") : fail("Nichts zum Begradigen gefunden – es gibt keine Linien, Kreise oder Rechtecke aus freier Hand in der Auswahl."); }
    if (kind === "text") {
      busy("Studix AI liest deine Handschrift …"); const r = await vision(P.text, 900); if (r.stale) return; if (r.err) return fail(r.err);
      const txt = r.text.replace(/^```\w*\n?|```$/g, "").trim(); if (!txt || /^NICHTS\b/i.test(txt)) return fail("Keine lesbare Handschrift erkannt.");
      return showText(txt, r.im, r.sty);
    }
    if (kind === "redraw") {
      busy("Studix AI zeichnet neu …"); const r = await vision(P.redraw, 3000); if (r.stale) return; if (r.err) return fail(r.err);
      const j = parseJSON(r.text), list = j && nmap(j.items || j, r.im, r.sty);
      if (!list || !list.length) return fail("Studix AI konnte die Zeichnung nicht umsetzen. Bitte noch einmal versuchen.");
      locked = true; try { ink.replaceSel(list); } finally { locked = false; }
      return done("Neu gezeichnet");
    }
    if (kind === "check") {
      busy("Studix AI prüft deine Arbeit …"); const r = await vision(P.check + RL(), 1200); if (r.stale) return; if (r.err) return fail(r.err);
      return showCheck(parseJSON(r.text), r.text);
    }
    if (kind === "explain" || kind === "ask") {
      busy(kind === "ask" ? "Studix AI denkt nach …" : "Studix AI schaut sich das an …"); const r = await vision(kind === "ask" ? `Frage des Lernenden zur Zeichnung bzw. Notiz im Bild: ${q}\nAntworte kurz, klar und hilfreich (höchstens 150 Wörter).${RL()}` : P.explain + RL(), 900); if (r.stale) return; if (r.err) return fail(r.err);
      show(`<div class="ia-res">${mini(r.text.replace(/\[\d+\]/g, ""))}</div><div class="ia-btns"><button type="button" class="ia-b" data-copy>${ic("copy")}<span>Kopieren</span></button>${back}</div>`);
      $("[data-copy]", bar).onclick = () => { navigator.clipboard?.writeText(r.text); toast("Kopiert"); }; wireBack();
    }
  }
  function showText(txt, im, sty) {
    const rows = txt.split("\n"), lines = Math.max(1, rows.length), h = im.box[3] - im.box[1] - 28, bw = im.box[2] - im.box[0] - 28, maxc = Math.max(1, ...rows.map(l => l.length)), size = clamp(Math.min(h / lines / 1.28, bw / (maxc * .56)), 12, 52), x = im.box[0] + 14, y = im.box[1] + 14;
    show(`<div class="ia-lbl">Erkannter Text</div><textarea class="ia-ta" rows="${clamp(lines + 1, 3, 8)}" aria-label="Erkannter Text">${esc(txt)}</textarea>
      <div class="ia-btns"><button type="button" class="ia-b pri" data-rep>${ic("check")}<span>Ersetzen</span></button>${host && host.insertText ? `<button type="button" class="ia-b" data-ins>${ic("note")}<span>In Dokument einfügen</span></button>` : ""}<button type="button" class="ia-b" data-copy>${ic("copy")}<span>Kopieren</span></button>${back}</div>
      ${host && host.insertText ? `<label class="ia-chk"><input type="checkbox" checked data-del> Handschrift danach löschen</label>` : ""}`);
    const val = () => $(".ia-ta", bar).value.trim();
    $("[data-rep]", bar).onclick = () => { const v = val(); if (!v) return; locked = true; try { ink.replaceSel([ink.makeText(v, x, y, size, sty.color)]); } finally { locked = false; } done("Handschrift ersetzt"); };
    $("[data-ins]", bar)?.addEventListener("click", () => { const v = val(); if (!v) return; const ok = host.insertText(v, { box: im.box, size }); if (ok === false) return; if ($("[data-del]", bar)?.checked) { locked = true; try { ink.replaceSel([]); } finally { locked = false; } } toast("Text eingefügt"); hide(); });
    $("[data-copy]", bar).onclick = () => { navigator.clipboard?.writeText(val()); toast("Kopiert"); }; wireBack();
  }
  function showCheck(j, raw) {
    const issues = j && Array.isArray(j.issues) ? j.issues.filter(i => i && (i.problem || i.fix)).slice(0, 6) : null;
    if (!j || !j.verdict) { show(`<div class="ia-res">${mini(String(raw || "").replace(/```\w*|```/g, ""))}</div><div class="ia-btns">${back}</div>`); return wireBack(); }
    const v = j.verdict === "ok" && !(issues && issues.length) ? "ok" : issues && issues.length ? "errors" : "unclear";
    const head = { ok: ["ok", "Alles korrekt"], errors: ["warn", issues && issues.length === 1 ? "1 möglicher Fehler" : (issues ? issues.length : 0) + " mögliche Fehler"], unclear: ["unk", "Nicht eindeutig"] }[v];
    show(`<div class="ia-badge ${head[0]}">${ic(v === "ok" ? "check" : v === "errors" ? "help" : "search")}<b>${head[1]}</b></div>${j.summary ? `<p class="ia-sum">${esc(j.summary)}</p>` : ""}
      ${issues && issues.length ? `<ul class="ia-iss">${issues.map(i => `<li>${i.where ? `<b>${esc(i.where)}</b>` : ""}${i.problem ? `<span>${esc(i.problem)}</span>` : ""}${i.fix ? `<em>→ ${esc(i.fix)}</em>` : ""}</li>`).join("")}</ul>` : ""}<div class="ia-btns">${back}</div>`);
    wireBack();
  }

  /* ---------- Verbindung zu ink.js ---------- */
  const onSel = k => {
    if (dead) return;
    if (k === "drag") { bar.classList.add("hold"); return; }
    if (locked) return;
    if (!ink.selStrokes().length) return hide();
    idle();
  };
  return { onSel, destroy() { dead = true; removeEventListener("scroll", sched, true); removeEventListener("resize", sched); cancelAnimationFrame(raf); bar.remove(); } };
}
