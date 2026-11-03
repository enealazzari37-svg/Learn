"use strict";
/* Studix PDF editor – a PDF opens like a note: write text and draw directly on the pages. */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
/* Referenz-Seitenbreite: Text-Anmerkungen und Striche werden in diesen Einheiten gespeichert und mit der echten Seitenbreite skaliert,
   damit sie an derselben Stelle der Seite bleiben – egal ob der Chat offen ist, das iPad gedreht oder gezoomt wird */
const PDF_REF = 860;
let pdfReady = null;
function loadPdfLib() {
  return pdfReady || (pdfReady = (async () => {
    await loadScript(PDFJS + "pdf.min.js");
    /* cross-origin workers are blocked, so the worker script is wrapped in a same-origin blob */
    const w = await (await fetch(PDFJS + "pdf.worker.min.js")).text();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([w], { type: "text/javascript" }));
    return pdfjsLib;
  })().catch(e => { pdfReady = null; throw e; }));
}

async function pdfEditor(m, d, blob) {
  m.classList.add("doc-full");
  const fp = folderPath(d.folderId);
  m.innerHTML = `<div class="ned dfull pdfed"><div class="ned-bar">
    <div class="nb-l"><button class="icon-btn" id="eb" aria-label="Zurück">${ic("back")}</button><button class="icon-btn pdf-thtg" id="thtg" aria-label="Seitenübersicht" title="Seitenübersicht" aria-pressed="false">${ic("note")}</button><div class="nb-name"><b id="cr" title="Zum Umbenennen klicken">${esc(d.title)}</b><button class="nb-folder" data-p="${d.folderId || ""}">${ic("folder")}<span>${["Home", ...fp.map(f => f.name)].map(esc).join(" / ")}</span></button></div></div>
    <div class="ned-tools" id="tb"><span class="tt-lbl">Auf die Seite tippen, um zu schreiben</span><i class="sep"></i><button class="tbtn" id="fsm" title="Schrift kleiner" aria-label="Schrift kleiner"><b style="font-size:12px">A</b></button><button class="tbtn" id="fsp" title="Schrift größer" aria-label="Schrift größer"><b style="font-size:17px">A</b></button><label class="tbtn" title="Textfarbe"><b id="cl" style="border-bottom:3px solid #1c1c22;line-height:1">A</b><input type="color" id="cin" value="#1c1c22" hidden></label><i class="sep"></i><button class="tbtn on" id="gapt" title="Lücken und Formularfelder hervorheben" aria-pressed="true">${ic("edit")}<span class="gapl">Lücken <b id="gapc">0</b></span></button></div>
    <div class="nb-r"><span class="saved" id="sv">Gespeichert</span><div class="modesw m3" id="msw" role="tablist" data-m="write"><i class="knob"></i><button role="tab" data-m="write" class="on" title="Text auf die Seite schreiben">${ic("text")}<span>Text</span></button><button role="tab" data-m="hl" title="Textstellen markieren">${ic("hl")}<span>Markieren</span></button><button role="tab" data-m="draw" title="Mit Stift zeichnen">${ic("brush")}<span>Zeichnen</span></button></div><button class="icon-btn" id="pdfs" aria-label="Im PDF suchen" title="Im PDF suchen (Strg+F)">${ic("search")}</button><button class="icon-btn" id="mo-m" aria-label="Mehr">${ic("more")}</button><button class="icon-btn aitog" id="ai-m" aria-label="AI ein- und ausklappen" title="AI ein- und ausklappen">${ic("aipanel")}<span class="hide-sm">AI</span></button></div></div>
  <div class="pdfwrap"><aside class="pdfthumbs" id="thumbs" aria-label="Seitenübersicht"></aside><article class="ned-paper pdfpaper" id="paperc"><div class="pdfpages" id="pages"><p class="empty pdfload">PDF wird geladen …</p></div></article>
  <div class="pdfsearch" id="psr" hidden><input id="psq" type="search" placeholder="Im PDF suchen …" aria-label="Im PDF suchen" autocomplete="off"><span id="psc"></span><button class="tbtn" id="psp" aria-label="Vorheriger Treffer" title="Vorheriger Treffer">${ic("back")}</button><button class="tbtn" id="psn" aria-label="Nächster Treffer" title="Nächster Treffer">${ic("back")}</button><button class="tbtn" id="psx" aria-label="Schliessen">${ic("x")}</button></div>
  <div class="pdfpager" id="pager" hidden><button class="tbtn pz" id="zo" aria-label="Verkleinern" title="Verkleinern"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button><button class="pzv" id="zv" title="Auf Breite anpassen">100%</button><button class="tbtn pz" id="zi" aria-label="Vergrößern" title="Vergrößern">${ic("plus")}</button><i class="psep"></i><button class="tbtn" id="pgp" aria-label="Vorherige Seite" title="Vorherige Seite">${ic("back")}</button><span class="pgn"><input id="pgin" type="number" min="1" value="1" aria-label="Seite"><i>/</i><b id="pgn">1</b></span><button class="tbtn" id="pgx" aria-label="Nächste Seite" title="Nächste Seite">${ic("back")}</button></div></div></div>`;
  const paper = $("#paperc", m); setScroller(paper); const pages = $("#pages", m), svEl = $("#sv", m);
  $$("[data-p]", m).forEach(b => b.onclick = () => go("docs/" + b.dataset.p));
  $("#eb", m).onclick = () => go("docs/" + (d.folderId || ""));

  let lib; try { lib = await loadPdfLib(); } catch { lib = null; }
  let pdf = null; if (lib) { try { pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; } catch {} }
  if (pdf) LEAVE.push(() => { try { pdf.destroy(); } catch {} });   // beendet den Worker und gibt den Speicher frei (iPad)
  const pageW = () => pages.querySelector(".pdfpg")?.clientWidth || 0, kNow = () => (pageW() || PDF_REF) / PDF_REF;
  if (!pdf) {
    const url = URL.createObjectURL(blob); LEAVE.push(() => URL.revokeObjectURL(url));
    pages.innerHTML = `<iframe class="pdffallback" src="${url}" title="${esc(d.title)}"></iframe>`; pages.dataset.fb = 1; $("#msw", m).hidden = true; $("#tb", m).hidden = true;
    toast("Die PDF-Bearbeitung braucht Internet – Vorschau geladen");
  }

  const dirtyInk = debounce(async () => { if (!D.docs.includes(d)) return; d.hasInk = ink.st.strokes.length > 0; d.updated = Date.now(); await KV.set("ink:" + d.id, ink.st.strokes); save(); svEl.textContent = "Gespeichert"; }, 600);
  const dirtyTx = debounce(async () => { if (!D.docs.includes(d)) return; d.updated = Date.now(); await KV.set("ann:" + d.id, texts); save(); svEl.textContent = "Gespeichert"; }, 600);
  const ink = createInk(pages, d, { bar: $(".ned-bar", m), scale: kNow, onChange: () => { svEl.textContent = "Speichert…"; dirtyInk(); },
    /* KI-Popup beim Lasso: erkannter Text wird eine Text-Anmerkung genau dort, wo die Handschrift stand (Seiten-Einheiten wie die Striche) */
    ai: { insertText: (text, o) => { const bx = (o && o.box) || [0, 0]; const t = { x: Math.round(bx[0]), y: Math.round(bx[1]), text, size: Math.round(Math.max(12, Math.min(40, (o && o.size) || 18))), color: "#1c1c22" }; texts.push(t); txEl(t); dirtyTx(); return true; } } });
  LEAVE.push(() => ink.destroy());
  let texts = (await KV.get("ann:" + d.id)) || [], size = 18, color = "#1c1c22", focusTx = null;
  let gapVals = (await KV.get("gap:" + d.id)) || {}, gapN = 0;
  const dirtyGap = debounce(async () => { if (!D.docs.includes(d)) return; d.updated = Date.now(); await KV.set("gap:" + d.id, gapVals); save(); svEl.textContent = "Gespeichert"; }, 600);
  /* Lücken erkennen: Unterstriche, Punktreihen und PDF-Formularfelder werden zu Eingabefeldern direkt auf der Seite */
  async function detectGaps(o) {
    const n = +o.h.dataset.n; if (o.h.querySelector(".pdfgaps")) return; const layer = document.createElement("div"); layer.className = "pdfgaps"; o.h.appendChild(layer);
    const vp = o.vp, W = vp.width, H = vp.height; let i = 0;
    const put = (x, y, w, h, key, fs, kind) => {
      const e = document.createElement(kind === "check" ? "input" : "input"); e.className = "pdfgap" + (kind === "check" ? " chk" : ""); if (kind === "check") e.type = "checkbox"; else { e.type = "text"; e.spellcheck = false; e.autocomplete = "off"; }
      e.style.cssText = `left:${(x / W * 100).toFixed(3)}%;top:${(y / H * 100).toFixed(3)}%;width:${(w / W * 100).toFixed(3)}%;height:${(h / H * 100).toFixed(3)}%;font-size:${(fs / W * 100).toFixed(3)}cqw`;
      const v = gapVals[key]; if (kind === "check") e.checked = !!v; else if (v) e.value = v;
      e.oninput = () => { gapVals[key] = kind === "check" ? e.checked : e.value; svEl.textContent = "Speichert…"; dirtyGap(); };
      e.onkeydown = ev => ev.stopPropagation(); layer.appendChild(e); gapN++; const c = $("#gapc", m); if (c) c.textContent = gapN;
    };
    try {
      const tc = await o.pg.getTextContent();
      for (const it of tc.items) {
        const str = it.str || ""; if (!/_{3,}|\.{4,}|…{2,}|-{6,}|―{3,}/.test(str)) continue;
        const t = it.transform, fh = Math.hypot(t[2], t[3]) || 10, len = str.length || 1, re = /_{3,}|\.{4,}|…{2,}|-{6,}|―{3,}/g; let mm;
        while ((mm = re.exec(str))) {
          const [vx, vy] = vp.convertToViewportPoint(t[4] + it.width * mm.index / len, t[5]), w = it.width * mm[0].length / len;
          put(vx, vy - fh * 1.05, Math.max(w, fh * 2), fh * 1.3, n + ":" + (i++), fh * .95, "text");
        }
      }
    } catch {}
    try {
      const an = await o.pg.getAnnotations({ intent: "display" });
      an.filter(a => a.subtype === "Widget" && !a.readOnly && (a.fieldType === "Tx" || (a.fieldType === "Btn" && a.checkBox))).forEach((a, k) => {
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect), key = n + ":w" + (a.id || k); const fv = a.fieldValue;
        if (gapVals[key] === undefined && fv && fv !== "Off") gapVals[key] = a.fieldType === "Btn" ? true : String(fv);
        put(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), key, Math.max(9, Math.abs(y2 - y1) * .62), a.fieldType === "Btn" ? "check" : "text");
      });
    } catch {}
    if (!layer.children.length) layer.remove();
  }

  /* Scroll-Element und Leseposition: Position = Seite + Anteil, damit sie nach Grössenänderungen (Chat, Drehen, Zoom) und beim nächsten Öffnen stimmt */
  const scEl = () => { for (let n = paper; n && n !== document.body; n = n.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1) return n; } return document.scrollingElement; };
  const scTop = el => el === document.scrollingElement ? 0 : el.getBoundingClientRect().top;
  let holders = [], anchor = null, layoutW = 0, z = 1;
  const POSK = "lumi.pdfpos:" + d.id, ZK = "lumi.pdfz:" + d.id;
  const readAnchor = () => { const el = scEl(), y0 = scTop(el) + 1; for (let i = 0; i < holders.length; i++) { const r = holders[i].h.getBoundingClientRect(); if (r.bottom > y0 || i === holders.length - 1) return { i, f: Math.max(0, Math.min(1, (y0 - r.top) / (r.height || 1))) }; } return null; };
  const applyAnchor = a => { if (!a || !holders[a.i]) return; const el = scEl(), r = holders[a.i].h.getBoundingClientRect(); el.scrollTop += (r.top + a.f * r.height) - (scTop(el) + 1); };
  const storePos = debounce(() => { if (anchor) try { localStorage.setItem(POSK, JSON.stringify(anchor)); } catch {} }, 400);

  if (pdf) {
    const first = await pdf.getPage(1), N = pdf.numPages;
    $(".pdfload", pages)?.remove();
    for (let i = 1; i <= N; i++) {
      const pg = i === 1 ? first : await pdf.getPage(i), vp = pg.getViewport({ scale: 1 });
      const h = document.createElement("div"); h.className = "pdfpg"; h.dataset.n = i; h.style.aspectRatio = `${vp.width} / ${vp.height}`; pages.appendChild(h); holders.push({ h, pg, vp, done: 0, vis: false });
    }
    try { z = Math.max(.5, Math.min(3, +localStorage.getItem(ZK) || 1)); } catch {}
    pages.style.setProperty("--z", z); pages.style.setProperty("--k", kNow()); layoutW = pages.clientWidth;

    /* Seiten werden nur in Sichtweite gerendert und weiter entfernte wieder freigegeben – sonst überschreitet Safari auf dem iPad
       das Canvas-Speicherlimit und die PDF bleibt beim nächsten Öffnen weiss */
    const PX = 5e6;
    const free = o => { try { o.task?.cancel(); } catch {} const c = o.h.querySelector("canvas"); if (c) { c.width = c.height = 0; c.remove(); } o.done = 0; };
    const render = async o => {
      if (o.busy) { o.again = true; return; }
      const w = o.h.clientWidth; if (!w || !o.vis) return;
      const hgt = w * o.vp.height / o.vp.width, dpr = Math.min(2, devicePixelRatio || 1, Math.sqrt(PX / (w * hgt))), want = Math.round(w * dpr);
      if (Math.abs(o.done - want) < 2) return;
      o.busy = true; const vp = o.pg.getViewport({ scale: want / o.vp.width }), cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      try {
        o.task = o.pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }); await o.task.promise;
        if (o.vis) { const old = o.h.querySelector("canvas"); if (old) { old.replaceWith(cv); old.width = old.height = 0; } else o.h.prepend(cv); o.done = want; } else { cv.width = cv.height = 0; }
      } catch { cv.width = cv.height = 0; }
      o.busy = false; o.task = null;
      if (!o.gaps) { o.gaps = true; detectGaps(o); }
      if (o.again) { o.again = false; render(o); }
    };
    /* Beobachter relativ zum Element, das wirklich scrollt (wechselt je nach Fensterbreite) – bei Layoutwechsel neu anlegen */
    let io = null, ioFar = null, ioRoot;
    const setupIO = () => {
      const el = scEl(), root = el === document.scrollingElement ? null : el; if (io && root === ioRoot) return; ioRoot = root; io?.disconnect(); ioFar?.disconnect();
      io = new IntersectionObserver(es => es.forEach(e => { const o = holders[+e.target.dataset.n - 1]; if (e.isIntersecting) { o.vis = true; render(o); } }), { root, rootMargin: "1200px 0px" });
      ioFar = new IntersectionObserver(es => es.forEach(e => { const o = holders[+e.target.dataset.n - 1]; if (!e.isIntersecting) { o.vis = false; free(o); } }), { root, rootMargin: "3600px 0px" });
      holders.forEach(o => { io.observe(o.h); ioFar.observe(o.h); });
    };
    setupIO();
    LEAVE.push(() => { io?.disconnect(); ioFar?.disconnect(); holders.forEach(free); });

    /* Grössenänderung (Chat auf/zu, Drehen, Seitenleiste): Position halten, Anmerkungen mitskalieren, Seiten scharf neu rendern */
    const sharpen = debounce(() => holders.forEach(o => o.vis && render(o)), 260);
    const relayout = () => { pages.style.setProperty("--k", kNow()); applyAnchor(anchor); layoutW = pages.clientWidth; ink.relayout(); setupIO(); sharpen(); };
    const ro = new ResizeObserver(() => { if (pages.clientWidth !== layoutW) relayout(); }); ro.observe(pages); LEAVE.push(() => ro.disconnect());
    const onSc = () => { if (pages.clientWidth === layoutW && m.isConnected) { anchor = readAnchor(); storePos(); } };
    document.addEventListener("scroll", onSc, { capture: true, passive: true }); LEAVE.push(() => document.removeEventListener("scroll", onSc, true));

    /* Zoom (Knöpfe unten rechts, Strg/Cmd +/−/0) */
    const zv = $("#zv", m), paintZ = () => { zv.textContent = Math.round(z * 100) + "%"; $("#zo", m).disabled = z <= .5; $("#zi", m).disabled = z >= 3; };
    const setZoom = nz => {
      nz = Math.round(Math.max(.5, Math.min(3, nz)) * 100) / 100; if (nz === z) return; const a = readAnchor(); z = nz;
      pages.style.setProperty("--z", z); try { localStorage.setItem(ZK, String(z)); } catch {}
      pages.style.setProperty("--k", kNow()); applyAnchor(a); anchor = a; const el = scEl(); el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2); layoutW = pages.clientWidth; ink.relayout(); sharpen(); paintZ();
    };
    $("#zo", m).onclick = () => setZoom(z > 1 ? z - .25 : z - .1); $("#zi", m).onclick = () => setZoom(z >= 1 ? z + .25 : z + .1); zv.onclick = () => setZoom(1); paintZ();
    const kz = e => { if (!m.isConnected || !(e.ctrlKey || e.metaKey)) return; if (e.key === "+" || e.key === "=") { e.preventDefault(); $("#zi", m).click(); } else if (e.key === "-") { e.preventDefault(); $("#zo", m).click(); } else if (e.key === "0") { e.preventDefault(); setZoom(1); } };
    document.addEventListener("keydown", kz); LEAVE.push(() => document.removeEventListener("keydown", kz));

    /* zuletzt gelesene Stelle wieder öffnen */
    try { const sp = JSON.parse(localStorage.getItem(POSK) || "null"); if (sp && sp.i < N) { anchor = sp; requestAnimationFrame(() => applyAnchor(sp)); } } catch {}
    buildNav(holders, N);
  }

  /* page overview (thumbnails) + page counter: jump, current page follows the scroll */
  function buildNav(holders, N) {
    const th = $("#thumbs", m), pager = $("#pager", m), pgin = $("#pgin", m), tg = $("#thtg", m); let cur = 0;
    $("#pgn", m).textContent = N; pgin.max = N; pager.hidden = false;
    const dpr = Math.min(2, devicePixelRatio || 1), btns = holders.map((o, i) => {
      const b = document.createElement("button"); b.className = "pdfth"; b.setAttribute("aria-label", "Seite " + (i + 1)); b.dataset.n = i; b.innerHTML = `<span class="th-c"><canvas></canvas></span><em>${i + 1}</em>`;
      b.querySelector(".th-c").style.aspectRatio = `${o.vp.width} / ${o.vp.height}`; b.onclick = () => go1(i); th.appendChild(b); return b;
    });
    const tio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; const b = e.target, o = holders[+b.dataset.n]; tio.unobserve(b); const cv = b.querySelector("canvas"), vp = o.pg.getViewport({ scale: 112 * dpr / o.vp.width });
      cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); o.pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.catch(() => {});
    }), { root: th, rootMargin: "400px 0px" });
    btns.forEach(b => tio.observe(b)); LEAVE.push(() => { tio.disconnect(); btns.forEach(b => { const c = b.querySelector("canvas"); c.width = c.height = 0; }); });
    const go1 = i => { i = Math.max(0, Math.min(N - 1, i)); holders[i].h.scrollIntoView({ behavior: "smooth", block: "start" }); if (innerWidth <= 900 && open) setOpen(false, false); };
    const setCur = i => {
      if (i === cur && btns[i].classList.contains("on")) return; cur = i; btns.forEach((b, k) => b.classList.toggle("on", k === i));
      if (document.activeElement !== pgin) pgin.value = i + 1; const b = btns[i]; if (th.offsetParent) th.scrollTop = b.offsetTop - th.clientHeight / 2 + b.offsetHeight / 2;
    };
    let raf = 0; const track = () => { raf = 0; const y = innerHeight * .35; let best = 0; holders.forEach((o, i) => { if (o.h.getBoundingClientRect().top <= y) best = i; }); setCur(best); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(track); };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true }); LEAVE.push(() => document.removeEventListener("scroll", onScroll, true)); track();
    $("#pgp", m).onclick = () => go1(cur - 1); $("#pgx", m).onclick = () => go1(cur + 1);
    pgin.onchange = () => go1((+pgin.value || 1) - 1); pgin.onkeydown = e => { if (e.key === "Enter") pgin.blur(); e.stopPropagation(); };
    const root = $(".pdfed", m); let open; try { open = localStorage.getItem("lumi.pdfth"); } catch {} open = innerWidth <= 900 ? false : open == null ? innerWidth >= 1100 : open === "1";
    const setOpen = (v, keep = true) => { open = v; root.classList.toggle("th-open", v); tg.classList.toggle("on", v); tg.setAttribute("aria-pressed", v); tg.innerHTML = ic(v ? "note-f" : "note"); if (keep && innerWidth > 900) try { localStorage.setItem("lumi.pdfth", v ? "1" : "0"); } catch {} };
    tg.onclick = () => setOpen(!open); setOpen(open, false);
  }

  /* text annotations (Seiten-Einheiten, --k = aktuelle Seitenbreite / PDF_REF) */
  const placeTx = (e, t) => { e.style.cssText = `left:calc(50% + ${t.x} * var(--k, 1) * 1px);top:calc(${t.y} * var(--k, 1) * 1px);font-size:calc(${t.size} * var(--k, 1) * 1px);color:${t.color}`; };
  /* ältere Anmerkungen lagen in Bildschirm-Pixeln → einmalig in Seiten-Einheiten umrechnen */
  /* früher: Pixel bei der damaligen Breite, Seitenabstand fix 18px → jetzt alles in Seiten-Einheiten (Abstand skaliert mit) */
  let legacyY = null;
  if (pdf && !d.pdfRef) {
    const k0 = kNow();
    if (Math.abs(k0 - 1) > .002) {
      const w0 = pageW(), tops = []; let acc = 0; holders.forEach(o => { tops.push(acc); acc += w0 * o.vp.height / o.vp.width + 18; });
      legacyY = y => { let i = 0; while (i < tops.length - 1 && y >= tops[i + 1]) i++; return tops[i] / k0 - 18 * i / k0 + 18 * i + (y - tops[i]) / k0; };
      texts.forEach(t => { t.y = legacyY(t.y); t.x /= k0; t.size /= k0; }); legacyY.k = k0; if (texts.length) KV.set("ann:" + d.id, texts);
    }
    d.pdfRef = PDF_REF; save();
  }
  const txEl = t => {
    const e = document.createElement("div"); e.className = "pdftx"; e.contentEditable = "plaintext-only"; e.spellcheck = false; e.textContent = t.text; placeTx(e, t);
    e.onfocus = () => { focusTx = { e, t }; }; e.onblur = () => { if (focusTx?.e === e) focusTx = null; if (!e.textContent.trim()) { texts = texts.filter(x => x !== t); e.remove(); dirtyTx(); } };
    e.oninput = () => { t.text = e.textContent; svEl.textContent = "Speichert…"; dirtyTx(); };
    e.onkeydown = ev => { if (ev.key === "Escape") e.blur(); ev.stopPropagation(); };
    pages.appendChild(e); return e;
  };
  texts.forEach(txEl);
  pages.addEventListener("pointerdown", e => {
    if (ink.st.on || e.target.closest(".pdftx,.pdfgap") || !e.target.closest(".pdfpg") || e.button > 0) return;
    e.preventDefault(); const r = pages.getBoundingClientRect(), k = kNow(), t = { x: Math.round((e.clientX - r.left - r.width / 2) / k), y: Math.round((e.clientY - r.top) / k - size * .6), text: "", size, color };
    texts.push(t); txEl(t).focus();
  });
  const applyTx = () => { if (focusTx) { focusTx.t.size = size; focusTx.t.color = color; placeTx(focusTx.e, focusTx.t); dirtyTx(); } };
  $("#gapt", m).onclick = e => { const on = pages.classList.toggle("gaps-off"); e.currentTarget.classList.toggle("on", !on); e.currentTarget.setAttribute("aria-pressed", !on); };
  $$("#tb .tbtn", m).forEach(b => b.onmousedown = ev => ev.preventDefault());
  $("#fsm", m).onclick = () => { size = Math.max(10, size - 2); applyTx(); }; $("#fsp", m).onclick = () => { size = Math.min(64, size + 2); applyTx(); };
  $("#cin", m).oninput = e => { color = e.target.value; $("#cl", m).style.borderColor = color; applyTx(); }; $("#cin", m).onclick = e => e.stopPropagation(); $("#cl", m).parentElement.onclick = () => $("#cin", m).click();

  let inkData = (await KV.get("ink:" + d.id)) || [];
  if (legacyY && inkData.length) { const k0 = legacyY.k; inkData = inkData.map(st => ({ ...st, size: st.size / k0, pts: st.pts.map(q => [q[0] / k0, legacyY(q[1]), ...q.slice(2)]) })); KV.set("ink:" + d.id, inkData); }
  ink.load(inkData);
  const msw = $("#msw", m);
  /* Text · Markieren (Marker direkt bereit) · Zeichnen (alle Stift-Werkzeuge) */
  const setMode = k => {
    const draw = k !== "write"; ink.mode(draw);
    if (k === "hl") ink.tool("hl"); else if (k === "draw" && ink.st.tool === "hl") ink.tool("pen");
    m.classList.toggle("drawing", draw); pages.classList.toggle("inking", draw); msw.dataset.m = k; $$("button", msw).forEach(b => b.classList.toggle("on", b.dataset.m === k)); if (draw) document.activeElement?.blur?.();
  };
  $$("button", msw).forEach(b => b.onclick = () => setMode(b.dataset.m));

  /* Suche: Text aller Seiten (pdf.js), springt von Treffer zu Treffer (Seite) */
  if (pdf) {
    const box = $("#psr", m), q = $("#psq", m), cnt = $("#psc", m); let texts2 = null, hits = [], at = -1;
    const load = async () => texts2 || (texts2 = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => { try { return (await (await pdf.getPage(i + 1)).getTextContent()).items.map(x => x.str).join(" ").toLowerCase(); } catch { return ""; } })));
    const show = () => { cnt.textContent = hits.length ? `${at + 1} / ${hits.length}` : (q.value.trim() ? "Kein Treffer" : ""); if (hits[at] != null) $$(".pdfpg", pages)[hits[at]]?.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const run = async () => { const v = q.value.trim().toLowerCase(); hits = []; at = -1; if (v.length < 2) return show(); const T = await load(); T.forEach((t, i) => { let p = -1, n = 0; while ((p = t.indexOf(v, p + 1)) >= 0 && n < 50) { hits.push(i); n++; } }); at = hits.length ? 0 : -1; show(); };
    const step = k => { if (!hits.length) return; at = (at + k + hits.length) % hits.length; show(); };
    const toggle = on => { box.hidden = !on; if (on) { q.focus(); q.select(); } };
    $("#pdfs", m).onclick = () => toggle(box.hidden); $("#psx", m).onclick = () => toggle(false);
    q.oninput = debounce(run, 250); q.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") step(e.shiftKey ? -1 : 1); else if (e.key === "Escape") toggle(false); };
    $("#psn", m).onclick = () => step(1); $("#psp", m).onclick = () => step(-1);
    const kf = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && m.isConnected) { e.preventDefault(); toggle(true); } }; document.addEventListener("keydown", kf); LEAVE.push(() => document.removeEventListener("keydown", kf));
  } else $("#pdfs", m).hidden = true;

  /* title + menus */
  const rename = () => {
    const b = $("#cr", m); if (!b) return; const inp = document.createElement("input"); inp.className = "nb-in"; inp.value = d.title; inp.maxLength = 120; b.replaceWith(inp); inp.focus(); inp.select();
    let done = false; const fin = ok => { if (done) return; done = true; if (ok && inp.value.trim()) { d.title = inp.value.trim(); d.updated = Date.now(); save(); } const nb = document.createElement("b"); nb.id = "cr"; nb.title = "Zum Umbenennen klicken"; nb.textContent = d.title; inp.replaceWith(nb); nb.onclick = rename; };
    inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); else if (e.key === "Escape") fin(false); };
  };
  $("#cr", m).onclick = rename;
  const T = a => ({ ...a, fn: async () => aiTool(a.k, await docText(d), { title: d.title, subjectId: d.subjectId }) });
  $("#ai-m", m).onclick = e => menu(e.currentTarget, [T({ label: "Zusammenfassen", icon: "list", k: "summary" }), T({ label: "Einfach erklären", icon: "help", k: "explain" }), T({ label: "Frage zum Dokument…", icon: "search", k: "ask" }), "-", T({ label: "Karteikarten erstellen", icon: "cards", k: "cards" }), T({ label: "Quiz erstellen", icon: "help", k: "quiz" }), T({ label: "Lernziele ermitteln", icon: "star", k: "goals" })]);
  $("#mo-m", m).onclick = e => menu(e.currentTarget, [{ label: "Umbenennen", icon: "pen", fn: rename }, { label: "Fach zuordnen…", icon: "star", fn: () => { const { el, close } = modal(`<h3>Fach zuordnen</h3><div class="chips">${[{ id: "", name: "Kein Fach", color: "#999" }, ...D.subjects].map(x => `<button class="chip ${x.id === d.subjectId ? "on" : ""}" data-s="${x.id}"><i class="sdot" style="background:${x.color}"></i>${esc(x.name)}</button>`).join("")}</div>`); $$("[data-s]", el).forEach(b => b.onclick = () => { d.subjectId = b.dataset.s; save(); close(); refreshNav(); toast("Zugeordnet"); }); } }, { label: "Drucken", icon: "file", fn: () => { const u = URL.createObjectURL(blob), w = open(u); if (w) w.addEventListener("load", () => w.print()); else toast("Pop-ups erlauben, um zu drucken"); setTimeout(() => URL.revokeObjectURL(u), 60000); } }, { label: "Original-PDF laden", icon: "download", fn: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = d.title; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); } }, "-", { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); toast(d.pinned ? "Angeheftet" : "Gelöst"); } }, { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); go("docs/" + (d.folderId || "")); } }]);
}
