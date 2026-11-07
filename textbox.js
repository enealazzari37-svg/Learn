"use strict";
/* Studix Textfelder – frei platzierbare, skalierbare Textboxen auf der Notiz-Seite.
   Daten: [{id, x, y, w, h, html, fs, fill, bd}] – x relativ zur Seitenmitte, y ab Seitenanfang (wie die Zeichnung). */
const TB_FILL = [["", "Kein"], ["#f1f1f5", "Grau"], ["#0f0f12", "Schwarz"], ["#fff1a8", "Gelb"], ["#d8f3dc", "Grün"], ["#ffe0e0", "Rosa"]];

function mountTextBoxes(paper, opts = {}) {
  let boxes = [], sel = null; const onChange = opts.onChange || (() => {});
  const layer = document.createElement("div"); layer.className = "tbx-layer"; paper.appendChild(layer);
  const bar = document.createElement("div"); bar.className = "tbx-bar"; bar.hidden = true;
  bar.innerHTML = `<button data-a="fm" title="Kleiner" aria-label="Schrift kleiner">A−</button><b id="tbx-fs">16</b><button data-a="fp" title="Größer" aria-label="Schrift größer">A+</button><i></i>${TB_FILL.map(([c, t]) => `<button class="tbx-sw" data-f="${c}" title="${t}" aria-label="${t}" style="${c ? "background:" + c : ""}"></button>`).join("")}<i></i><button data-a="bd" title="Rahmen" aria-label="Rahmen">${ic("square")}</button><button data-a="cp" title="Duplizieren" aria-label="Duplizieren">${ic("copy")}</button><button data-a="rm" title="Löschen" aria-label="Löschen">${ic("trash")}</button>`;
  document.body.appendChild(bar);
  const uid2 = () => "t" + Math.random().toString(36).slice(2, 9), W = () => paper.clientWidth;
  const get = id => boxes.find(b => b.id === id);
  const changed = () => onChange(boxes);

  function place(el, b) { el.style.left = `calc(50% + ${b.x}px)`; el.style.top = b.y + "px"; el.style.width = b.w + "px"; el.style.height = b.h + "px"; }
  function style(el, b) { const inn = el.querySelector(".tbx-in"); inn.style.fontSize = (b.fs || 16) + "px"; el.style.background = b.fill || "transparent"; inn.style.color = b.fill === "#0f0f12" ? "#fff" : ""; el.classList.toggle("bd", !!b.bd || !b.fill && false); el.classList.toggle("has-bd", !!b.bd); }
  function build(b) {
    const el = document.createElement("div"); el.className = "tbx"; el.dataset.id = b.id;
    el.innerHTML = `<div class="tbx-in" contenteditable="true" spellcheck="true" data-ph="Text …"></div><span class="tbx-mv" data-h="mv"></span>${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(h => `<i class="tbx-h h-${h}" data-h="${h}"></i>`).join("")}`;
    const inn = el.querySelector(".tbx-in"); inn.innerHTML = cleanHtml(b.html || "");
    place(el, b); style(el, b); layer.appendChild(el);
    inn.addEventListener("input", () => { b.html = inn.innerHTML; changed(); });
    inn.addEventListener("focus", () => select(b.id));
    inn.addEventListener("keydown", e => { if (e.key === "Escape") { inn.blur(); select(null); } e.stopPropagation(); });
    el.addEventListener("pointerdown", e => {
      const h = e.target.dataset?.h; select(b.id); if (!h) return;
      e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, o = { x: b.x, y: b.y, w: b.w, h: b.h }, minW = 70, minH = 34;
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (h === "mv") { b.x = Math.round(o.x + dx); b.y = Math.max(0, Math.round(o.y + dy)); }
        else {
          let x = o.x, y = o.y, w = o.w, hh = o.h;
          if (h.includes("e")) w = Math.max(minW, o.w + dx);
          if (h.includes("s")) hh = Math.max(minH, o.h + dy);
          if (h.includes("w")) { w = Math.max(minW, o.w - dx); x = o.x + (o.w - w); }
          if (h.includes("n")) { hh = Math.max(minH, o.h - dy); y = Math.max(0, o.y + (o.h - hh)); hh = o.h + (o.y - y); }
          b.x = Math.round(x); b.y = Math.round(y); b.w = Math.round(w); b.h = Math.round(hh);
        }
        place(el, b); pos();
      };
      const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); changed(); };
      el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
    return el;
  }
  const elOf = id => layer.querySelector(`[data-id="${id}"]`);
  function pos() {
    if (!sel) return; const el = elOf(sel); if (!el) return; const r = el.getBoundingClientRect(), w = bar.offsetWidth || 360;
    bar.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; bar.style.top = Math.max(8, r.top - 54) + "px";
  }
  function select(id) {
    sel = id; layer.querySelectorAll(".tbx").forEach(e => e.classList.toggle("sel", e.dataset.id === id)); bar.hidden = !id;
    if (id) { const b = get(id); $("#tbx-fs", bar).textContent = b.fs || 16; $$("[data-f]", bar).forEach(s => s.classList.toggle("on", (s.dataset.f || "") === (b.fill || ""))); $('[data-a="bd"]', bar).classList.toggle("on", !!b.bd); pos(); }
  }
  bar.onmousedown = e => { if (!e.target.closest("input")) e.preventDefault(); };
  bar.addEventListener("click", e => {
    const b = sel && get(sel); if (!b) return; const f = e.target.closest("[data-f]"), a = e.target.closest("[data-a]")?.dataset.a, el = elOf(b.id);
    if (f) { b.fill = f.dataset.f; style(el, b); select(b.id); changed(); return; }
    if (a === "fm" || a === "fp") { b.fs = Math.max(9, Math.min(96, (b.fs || 16) + (a === "fp" ? 2 : -2))); style(el, b); select(b.id); changed(); }
    else if (a === "bd") { b.bd = !b.bd; style(el, b); select(b.id); changed(); }
    else if (a === "cp") { const n = { ...b, id: uid2(), x: b.x + 24, y: b.y + 24 }; boxes.push(n); build(n); select(n.id); changed(); }
    else if (a === "rm") { boxes = boxes.filter(x => x !== b); el.remove(); select(null); changed(); }
  });
  const outside = e => { if (sel && !e.target.closest(".tbx") && !bar.contains(e.target)) select(null); };
  document.addEventListener("pointerdown", outside, true);
  const onScroll = () => pos(); addEventListener("resize", onScroll); document.addEventListener("scroll", onScroll, true);
  const keyd = e => { if ((e.key === "Delete") && sel && !e.target.isContentEditable) { $('[data-a="rm"]', bar).click(); } };
  document.addEventListener("keydown", keyd);

  let rb = null;
  const stopPlace = () => { layer.classList.remove("placing"); paper.classList.remove("tbx-placing"); rb?.remove(); rb = null; };
  const mk = (x, y, w, h) => { const b = { id: uid2(), x: Math.round(x), y: Math.max(0, Math.round(y)), w: Math.round(w), h: Math.round(h), html: "", fs: 18, fill: "", bd: false }; boxes.push(b); const el = build(b); select(b.id); el.querySelector(".tbx-in").focus(); changed(); };
  layer.addEventListener("pointerdown", e => {
    if (!layer.classList.contains("placing") || e.target !== layer) return; e.preventDefault(); const r = layer.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top; let ex = sx, ey = sy;
    rb = document.createElement("div"); rb.className = "tbx-rb"; layer.appendChild(rb); layer.setPointerCapture(e.pointerId);
    const draw = () => { rb.style.left = Math.min(sx, ex) + "px"; rb.style.top = Math.min(sy, ey) + "px"; rb.style.width = Math.abs(ex - sx) + "px"; rb.style.height = Math.abs(ey - sy) + "px"; };
    const mv = ev => { ex = ev.clientX - r.left; ey = ev.clientY - r.top; draw(); };
    const up = () => { layer.removeEventListener("pointermove", mv); layer.removeEventListener("pointerup", up); const w = Math.abs(ex - sx), h = Math.abs(ey - sy); stopPlace(); const big = w > 40 && h > 24; mk(big ? Math.min(sx, ex) - r.width / 2 : sx - r.width / 2, big ? Math.min(sy, ey) : sy - 4, big ? w : 240, big ? h : 44); };
    layer.addEventListener("pointermove", mv); layer.addEventListener("pointerup", up);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") stopPlace(); });
  return {
    load(arr) { boxes = Array.isArray(arr) ? arr.map(b => ({ ...b })) : []; layer.innerHTML = ""; boxes.forEach(build); select(null); },
    get: () => boxes,
    /* Platzier-Modus: einmal auf die Seite klicken (oder einen Bereich aufziehen) – das Textfeld erscheint direkt dort, ohne Farbe */
    add() {
      if (layer.classList.contains("placing")) return stopPlace(); layer.classList.add("placing"); paper.classList.add("tbx-placing"); toast("Tippe auf die Seite oder ziehe einen Bereich auf");
    },
    destroy() { document.removeEventListener("pointerdown", outside, true); removeEventListener("resize", onScroll); document.removeEventListener("scroll", onScroll, true); document.removeEventListener("keydown", keyd); bar.remove(); layer.remove(); },
  };
}
