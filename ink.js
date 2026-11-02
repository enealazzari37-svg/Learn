"use strict";
/* Studix ink – a drawing layer on top of a note / PDF: write and draw in the same document.
   Coordinates are CSS px: x relative to the paper centre (stays aligned with the text column), y from the paper top.
   Engine: committed strokes live on an offscreen canvas, only the stroke being drawn is re-rendered (requestAnimationFrame),
   coalesced + predicted pointer events, stabilizer, pressure/tilt, pen-only palm rejection with manual finger scrolling. */

const INK_COL = ["#1c1c22", "#e5484d", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#ec4899", "#ffffff"];
const INK_TOOLS = [["pen", "Stift", "brush"], ["hl", "Marker", "hl"], ["eraser", "Radierer", "eraser"], ["shape", "Formen", "arrow"], ["lasso", "Auswahl: umkreisen, verschieben, skalieren", "lasso"], ["laser", "Laserpointer", "laser"], ["hand", "Scrollen", "cursor"]];
const INK_BRUSH = [["pen", "Füller"], ["mono", "Kugelschreiber"], ["pencil", "Bleistift"]];
const INK_SHAPE = [["line", "Linie"], ["arrow", "Pfeil"], ["rect", "Rechteck"], ["ellipse", "Kreis"], ["tri", "Dreieck"]];
const INK_SHAPE_IC = { line: "line", arrow: "arrow", rect: "square", ellipse: "circle", tri: "square" };
const INK_STICKERS = ["⭐", "❗", "❓", "✅", "❌", "💡", "📌", "🔥", "👍", "🎯", "📚", "✏️", "⏰", "🧠", "❤️", "😀", "😅", "🤔", "🎉", "⚠️", "➡️", "🔎", "🧪", "🧮"];
const INK_DEF = { smooth: .35, press: .8, penOnly: false, snap: true, eras: "stroke", brush: "pen", shape: "arrow", grid: "none", color: INK_COL[0], tool: "pen", sizes: { pen: 4, hl: 5, eraser: 24, shape: 3 }, pen: 0, pens: [{ brush: "pen", color: "#1c1c22", size: 4 }, { brush: "mono", color: "#2563eb", size: 3 }, { brush: "pencil", color: "#555a66", size: 3 }, { brush: "pen", color: "#e5484d", size: 6 }] };

function createInk(paper, d, opts = {}) {
  let S = { ...INK_DEF, sizes: { ...INK_DEF.sizes } };
  try { const j = JSON.parse(localStorage.getItem("lumi.ink") || "null"); if (j && typeof j === "object") S = { ...S, ...j, sizes: { ...S.sizes, ...(j.sizes || {}) } }; } catch {}
  const saveS = () => { try { localStorage.setItem("lumi.ink", JSON.stringify(S)); } catch {} };
  const st = { strokes: [], hist: [], redo: [], tool: S.tool === "laser" || S.tool === "hand" ? "pen" : S.tool, color: S.color, cur: null, on: false, penSeen: false, sel: null, lasso: null, laser: [], pred: [], tmp: null };
  const cv = document.createElement("canvas"); cv.className = "inkcv"; paper.appendChild(cv);
  const ctx = cv.getContext("2d", { desynchronized: true }) || cv.getContext("2d");
  const base = document.createElement("canvas"), bctx = base.getContext("2d");
  const ring = document.createElement("div"); ring.className = "ink-ring"; paper.appendChild(ring);
  let W = 0, H = 0, dpr = 1, dirty = true, raf = 0;
  /* opts.scale (PDF): Striche liegen in Seiten-Koordinaten und werden mit der aktuellen Seitenbreite skaliert –
     so bleiben Markierungen an derselben Textstelle, wenn sich die Breite ändert (Chat öffnen, iPad drehen, Zoom) */
  const K = () => { const k = opts.scale ? +opts.scale() : 1; return k > 0 && isFinite(k) ? k : 1; };
  const cx = () => W / 2 / K();
  const onChange = opts.onChange || (() => {});
  const tl = () => st.tmp || st.tool;
  const sizeKey = () => ({ pen: "pen", hl: "hl", eraser: "eraser" }[tl()] || "shape");

  function size() {
    const w = paper.clientWidth, h = Math.max(paper.scrollHeight, paper.clientHeight);
    if (w === W && h === H) return; W = w; H = h;
    dpr = Math.max(.6, Math.min(2, devicePixelRatio || 1, Math.sqrt(12e6 / Math.max(1, W * H))));
    for (const c of [cv, base]) { c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr)); }
    cv.style.width = W + "px"; cv.style.height = H + "px"; dirty = true; frame();
  }

  /* ---------- rendering ---------- */
  const wOf = (s, q) => { if (!s.pr || s.br === "mono") return s.size; let w = s.size * (1 + (s.k ?? .8) * ((q[2] || .5) * 2 - 1) * .9); if (s.br === "pencil") w *= 1 + Math.min(1, q[3] || 0) * 1.1; return Math.max(.4, w); };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function varied(c, s, p, X) {
    if (p.length === 1) { c.beginPath(); c.arc(X(p[0]), p[0][1], wOf(s, p[0]) / 2, 0, 7); c.fill(); return; }
    let w = wOf(s, p[0]), ax = X(p[0]), ay = p[0][1];
    if (p.length === 2) { c.lineWidth = w; c.beginPath(); c.moveTo(ax, ay); c.lineTo(X(p[1]), p[1][1]); c.stroke(); return; }
    for (let i = 1; i < p.length - 1; i++) {
      w += (wOf(s, p[i]) - w) * .4; const mx = (X(p[i]) + X(p[i + 1])) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      c.lineWidth = w; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(X(p[i]), p[i][1], mx, my); c.stroke(); ax = mx; ay = my;
    }
    const l = p[p.length - 1]; c.lineWidth = w; c.beginPath(); c.moveTo(ax, ay); c.lineTo(X(l), l[1]); c.stroke();
  }
  function pencil(c, s, p, X) {
    const r = rng(s.sd || 7); c.globalAlpha = 1;
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[i], len = i ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0, n = Math.max(1, Math.ceil(len / 1.1));
      for (let k = 1; k <= n; k++) {
        const t = k / n, x = X(a) + (X(b) - X(a)) * t, y = a[1] + (b[1] - a[1]) * t, w = wOf(s, b), rad = w / 2 * (.55 + r() * .5);
        c.globalAlpha = (s.pr ? .1 + (b[2] || .5) * .28 : .24) * (.6 + r() * .6); c.beginPath(); c.arc(x + (r() - .5) * w * .5, y + (r() - .5) * w * .5, rad, 0, 7); c.fill();
      }
    }
  }
  function draw(c, s, extra) {
    const p = extra && extra.length ? s.pts.concat(extra) : s.pts, X = q => q[0] + cx();
    c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = s.size;
    if (s.type === "pen" || s.type === "hl") {
      if (s.type === "hl") {
        c.globalAlpha = .32; c.lineWidth = s.size * 4; c.lineCap = "butt";
        if (p.length === 1) { c.beginPath(); c.arc(X(p[0]), p[0][1], s.size * 2, 0, 7); c.fill(); }
        else { c.beginPath(); c.moveTo(X(p[0]), p[0][1]); for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(X(p[i]), p[i][1], (X(p[i]) + X(p[i + 1])) / 2, (p[i][1] + p[i + 1][1]) / 2); const l = p[p.length - 1]; c.lineTo(X(l), l[1]); c.stroke(); }
      } else if (s.br === "pencil") pencil(c, s, p, X);
      else varied(c, s, p, X);
    } else {
      const a = p[0], b = p[1] || p[0];
      if (s.type === "sticker") { c.font = `${s.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s.e, X(a), a[1]); }
      else if (s.type === "line" || s.type === "arrow") {
        c.beginPath(); c.moveTo(X(a), a[1]); c.lineTo(X(b), b[1]); c.stroke();
        if (s.type === "arrow") { const an = Math.atan2(b[1] - a[1], X(b) - X(a)), h = 12 + s.size * 2; c.beginPath(); c.moveTo(X(b), b[1]); c.lineTo(X(b) - h * Math.cos(an - .45), b[1] - h * Math.sin(an - .45)); c.moveTo(X(b), b[1]); c.lineTo(X(b) - h * Math.cos(an + .45), b[1] - h * Math.sin(an + .45)); c.stroke(); }
      } else if (s.type === "rect") c.strokeRect(Math.min(X(a), X(b)), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else if (s.type === "ellipse") { c.beginPath(); c.ellipse((X(a) + X(b)) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, 7); c.stroke(); }
      else if (s.type === "tri") { const t = triPts(s); c.beginPath(); t.forEach((q, i) => i ? c.lineTo(q[0] + cx(), q[1]) : c.moveTo(q[0] + cx(), q[1])); c.closePath(); c.stroke(); }
    }
    c.restore();
  }
  const triPts = s => { const [a, b] = s.pts, l = Math.min(a[0], b[0]), r = Math.max(a[0], b[0]), t = Math.min(a[1], b[1]), bt = Math.max(a[1], b[1]); return [[(l + r) / 2, t], [r, bt], [l, bt]]; };
  function bake() { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height); const k = K(); bctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); for (const s of st.strokes) if (!st.sel?.has(s)) draw(bctx, s); dirty = false; }
  function frame() {
    if (!W) return; if (dirty) bake();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr * K(), 0, 0, dpr * K(), 0, 0);
    if (st.sel) st.sel.forEach(s => draw(ctx, s));
    if (st.cur) draw(ctx, st.cur, st.pred);
    if (st.sel?.size) {
      const b = selBox(); if (b) {
        ctx.save(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.4; ctx.setLineDash([6, 5]); ctx.fillStyle = "rgba(0,0,0,.04)";
        const x = b[0] + cx() - 8, y = b[1] - 8, w = b[2] - b[0] + 16, h = b[3] - b[1] + 16; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + w, y + h, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    if (st.lasso && st.lasso.length > 1) { ctx.save(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); st.lasso.forEach((q, i) => i ? ctx.lineTo(q[0] + cx(), q[1]) : ctx.moveTo(q[0] + cx(), q[1])); ctx.stroke(); ctx.restore(); }
    const now = performance.now(); st.laser = st.laser.filter(q => now - q[2] < 750);
    if (st.laser.length) { ctx.save(); ctx.lineCap = "round"; for (let i = 1; i < st.laser.length; i++) { const a = st.laser[i - 1], b = st.laser[i], k = 1 - (now - b[2]) / 750; ctx.strokeStyle = `rgba(255,40,70,${Math.max(0, k)})`; ctx.shadowColor = "rgba(255,40,70,.8)"; ctx.shadowBlur = 12; ctx.lineWidth = 3 + 4 * k; ctx.beginPath(); ctx.moveTo(a[0] + cx(), a[1]); ctx.lineTo(b[0] + cx(), b[1]); ctx.stroke(); } const l = st.laser[st.laser.length - 1]; ctx.fillStyle = "rgba(255,40,70,.95)"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(l[0] + cx(), l[1], 6, 0, 7); ctx.fill(); ctx.restore(); sched(); }
  }
  const sched = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); }); };
  const render = () => { dirty = true; sched(); };           // full re-bake of the committed layer
  const selBox = () => { let b = null; st.sel.forEach(s => s.pts.forEach(q => { const r = s.type === "hl" ? s.size * 2 : s.type === "sticker" ? s.size * .6 : s.size; b = b ? [Math.min(b[0], q[0] - r), Math.min(b[1], q[1] - r), Math.max(b[2], q[0] + r), Math.max(b[3], q[1] + r)] : [q[0] - r, q[1] - r, q[0] + r, q[1] + r]; })); return b; };
  const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const setSel = set => { st.sel = set && set.size ? set : null; render(); updUI(); };
  const d2 = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)); };

  /* hold still at the end of a stroke → perfect line / circle / rectangle (like GoodNotes shape snapping) */
  let holdT = 0, last = [0, 0];
  let skipUp = false;
  const snapShape = () => {
    const c = st.cur; if (!c || c.type !== "pen" || c.pts.length < 8 || !S.snap) return; const p = c.pts, a = p[0], b = p[p.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]), bx = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], diag = Math.hypot(bx[2] - bx[0], bx[3] - bx[1]) || 1;
    /* closed loop around existing ink + hold → lasso selection instead of a shape */
    if (S.loopLasso !== false && diag > 30 && len < diag * .3) {
      const poly = p.map(q => [q[0], q[1]]), got = st.strokes.filter(x => x.pts.some(q => inPoly(poly, q[0], q[1])));
      if (got.length) { st.cur = null; st.pred = []; skipUp = true; setTool("lasso"); setSel(new Set(got)); if (navigator.vibrate) navigator.vibrate(8); sched(); return; }
    }
    const dev = Math.max(...p.map(q => d2(q[0], q[1], a, b)));
    if (len > 24 && dev < Math.max(6, len * .09)) { c.type = "line"; c.pts = [[a[0], a[1]], [b[0], b[1]]]; c.pr = false; }
    else if (len < diag * .3 && diag > 30) { const ex = (bx[0] + bx[2]) / 2, ey = (bx[1] + bx[3]) / 2, rx = (bx[2] - bx[0]) / 2 || 1, ry = (bx[3] - bx[1]) / 2 || 1, rad = p.map(q => Math.hypot((q[0] - ex) / rx, (q[1] - ey) / ry)), m = rad.reduce((x, y) => x + y, 0) / rad.length, v = Math.sqrt(rad.reduce((x, y) => x + (y - m) ** 2, 0) / rad.length);
      c.type = v < .13 ? "ellipse" : "rect"; c.pts = [[bx[0], bx[1]], [bx[2], bx[3]]]; c.pr = false; }
    else return; st.pred = []; sched(); if (navigator.vibrate) navigator.vibrate(8);
  };

  function hit(s, x, y, r) {
    const p = s.pts, rr = r + (s.type === "hl" ? s.size * 2 : s.size / 2);
    if (s.type === "pen" || s.type === "hl") return p.length === 1 ? Math.hypot(x - p[0][0], y - p[0][1]) < rr : p.some((q, i) => i && d2(x, y, p[i - 1], q) < rr);
    if (s.type === "sticker") return Math.hypot(x - p[0][0], y - p[0][1]) < s.size * .6 + r;
    if (s.type === "line" || s.type === "arrow") return d2(x, y, p[0], p[1]) < rr;
    if (s.type === "rect") { const [a, b] = p, k = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]; return k.some((q, i) => d2(x, y, q, k[(i + 1) % 4]) < rr); }
    if (s.type === "tri") { const k = triPts(s); return k.some((q, i) => d2(x, y, q, k[(i + 1) % 3]) < rr); }
    if (s.type === "ellipse") { const ex = (p[0][0] + p[1][0]) / 2, ey = (p[0][1] + p[1][1]) / 2, rx = Math.abs(p[1][0] - p[0][0]) / 2 || 1, ry = Math.abs(p[1][1] - p[0][1]) / 2 || 1; return Math.abs(Math.hypot((x - ex) / rx, (y - ey) / ry) - 1) * Math.min(rx, ry) < rr; }
    return false;
  }
  const snap = () => { st.hist.push([...st.strokes]); if (st.hist.length > 80) st.hist.shift(); st.redo = []; };
  const undo = () => { if (!st.hist.length) return; st.redo.push([...st.strokes]); st.strokes = st.hist.pop(); st.sel = null; render(); changed(); };
  const redo = () => { if (!st.redo.length) return; st.hist.push([...st.strokes]); st.strokes = st.redo.pop(); st.sel = null; render(); changed(); };
  const changed = () => { const mx = Math.max(0, ...st.strokes.flatMap(s => s.pts.map(q => q[1]))); onChange(st.strokes, mx); updUI(); };

  /* ---------- eraser: whole stroke or only the touched part ---------- */
  const dens = s => { const o = []; s.pts.forEach((q, i) => { if (i) { const a = s.pts[i - 1], n = Math.floor(Math.hypot(q[0] - a[0], q[1] - a[1]) / 4); for (let k = 1; k <= n; k++) { const t = k / (n + 1); o.push(a.map((v, j) => v + (q[j] - v) * t)); } } o.push(q); }); return o; };
  let lastE = null;
  function eraseAt(p) {      // walks the path between two events so fast strokes never skip over ink
    const a = lastE; lastE = p; if (!a) return eraseOne(p);
    const n = Math.min(60, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / Math.max(3, S.sizes.eraser / 3)));
    for (let k = 1; k <= n; k++) eraseOne([a[0] + (p[0] - a[0]) * k / n, a[1] + (p[1] - a[1]) * k / n]);
  }
  function eraseOne(p) {
    const r = S.sizes.eraser / 2, out = []; let any = false;
    for (const s of st.strokes) {
      if (!hit(s, p[0], p[1], r)) { out.push(s); continue; }
      if (S.eras === "point" && (s.type === "pen" || s.type === "hl")) {
        const pts = dens(s), run = []; const runs = [run]; let cut = false;
        for (const q of pts) { if (Math.hypot(q[0] - p[0], q[1] - p[1]) < r + (s.type === "hl" ? s.size * 2 : s.size / 2)) { cut = true; if (run.length || runs[runs.length - 1].length) runs.push([]); } else runs[runs.length - 1].push(q); }
        if (!cut) { out.push(s); continue; }
        any = true; runs.filter(a => a.length > 1).forEach(a => out.push({ ...s, pts: a }));
      } else any = true;
    }
    if (any) { st.strokes = out; erased = true; render(); }
  }

  /* ---------- pointer input ---------- */
  let drawing = false, erased = false, pid = -1, rc = null, sm = [0, 0, .5, 0];
  const SHAPES = ["line", "arrow", "rect", "ellipse", "tri"];
  const pos = (e, r = rc || cv.getBoundingClientRect()) => { const k = K(); return [(e.clientX - r.left - r.width / 2) / k, (e.clientY - r.top) / k]; };
  const effTool = e => (e.pointerType === "pen" && (e.button === 5 || (e.buttons & 32) || e.button === 2 || (e.buttons & 2))) ? "eraser" : null;
  const tiltOf = e => Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 90);

  /* finger handling: scroll the page by hand (the canvas must keep touch-action:none so Apple Pencil never scrolls) */
  const tp = new Map(); let gmax = 0, gt = 0, gmove = 0, scroller = null, vel = 0, velX = 0, lastT = 0, momentum = 0;
  const findScroller = () => { for (let n = paper.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n; } return document.scrollingElement; };
  const fingerAllowed = () => !(st.penSeen || S.penOnly);
  function touchDown(e) {
    cancelAnimationFrame(momentum);
    if (!tp.size) { gmax = 0; gt = e.timeStamp; gmove = 0; scroller = null; }
    tp.set(e.pointerId, { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }); gmax = Math.max(gmax, tp.size);
    if (tp.size > 1 && drawing && st.cur) abort();
  }
  function touchMove(e) {
    const o = tp.get(e.pointerId); if (!o) return; const dx = e.clientX - o.x, dy = e.clientY - o.y; o.x = e.clientX; o.y = e.clientY; gmove = Math.max(gmove, Math.hypot(e.clientX - o.sx, e.clientY - o.sy));
    if (fingerAllowed() && drawing) return;                          // drawing with a finger
    if (tp.size > 1 || gmove < 6) return;
    scroller ||= findScroller(); if (!scroller) return; scroller.scrollTop -= dy; scroller.scrollLeft -= dx;
    const dt = Math.max(1, e.timeStamp - lastT); lastT = e.timeStamp; vel = vel * .6 + (-dy / dt) * .4; velX = velX * .6 + (-dx / dt) * .4;
  }
  function touchUp(e) {
    if (!tp.delete(e.pointerId)) return;
    if (!tp.size) {
      if (gmax >= 2 && e.timeStamp - gt < 450 && gmove < 16) { if (gmax === 2) undo(); else if (gmax === 3) redo(); }
      else if (scroller && Math.abs(vel) > .15 && e.type === "pointerup") { const sc = scroller; let v = vel, vx = velX, t0 = performance.now(); const step = t => { const dt = Math.min(40, t - t0); t0 = t; sc.scrollTop += v * dt; sc.scrollLeft += vx * dt; v *= .95; vx *= .95; if (Math.abs(v) > .02 || Math.abs(vx) > .02) momentum = requestAnimationFrame(step); }; momentum = requestAnimationFrame(step); }
      vel = velX = 0; scroller = null;
    }
  }
  function abort() { if (!drawing) return; drawing = false; clearTimeout(holdT); if (tl() === "eraser" && !erased) st.hist.pop(); if (tl() === "eraser" && erased) changed(); st.cur = null; st.pred = []; st.lasso = null; st.moving = st.scaling = null; st.tmp = null; sched(); }

  const hoverRing = e => {
    const t = tl(); if (!st.on || e.pointerType === "touch" || !["pen", "hl", "eraser"].includes(t)) return ring.classList.remove("on");
    const dia = (t === "hl" ? S.sizes.hl * 4 : t === "eraser" ? S.sizes.eraser : Math.max(4, S.sizes.pen)) * K(), r = cv.getBoundingClientRect();
    ring.className = "ink-ring on" + (t === "eraser" ? " er" : ""); ring.style.width = ring.style.height = dia + "px";
    ring.style.transform = `translate(${e.clientX - r.left - dia / 2}px,${e.clientY - r.top - dia / 2}px)`;
    ring.style.background = t === "eraser" ? "" : st.color + (t === "hl" ? "55" : "99");
  };
  cv.addEventListener("pointerleave", () => ring.classList.remove("on"));
  cv.addEventListener("contextmenu", e => e.preventDefault());
  const unguard = penGuard(cv, () => st.on);

  cv.addEventListener("pointerdown", e => {
    if (!st.on || st.tool === "hand") return;
    if (e.pointerType === "pen") st.penSeen = true;
    if (e.pointerType === "touch") { touchDown(e); if (!fingerAllowed()) { try { cv.setPointerCapture(e.pointerId); } catch {} return; } }
    if (drawing) return;
    if (e.button > 0 && e.button !== 5 && !(e.pointerType === "pen" && e.button === 2)) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} pid = e.pointerId; rc = cv.getBoundingClientRect();
    st.tmp = effTool(e); const t = tl();
    const p = pos(e); drawing = true; clearTimeout(holdT); closePop();
    if (t === "laser") { st.laser = [[p[0], p[1], performance.now()]]; sched(); return; }
    if (t === "lasso") {
      const b = st.sel?.size ? selBox() : null;
      if (b && Math.hypot(p[0] - (b[2] + 8), p[1] - (b[3] + 8)) < 18) {          // scale handle
        snap(); const m = new Map(); st.strokes = st.strokes.map(x => { if (!st.sel.has(x)) return x; const n = { ...x, pts: x.pts.map(q => [...q]) }; m.set(x, n); return n; }); st.sel = new Set(m.values());
        st.scaling = { o: [...st.sel].map(s => s.pts.map(q => [...q])), ax: b[0], ay: b[1], w: Math.max(10, b[2] - b[0]), h: Math.max(10, b[3] - b[1]), list: [...st.sel], os: [...st.sel].map(s => s.size) }; return;
      }
      if (b && p[0] > b[0] - 10 && p[0] < b[2] + 10 && p[1] > b[1] - 10 && p[1] < b[3] + 10) {
        snap(); const repl = new Map(); st.strokes = st.strokes.map(x => { if (!st.sel.has(x)) return x; const n = { ...x, pts: x.pts.map(q => [...q]) }; repl.set(x, n); return n; }); st.sel = new Set(repl.values()); st.moving = p; return;
      }
      st.sel = null; st.lasso = [[p[0], p[1]]]; render(); return;
    }
    if (t === "eraser") { snap(); erased = false; lastE = null; eraseAt(p); hoverRing(e); return; }
    const isHl = t === "hl", shape = t === "shape";
    sm = [p[0], p[1], e.pointerType === "pen" ? (e.pressure || .5) : .5, tiltOf(e)];
    st.cur = { type: shape ? S.shape : t, color: isHl && st.color === "#ffffff" ? "#ffe600" : st.color, size: shape ? S.sizes.shape : S.sizes[t], pts: [[p[0], p[1], sm[2], sm[3]]], pr: e.pointerType === "pen" };
    if (!shape && !isHl) { st.cur.br = S.brush; st.cur.k = S.press; if (S.brush === "pencil") st.cur.sd = (Math.random() * 1e9) | 0; }
    { const at = opts.audio?.clock?.(); if (at != null) { st.cur.t = at; st.cur.a = opts.audio.id; } }
    if (shape) st.cur.pts.push([p[0], p[1]]);
    st.pred = []; hoverRing(e); sched();
  });
  cv.addEventListener("pointermove", e => {
    if (e.pointerType === "pen") st.penSeen = true;
    if (e.pointerType === "touch") touchMove(e);
    if (!drawing) { hoverRing(e); return; }
    if (e.pointerId !== pid) return;
    const t = tl(), evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e], a = 1 - S.smooth * .85;
    for (const ev of (evs.length ? evs : [e])) {
      const p = pos(ev);
      if (t === "laser") { st.laser.push([p[0], p[1], performance.now()]); continue; }
      if (t === "lasso") {
        if (st.scaling) { const g = st.scaling, f = Math.max(.1, ((p[0] - g.ax) / g.w + (p[1] - g.ay) / g.h) / 2); g.list.forEach((s, i) => { if (s.type === "sticker") s.size = Math.max(14, g.os[i] * f); s.pts.forEach((q, j) => { q[0] = g.ax + (g.o[i][j][0] - g.ax) * f; q[1] = g.ay + (g.o[i][j][1] - g.ay) * f; }); }); }
        else if (st.moving) { const dx = p[0] - st.moving[0], dy = p[1] - st.moving[1]; st.sel.forEach(x => x.pts.forEach(q => { q[0] += dx; q[1] += dy; })); st.moving = p; }
        else if (st.lasso) st.lasso.push([p[0], p[1]]);
        continue;
      }
      if (t === "eraser") { eraseAt(p); continue; }
      if (!st.cur) continue;
      if (SHAPES.includes(st.cur.type)) { st.cur.pts[1] = [p[0], p[1]]; continue; }
      const pr = e.pointerType === "pen" ? (ev.pressure || .5) : .5;
      sm[0] += (p[0] - sm[0]) * a; sm[1] += (p[1] - sm[1]) * a; sm[2] += (pr - sm[2]) * .5; sm[3] += (tiltOf(ev) - sm[3]) * .4;
      const lp = st.cur.pts[st.cur.pts.length - 1];
      if (Math.hypot(sm[0] - lp[0], sm[1] - lp[1]) >= .6) st.cur.pts.push([sm[0], sm[1], sm[2], sm[3]]);
    }
    /* predicted points make the ink follow the Pencil tip with less visible lag */
    st.pred = [];
    if (st.cur && !SHAPES.includes(st.cur.type) && e.getPredictedEvents) for (const ev of e.getPredictedEvents().slice(0, 3)) { const p = pos(ev); st.pred.push([p[0], p[1], sm[2], sm[3]]); }
    hoverRing(e); sched();
    if (st.cur && st.cur.type === "pen" && S.snap) { const p = pos(e); if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 2) { last = p; clearTimeout(holdT); holdT = setTimeout(snapShape, 520); } }
  });
  /* scribble over ink (zigzag) → erases what it crosses, like GoodNotes "scribble to erase" */
  function isScribble(s) {
    const p = s.pts; if (s.type !== "pen" || p.length < 14) return false;
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), m = Math.max(w, h);
    if (m < 24 || m > 280) return false;
    let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (L < m * 3.2) return false;
    const k = w >= h ? 0 : 1; let dir = 0, ex = p[0][k], rev = 0;
    for (const q of p) { const v = q[k]; if (dir <= 0 && v - ex > 10) { if (dir < 0) rev++; dir = 1; ex = v; } else if (dir >= 0 && ex - v > 10) { if (dir > 0) rev++; dir = -1; ex = v; } else if (dir > 0 && v > ex) ex = v; else if (dir < 0 && v < ex) ex = v; }
    return rev >= 4;
  }
  const up = e => {
    if (e.pointerType === "touch") touchUp(e);
    if (!drawing || (e.pointerId !== undefined && e.pointerId !== pid)) return; drawing = false; clearTimeout(holdT); const t = tl(); st.tmp = null; st.pred = [];
    if (skipUp) { skipUp = false; st.cur = null; sched(); return; }
    if (t === "laser") { sched(); return; }
    if (t === "lasso") {
      if (st.scaling) { st.scaling = null; sched(); changed(); return; }
      if (st.moving) { st.moving = null; sched(); changed(); return; }
      const poly = st.lasso || []; st.lasso = null; const got = poly.length > 3 ? st.strokes.filter(x => x.pts.some(q => inPoly(poly, q[0], q[1]))) : []; setSel(got.length ? new Set(got) : null); return;
    }
    if (t === "eraser") { if (!erased) st.hist.pop(); else changed(); return; }
    if (st.cur) {
      const s = st.cur; st.cur = null;
      if (SHAPES.includes(s.type) && Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) < 3) { sched(); return; }
      if (e.type === "pointerup" && !SHAPES.includes(s.type) && s.type !== "line" && s.pts.length > 1 && s.pts !== undefined) { const r = e.clientX !== undefined ? pos(e) : null; if (r) { const l = s.pts[s.pts.length - 1]; if (Math.hypot(r[0] - l[0], r[1] - l[1]) > .8) s.pts.push([r[0], r[1], l[2], l[3]]); } }
      if (S.scribble !== false && isScribble(s)) {
        const gone = new Set(st.strokes.filter(x => s.pts.some(q => hit(x, q[0], q[1], 4))));
        if (gone.size) { snap(); st.strokes = st.strokes.filter(x => !gone.has(x)); render(); changed(); if (navigator.vibrate) navigator.vibrate(8); return; }
      }
      snap(); st.strokes.push(s); if (!dirty) { bctx.setTransform(dpr * K(), 0, 0, dpr * K(), 0, 0); draw(bctx, s); } sched(); changed();
    }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", e => { if (e.pointerType === "touch") touchUp(e); if (drawing && e.pointerId === pid) abort(); });

  /* ---------- palette ---------- */
  const shapeIc = () => ic(INK_SHAPE_IC[S.shape] || "arrow");
  const pal = document.createElement("div"); pal.className = "inkpal";
  pal.innerHTML = `<div class="ip-row">${INK_TOOLS.map(([k, t, i]) => k === "pen" ? `<span class="ip-pens" id="ip-pens"></span>` : `<button class="tbtn" data-t="${k}" title="${t}" aria-label="${t}">${k === "shape" ? shapeIc() : ic(i)}</button>`).join("")}</div>
  <i class="ip-sep"></i><div class="ip-cols">${INK_COL.map(c => `<button class="cdot" data-c="${c}" style="background:${c}" aria-label="Farbe"></button>`).join("")}<label class="cdot pick" title="Eigene Farbe"><input type="color" id="ip-cc" value="#2563eb"></label></div>
  <i class="ip-sep"></i><input type="range" id="ip-sz" min="1" max="24" value="4" aria-label="Strichstärke">
  <i class="ip-sep"></i><div class="ip-row"><button class="tbtn" id="ip-stk" title="Sticker" aria-label="Sticker">${ic("star")}</button>${opts.audio ? `<button class="tbtn" id="ip-mic" title="Audio aufnehmen" aria-label="Audio aufnehmen">${ic("mic")}</button>` : ""}<button class="tbtn" id="ip-un" title="Rückgängig (Zwei-Finger-Tipp)" aria-label="Rückgängig">${ic("undo")}</button><button class="tbtn" id="ip-re" title="Wiederholen (Drei-Finger-Tipp)" aria-label="Wiederholen">${ic("redo")}</button><button class="tbtn" id="ip-dup" title="Auswahl duplizieren" aria-label="Duplizieren" hidden>${ic("copy")}</button><button class="tbtn" id="ip-cl" title="Zeichnung leeren" aria-label="Zeichnung leeren">${ic("trash")}</button><button class="tbtn" id="ip-set" title="Zeichen-Einstellungen" aria-label="Zeichen-Einstellungen">${ic("gear")}</button></div>`;
  (opts.bar || document.body).appendChild(pal);
  const $p = s => pal.querySelector(s), $$p = s => [...pal.querySelectorAll(s)];

  let pop = null, popFor = "";
  function closePop() { pop?.remove(); pop = null; popFor = ""; $p("#ip-set")?.classList.remove("on"); }
  const chip = (k, v, on, t) => `<button class="ink-chip${on ? " on" : ""}" data-k="${k}:${v}">${t}</button>`;
  function popHtml(kind) {
    if (kind === "pen") return `<b>Stift ${S.pen + 1}</b><div class="ink-chips">${INK_BRUSH.map(([v, t]) => chip("brush", v, S.brush === v, t)).join("")}</div><div class="ink-chips">${S.pens.length < 8 ? chip("penadd", "1", false, "Neuer Stift") : ""}${S.pens.length > 1 ? chip("penrm", "1", false, "Diesen Stift löschen") : ""}</div>`;
    if (kind === "stk") return `<b>Sticker</b><div class="ink-chips ink-stk">${INK_STICKERS.map(e => chip("stk", e, false, e)).join("")}</div>`;
    if (kind === "shape") return `<b>Form</b><div class="ink-chips">${INK_SHAPE.map(([v, t]) => chip("shape", v, S.shape === v, t)).join("")}</div>`;
    if (kind === "eraser") return `<b>Radierer</b><div class="ink-chips">${chip("eras", "stroke", S.eras === "stroke", "Ganzer Strich")}${chip("eras", "point", S.eras === "point", "Nur berührte Stelle")}</div>`;
    if (kind === "gear") return `<b>Zeichnen</b><label class="ink-rg"><span>Glättung</span><input type="range" min="0" max="100" value="${Math.round(S.smooth * 100)}" data-r="smooth"></label>
      <label class="ink-rg"><span>Druckempfindlichkeit</span><input type="range" min="0" max="100" value="${Math.round(S.press * 100)}" data-r="press"></label>
      <div class="ink-chips">${chip("penOnly", S.penOnly ? "0" : "1", S.penOnly, "Nur Stift zeichnet")}${chip("snap", S.snap ? "0" : "1", S.snap, "Formen erkennen")}${chip("scribble", S.scribble === false ? "1" : "0", S.scribble !== false, "Kritzeln löscht")}${chip("loopLasso", S.loopLasso === false ? "1" : "0", S.loopLasso !== false, "Umkreisen wählt aus")}</div>
      ${opts.grid ? `<b>Papier</b><div class="ink-chips">${[["none", "Leer"], ["grid", "Karo"], ["lines", "Linien"], ["dots", "Punkte"], ["cornell", "Cornell"], ["week", "Woche"]].map(([v, t]) => chip("grid", v, S.grid === v, t)).join("")}</div>` : ""}
      <small>Zwei-Finger-Tipp: Rückgängig · Drei-Finger-Tipp: Wiederholen · Stift-Radierer und Stift-Taste radieren</small>`;
    return "";
  }
  function openPop(kind, anchor) {
    const same = pop && popFor === kind; closePop(); if (same || !popHtml(kind)) return;
    popFor = kind; pop = document.createElement("div"); pop.className = "ink-pop"; pop.innerHTML = popHtml(kind); document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth; pop.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2)) + "px"; pop.style.top = r.bottom + 10 + "px";
    if (kind === "gear") anchor.classList.add("on");
    pop.addEventListener("pointerdown", ev => ev.stopPropagation());
    pop.addEventListener("click", ev => { const b = ev.target.closest("[data-k]"); if (!b) return; const [k, v] = b.dataset.k.split(":");
      if (k === "stk") { addSticker(v); closePop(); return; }
      if (k === "brush") { S.brush = v; S.pens[S.pen].brush = v; paintPens(); } else if (k === "penadd") { S.pens.push({ ...S.pens[S.pen] }); S.pen = S.pens.length - 1; applyPen(); paintPens(); } else if (k === "penrm") { S.pens.splice(S.pen, 1); S.pen = 0; applyPen(); paintPens(); } else if (k === "shape") { S.shape = v; refreshShapeIc(); } else if (k === "eras") S.eras = v; else if (k === "penOnly") S.penOnly = v === "1"; else if (k === "snap") S.snap = v === "1"; else if (k === "scribble") S.scribble = v === "1"; else if (k === "loopLasso") S.loopLasso = v === "1"; else if (k === "grid") { S.grid = v; applyGrid(); }
      saveS(); pop.innerHTML = popHtml(kind); rangeBind(); updUI(); });
    const rangeBind = () => pop?.querySelectorAll("[data-r]").forEach(i => i.oninput = () => { S[i.dataset.r] = +i.value / 100; saveS(); }); rangeBind();
  }
  const outside = e => { if (pop && !pop.contains(e.target) && !pal.contains(e.target)) closePop(); };
  document.addEventListener("pointerdown", outside, true);
  const refreshShapeIc = () => { const b = $p('[data-t="shape"]'); if (b) b.innerHTML = shapeIc(); };
  function applyGrid() { if (opts.grid) paper.dataset.grid = S.grid; }

  function applyTA() { cv.style.touchAction = "none"; }
  function setTool(t, keepPop) {
    if (t !== "lasso" && st.sel) setSel(null);
    st.tool = t; S.tool = t; if (!keepPop) closePop();
    $$p("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === t && (b.dataset.slot === undefined || +b.dataset.slot === S.pen)));
    applyTA(); cv.style.pointerEvents = st.on && t !== "hand" ? "auto" : "none"; cv.style.cursor = t === "eraser" ? "cell" : t === "lasso" ? "default" : "crosshair"; ring.classList.remove("on"); updUI(); saveS();
  }
  function setColor(c, noPrefs) {
    if (st.sel?.size && !noPrefs) { snap(); const m = new Map(); st.strokes = st.strokes.map(x => { if (!st.sel.has(x)) return x; const n = { ...x, color: c }; m.set(x, n); return n; }); st.sel = new Set(m.values()); render(); changed(); }
    st.color = c; S.color = c; if (!noPrefs && tl() === "pen" && S.pens[S.pen]) { S.pens[S.pen].color = c; paintPens(); } saveS(); $$p("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === c)); if (tl() === "eraser" || tl() === "hand") setTool("pen");
  }
  function updUI() {
    $p("#ip-un").disabled = !st.hist.length; $p("#ip-re").disabled = !st.redo.length; const has = !!st.sel?.size; $p("#ip-cl").disabled = !st.strokes.length && !has; $p("#ip-cl").title = has ? "Auswahl löschen" : "Zeichnung leeren"; $p("#ip-cl").classList.toggle("sel", has); $p("#ip-dup").hidden = !has;
    const k = sizeKey(), z = $p("#ip-sz"); z.min = k === "eraser" ? 8 : 1; z.max = k === "eraser" ? 80 : k === "hl" ? 14 : 24; z.value = S.sizes[k]; z.disabled = ["lasso", "laser", "hand"].includes(st.tool);
  }
  function applyPen() { const p = S.pens[S.pen] || (S.pen = 0, S.pens[0]); S.brush = p.brush; S.sizes.pen = p.size; st.color = p.color; S.color = p.color; $$p("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === p.color)); updUI(); }
  function paintPens() {
    const box = $p("#ip-pens"); box.innerHTML = S.pens.map((p, i) => `<button class="tbtn ip-pen" data-t="pen" data-slot="${i}" title="Stift ${i + 1} – nochmal tippen für Einstellungen" aria-label="Stift ${i + 1}">${ic(p.brush === "pencil" ? "pen" : "brush")}<i style="background:${p.color}"></i></button>`).join("");
    $$p("[data-slot]").forEach(b => { b.classList.toggle("on", st.tool === "pen" && +b.dataset.slot === S.pen); b.onclick = () => { const i = +b.dataset.slot; if (st.tool === "pen" && S.pen === i) openPop("pen", b); else { S.pen = i; applyPen(); setTool("pen"); } }; });
  }
  $$p("[data-t]:not([data-slot])").forEach(b => b.onclick = () => { const t = b.dataset.t; if (st.tool === t && ["eraser", "shape"].includes(t)) openPop(t, b); else { setTool(t); } });
  $$p("[data-c]").forEach(b => b.onclick = () => setColor(b.dataset.c));
  $p("#ip-cc").oninput = e => { setColor(e.target.value); $$p("[data-c]").forEach(b => b.classList.remove("on")); };
  $p("#ip-sz").oninput = e => { S.sizes[sizeKey()] = +e.target.value; if (sizeKey() === "pen" && S.pens[S.pen]) S.pens[S.pen].size = +e.target.value; saveS(); };
  $p("#ip-un").onclick = undo; $p("#ip-re").onclick = redo;
  $p("#ip-set").onclick = e => openPop("gear", e.currentTarget);
  $p("#ip-stk").onclick = e => openPop("stk", e.currentTarget);
  if (opts.audio) $p("#ip-mic").onclick = () => opts.audio.toggle();
  /* sticker: an emoji placed at the visible centre, immediately selected so it can be moved / scaled with the lasso */
  function addSticker(e) {
    const r = paper.getBoundingClientRect(), k = K(), y = Math.max(40, Math.min(H / k - 40, (innerHeight / 2 - r.top) / k)), s = { type: "sticker", e, color: "#000", size: 56, pts: [[0, y]] };
    const t = opts.audio?.clock?.(); if (t != null) { s.t = t; s.a = opts.audio.id; }
    snap(); st.strokes.push(s); setTool("lasso"); setSel(new Set([s])); changed();
  }
  /* double-tap ink written during a recording (select / laser tool) → jump the audio to that moment */
  cv.addEventListener("dblclick", e => {
    if (!opts.audio?.seek || !["lasso", "laser"].includes(st.tool)) return; const p = pos(e, cv.getBoundingClientRect());
    for (let i = st.strokes.length - 1; i >= 0; i--) { const s = st.strokes[i]; if (s.t != null && hit(s, p[0], p[1], 10)) { opts.audio.seek(s.t, s.a); return; } }
  });
  $p("#ip-dup").onclick = () => { if (!st.sel?.size) return; snap(); const cl = [...st.sel].map(x => ({ ...x, pts: x.pts.map(q => [q[0] + 24, q[1] + 24, ...q.slice(2)]) })); st.strokes.push(...cl); setSel(new Set(cl)); changed(); };
  $p("#ip-cl").onclick = async () => { if (st.sel?.size) { snap(); st.strokes = st.strokes.filter(x => !st.sel.has(x)); st.sel = null; render(); changed(); return; } if (st.strokes.length && await confirmBox("Alle Zeichnungen in diesem Dokument löschen? Der Text bleibt erhalten.", "Löschen")) { snap(); st.strokes = []; render(); changed(); } };

  const key = e => {
    if (!st.on) return; const tag = e.target.tagName; if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && st.sel?.size) { e.preventDefault(); $p("#ip-dup").click(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = { p: "pen", h: "hl", e: "eraser", a: "shape", s: "lasso", x: "laser", v: "hand" }[e.key.toLowerCase()];
      if (k) { if (k === "shape") { S.shape = "arrow"; refreshShapeIc(); } setTool(k); }
      else if (e.key === "Escape") { closePop(); if (st.sel) setSel(null); }
      else if ((e.key === "Delete" || e.key === "Backspace") && st.sel?.size) { e.preventDefault(); $p("#ip-cl").click(); }
      else if (e.key === "[" || e.key === "]") { const kk = sizeKey(), z = $p("#ip-sz"); S.sizes[kk] = Math.max(+z.min, Math.min(+z.max, S.sizes[kk] + (e.key === "]" ? 1 : -1) * (kk === "eraser" ? 4 : 1))); updUI(); saveS(); }
      else if (/^[1-8]$/.test(e.key)) setColor(INK_COL[+e.key - 1]);
    }
  };
  document.addEventListener("keydown", key);
  const ro = new ResizeObserver(size); ro.observe(paper); if (paper.firstElementChild) ro.observe(paper.querySelector(".body") || paper.firstElementChild);

  applyPen(); paintPens(); setColor(st.color, true); setTool(st.tool); applyGrid(); updUI();
  return {
    st, canvas: cv,
    tool(t) { setTool(t); },
    relayout() { W = 0; size(); },
    mic(on) { $p("#ip-mic")?.classList.toggle("on", !!on); },
    load(strokes) { st.strokes = Array.isArray(strokes) ? strokes : []; st.sel = null; size(); dirty = true; frame(); updUI(); },
    mode(on) { st.on = !!on; paper.classList.toggle("inking", !!on); setTool(st.tool); pal.classList.toggle("show", !!on); if (!on) { closePop(); abort(); ring.classList.remove("on"); } },
    /* white image of the sketch (+ text) for the AI */
    snapshot() { frame(); const t = document.createElement("canvas"), s = Math.min(1, 1400 / W); t.width = W * s; t.height = H * s; const c = t.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, t.width, t.height); c.drawImage(cv, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", .85).split(",")[1]; },
    destroy() { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside, true); unguard(); cancelAnimationFrame(raf); cancelAnimationFrame(momentum); ro.disconnect(); closePop(); pal.remove(); ring.remove(); },
  };
}
