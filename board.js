"use strict";
/* Studix whiteboard – vector drawing with pen, highlighter, eraser, shapes, text, images, undo/redo */

V.board = m => {
  const draws = D.docs.filter(d => d.type === "draw").sort((a, b) => b.updated - a.updated);
  m.innerHTML = `<div class="page">${pageHead("<b>Zeichnen</b>", dkAct("plus", "Neue Zeichnung", 'id="nw"'))}
  ${draws.length ? `<div class="docgrid">${draws.map(docCard).join("")}</div>` : `<div class="emptybox"><div class="big-ic">${ic("brush")}</div><h3>Dein digitales Whiteboard</h3><p>Zeichne mit Finger, Maus oder Apple Pencil: Stift, Marker, Radierer, Formen, Text und Bilder. Perfekt für Mathe-Skizzen, Mindmaps und Tafelbilder.</p><button class="btn accent big" id="nw2">Los zeichnen</button></div>`}</div>`;
  $("#nw", m).onclick = () => docDialog("draw"); $("#nw2", m) && ($("#nw2", m).onclick = () => docDialog("draw")); bindCommon(m);
};

V.draw = async (m, id) => {
  if (id === "new") { if (limitHit("board")) return go("board"); const nid = uid(); D.docs.unshift({ id: nid, type: "draw", title: "Neue Zeichnung", subjectId: subjectOfFolder(docFolder), folderId: docFolder, updated: Date.now(), created: Date.now(), thumb: "" }); await KV.set("draw:" + nid, { strokes: [], bg: "grid", H: 1000 }); save(); return go("draw/" + nid); }
  const d = D.docs.find(x => x.id === id); if (!d || d.type !== "draw") return go("board");
  const saved = (await KV.get("draw:" + id)) || { strokes: [], bg: "grid", H: 1000 };
  const W = saved.W || 1600, FMT = "endless"; const st = { cam: saved.cam || { x: -40, y: -40, z: 1 }, strokes: saved.strokes || [], objs: saved.objs || [], hist: [], redo: [], tool: "pen", color: saved.bg === "dark" ? "#ffffff" : "#111111", size: 4, bg: saved.bg || "grid", H: saved.H || 1000, cur: null, penSeen: false, pending: null };
  const COL = ["#111111", "#4b5563", "#9ca3af", "#e5484d", "#f59e0b", "#eab308", "#16a34a", "#0d9488", "#2563eb", "#7c3aed", "#ec4899", "#92400e", "#ffffff"], HLCOL = ["#ffe600", "#7ee787", "#ff9ecb", "#7cc4ff", "#ffb066"];
  const TOOLS = [["hand", "Auswählen / Verschieben (V)", "cursor"], ["pen", "Stift (P)", "pen"], ["hl", "Marker (H)", "hl"], ["eraser", "Radierer (E)", "eraser"], ["line", "Linie (L)", "line"], ["arrow", "Pfeil (A)", "arrow"], ["rect", "Rechteck (R)", "square"], ["ellipse", "Ellipse (O)", "circle"], ["text", "Text (T)", "text"], ["img", "Bild einfügen", "image"]];
  m.classList.add("doc-full");
  const fp = folderPath(d.folderId);
  const T = Object.fromEntries(TOOLS.map(([k, t, i]) => [k, [t, i]])), tb = k => `<button class="tbtn ${k === st.tool ? "on" : ""}" data-t="${k}" title="${T[k][0]}" aria-label="${T[k][0]}">${ic(T[k][1])}</button>`;
  m.innerHTML = `<div class="editor board dfull bd2"><div class="bd-stage"><div class="cvwrap inf" id="cvw"><canvas id="cv"></canvas><input class="texti" id="ti" hidden><input type="file" id="fi" accept="image/*" hidden><select id="bg" hidden><option value="blank">Weiß</option><option value="lines">Liniert</option><option value="grid">Kariert</option><option value="dots">Punkte</option><option value="dark">Tafel</option></select><button id="cl" hidden></button></div>
  <div class="bd-fl bd-bar" id="bar"><button class="bd-ib" id="eb" aria-label="Zurück" title="Zurück">${ic("back")}</button><button class="bd-ttl" id="tt" aria-haspopup="true" aria-expanded="false"><span class="bd-th">${d.thumb ? `<img src="${d.thumb}" alt="">` : ic("brush")}</span><b id="ttx">${esc(d.title)}</b>${ic("chev")}</button><i class="bd-vs"></i><button class="bd-ib" id="addo" title="Elemente, Sticker und Symbole" aria-label="Elemente">${ic("plus")}<span>Elemente</span></button><button class="bd-ib" id="fr" title="Rahmen einfügen" aria-label="Rahmen">${ic("hash")}</button><button class="bd-ib" id="fit" title="Alles anzeigen" aria-label="Alles anzeigen">${ic("full")}</button><button class="bd-ib" id="mo-m" title="Mehr" aria-label="Mehr">${ic("more")}</button><i class="bd-vs"></i><i class="bd-vs"></i><button class="bd-ai2" id="ai-m" title="Studix AI" aria-label="Studix AI"><i class="bd-ailogo"></i></button><button class="bd-col" id="cob" aria-haspopup="true" aria-expanded="false"><span class="bd-avs"><span class="bd-me" style="background:${meCol()}">${esc(coIni(coName()))}</span><span class="bd-me inv">${ic("plus")}</span></span>${ic("chev")}</button><span class="saved" id="sv">Gespeichert</span>
  <input id="et" value="${esc(d.title)}" hidden><button id="exp" hidden></button><button id="done" hidden></button><button id="shb" hidden></button></div>
  <div class="bd-pop bd-panel" id="pnl" hidden></div><div class="bd-pop el-panel" id="elp" hidden></div><div class="bd-pop bd-colm" id="colm" hidden></div>
  <div class="bd-tools" role="toolbar" aria-label="Werkzeuge">${tb("hand")}${tb("pen")}${tb("hl")}${tb("eraser")}<i class="sep"></i><div class="bd-grp"><button class="tbtn" id="shp" title="Formen und Linien" aria-label="Formen">${ic("square")}<b class="cor"></b></button><div class="bd-fly" id="fly" hidden>${["rect", "ellipse", "line", "arrow"].map(tb).join("")}</div></div>${tb("text")}<button class="tbtn" id="qs" title="Haftnotiz" aria-label="Haftnotiz">${ic("note")}</button>${tb("img")}<i class="sep"></i><button class="tbtn" id="colb" title="Farbe" aria-label="Farbe" hidden><i class="cprev"></i></button><button class="tbtn" id="szb" title="Stärke" aria-label="Stärke" hidden><i class="sprev"></i></button><i class="sep" id="sep2" hidden></i><button class="tbtn" id="un" title="Rückgängig (Strg+Z)" aria-label="Rückgängig">${ic("undo")}</button><button class="tbtn" id="re" title="Wiederholen (Strg+Umschalt+Z)" aria-label="Wiederholen">${ic("redo")}</button></div>
  <div class="bd-prop" id="prop" hidden></div>
  <div class="bd-fl bd-bl"><button class="bd-ib" id="bgb" title="Hintergrund" aria-label="Hintergrund">${ic("hash")}</button></div>
  <div class="bd-br"><div class="bd-fl bzoom"><button class="bd-ib" id="zo" aria-label="Verkleinern">−</button><button class="bd-z" id="zp" title="Auf 100 % / Inhalt zeigen">100 %</button><button class="bd-ib" id="zi" aria-label="Vergrößern">+</button><i class="bd-vs"></i><button class="bd-ib" id="hp" title="Tastenkürzel" aria-label="Hilfe">?</button></div></div></div></div>`;
  $$("[data-p]", m).forEach(x => x.onclick = () => go("docs/" + x.dataset.p));
  const cv = $("#cv", m), mctx = cv.getContext("2d"); let ctx = mctx; const cvw = $("#cvw", m), cam = st.cam; let dpr = 1, VW = 800, VH = 600; const imgs = new WeakMap(), titleEl = $("#et", m), savedEl = $("#sv", m);
  $("#bg", m).value = st.bg;
  const hexA = (c, a) => c; let OBJ = null;

  /* drawing primitives */
  function bgDraw(vx, vy, vw, vh) {
    const dk = st.bg === "dark"; ctx.fillStyle = dk ? "#1d2523" : "#fff"; ctx.fillRect(vx, vy, vw, vh); ctx.strokeStyle = dk ? "#2c3835" : "#e9ebf2"; ctx.fillStyle = dk ? "#3a4743" : "#cfd4df"; ctx.lineWidth = 1 / cam.z;
    const g = cam.z < .35 ? 120 : cam.z < .7 ? 48 : 24, x0 = Math.floor(vx / g) * g, y0 = Math.floor(vy / g) * g, x1 = vx + vw, y1 = vy + vh;
    if (st.bg === "grid") { ctx.beginPath(); for (let x = x0; x <= x1; x += g) { ctx.moveTo(x, vy); ctx.lineTo(x, y1); } for (let y = y0; y <= y1; y += g) { ctx.moveTo(vx, y); ctx.lineTo(x1, y); } ctx.stroke(); }
    else if (st.bg === "lines") { const l = g * 1.5, yy = Math.floor(vy / l) * l; ctx.beginPath(); for (let y = yy; y <= y1; y += l) { ctx.moveTo(vx, y); ctx.lineTo(x1, y); } ctx.stroke(); }
    else if (st.bg === "dots") { const r = 1.2 / Math.min(1, cam.z) ; for (let x = x0; x <= x1; x += g) for (let y = y0; y <= y1; y += g) ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  function strokeDraw(s) {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.size;
    const p = s.pts;
    if (s.type === "pen" || s.type === "hl") {
      if (s.type === "hl") { ctx.globalAlpha = .32; ctx.lineWidth = s.size * 4; ctx.lineCap = "butt"; }
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.type === "hl" ? s.size * 2 : s.size / 2, 0, 7); ctx.fill(); }
      else if (s.pr && s.type === "pen") { for (let i = 1; i < p.length; i++) { ctx.lineWidth = s.size * (.35 + (p[i][2] || .5) * 1.3); ctx.beginPath(); ctx.moveTo(p[i - 1][0], p[i - 1][1]); ctx.lineTo(p[i][0], p[i][1]); ctx.stroke(); } }
      else { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); } const l = p[p.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke(); }
    } else if (s.type === "line" || s.type === "arrow") {
      const [a, b] = [p[0], p[1] || p[0]]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (s.type === "arrow") { const an = Math.atan2(b[1] - a[1], b[0] - a[0]), h = 12 + s.size * 2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - h * Math.cos(an - .45), b[1] - h * Math.sin(an - .45)); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - h * Math.cos(an + .45), b[1] - h * Math.sin(an + .45)); ctx.stroke(); }
    } else if (s.type === "rect") { const [a, b] = [p[0], p[1] || p[0]]; ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
    else if (s.type === "ellipse") { const [a, b] = [p[0], p[1] || p[0]]; ctx.beginPath(); ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, 7); ctx.stroke(); }
    else if (s.type === "text") { ctx.font = `600 ${s.size * 4 + 12}px Inter, system-ui, sans-serif`; ctx.textBaseline = "top"; s.text.split("\n").forEach((l, i) => ctx.fillText(l, p[0][0], p[0][1] + i * (s.size * 4 + 12) * 1.25)); }
    else if (s.type === "img") { let im = imgs.get(s); if (!im) { im = new Image(); im.onload = render; im.src = s.src; imgs.set(s, im); } if (im.complete && im.naturalWidth) ctx.drawImage(im, p[0][0], p[0][1], s.w, s.h); }
    ctx.restore();
  }
  function paint(c2, vx, vy, vw, vh, z, scale) { const keep = ctx, kz = cam.z; ctx = c2; cam.z = z; c2.save(); c2.setTransform(scale * z, 0, 0, scale * z, -vx * z * scale, -vy * z * scale); bgDraw(vx, vy, vw, vh); st.strokes.forEach(strokeDraw); OBJ && OBJ.paint(c2); if (c2 === mctx && st.cur) strokeDraw(st.cur); c2.restore(); ctx = keep; cam.z = kz; }
  function render() { paint(mctx, cam.x, cam.y, VW / cam.z, VH / cam.z, cam.z, dpr); OBJ && OBJ.sync(); }
  function fit() { const r = cvw.getBoundingClientRect(); VW = Math.max(200, r.width); VH = Math.max(200, r.height); dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.round(VW * dpr), h = Math.round(VH * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } cv.style.width = VW + "px"; cv.style.height = VH + "px"; render(); }
  function boundsOf() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; st.strokes.forEach(s => { const pad = s.type === "hl" ? s.size * 2 : s.size; s.pts.forEach(p => { x0 = Math.min(x0, p[0] - pad); y0 = Math.min(y0, p[1] - pad); x1 = Math.max(x1, p[0] + pad); y1 = Math.max(y1, p[1] + pad); }); if (s.type === "img") { x1 = Math.max(x1, s.pts[0][0] + s.w); y1 = Math.max(y1, s.pts[0][1] + s.h); } if (s.type === "text") { const fs = s.size * 4 + 12; x1 = Math.max(x1, s.pts[0][0] + Math.max(...s.text.split("\n").map(l => l.length)) * fs * .6); y1 = Math.max(y1, s.pts[0][1] + s.text.split("\n").length * fs * 1.25); } }); const ob = OBJ && OBJ.bounds(); if (ob) { x0 = Math.min(x0, ob.x0); y0 = Math.min(y0, ob.y0); x1 = Math.max(x1, ob.x1); y1 = Math.max(y1, ob.y1); } return x0 > x1 ? null : { x0, y0, x1, y1 }; }
  function snapshot(maxPx) { const b = boundsOf() || { x0: 0, y0: 0, x1: 800, y1: 500 }, pad = 40, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2, k = Math.min(2, maxPx / Math.max(w, h)), t = document.createElement("canvas"); t.width = Math.max(1, Math.round(w * k)); t.height = Math.max(1, Math.round(h * k)); paint(t.getContext("2d"), b.x0 - pad, b.y0 - pad, w, h, 1, k); return t; }
  function showAll() { const b = boundsOf(); if (!b) { cam.x = -40; cam.y = -40; cam.z = 1; } else { const w = b.x1 - b.x0 + 120, h = b.y1 - b.y0 + 120; cam.z = Math.max(.1, Math.min(1.5, Math.min(VW / w, VH / h))); cam.x = b.x0 - 60 - (VW / cam.z - w) / 2; cam.y = b.y0 - 60 - (VH / cam.z - h) / 2; } render(); updZoom(); touch(); }
  function zoomAt(cx, cy, nz) { nz = Math.max(.1, Math.min(4, nz)); const wx = cam.x + cx / cam.z, wy = cam.y + cy / cam.z; cam.z = nz; cam.x = wx - cx / nz; cam.y = wy - cy / nz; render(); updZoom(); }
  const updZoom = () => { const z = $("#zp", m); if (z) z.textContent = Math.round(cam.z * 100) + " %"; };
  const dist2 = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx, y = a[1] + t * dy; return Math.hypot(px - x, py - y); };
  function hit(s, x, y, r) {
    const p = s.pts, rr = r + (s.type === "hl" ? s.size * 2 : s.size / 2);
    if (s.type === "pen" || s.type === "hl") return p.length === 1 ? Math.hypot(x - p[0][0], y - p[0][1]) < rr : p.some((q, i) => i && dist2(x, y, p[i - 1], q) < rr);
    if (s.type === "line" || s.type === "arrow") return dist2(x, y, p[0], p[1]) < rr;
    if (s.type === "rect") { const [a, b] = p, c = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]; return c.some((q, i) => dist2(x, y, q, c[(i + 1) % 4]) < rr); }
    if (s.type === "ellipse") { const cx = (p[0][0] + p[1][0]) / 2, cy = (p[0][1] + p[1][1]) / 2, rx = Math.abs(p[1][0] - p[0][0]) / 2 || 1, ry = Math.abs(p[1][1] - p[0][1]) / 2 || 1; return Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry) < rr; }
    if (s.type === "text") { const w = Math.max(...s.text.split("\n").map(l => l.length)) * (s.size * 4 + 12) * .6, h = s.text.split("\n").length * (s.size * 4 + 12) * 1.25; return x > p[0][0] - r && x < p[0][0] + w + r && y > p[0][1] - r && y < p[0][1] + h + r; }
    if (s.type === "img") return x > p[0][0] && x < p[0][0] + s.w && y > p[0][1] && y < p[0][1] + s.h;
    return false;
  }

  { const bar = $("#bar", m), tools = $(".bd-tools", m), stg = $(".bd-stage", m), sp = document.createElement("i"); sp.className = "bd-vs";
    const dock = () => { const on = innerWidth > 1280; if (on && tools.parentNode !== bar) { bar.insertBefore(tools, $("#addo", m)); bar.insertBefore(sp, $("#addo", m)); } else if (!on && tools.parentNode === bar) { sp.remove(); stg.appendChild(tools); } bar.classList.toggle("docked", on); setTimeout(() => { try { syncProp(); } catch {} }, 0); };
    dock(); addEventListener("resize", dock); LEAVE.push(() => removeEventListener("resize", dock)); }
  const setTh = () => { const th = $(".bd-th", m); if (th && d.thumb) th.innerHTML = `<img src="${d.thumb}" alt="" onerror="this.remove()">`; };
  if (!d.thumb) setTimeout(() => { try { d.thumb = snapshot(480).toDataURL("image/jpeg", .6); setTh(); } catch {} }, 400);
  /* persistence */
  const persist = debounce(async () => {
    if (!D.docs.includes(d)) return;
    d.thumb = snapshot(480).toDataURL("image/jpeg", .6); d.title = titleEl.value.trim() || "Zeichnung"; d.updated = Date.now();
    await KV.set("draw:" + id, { strokes: st.strokes, objs: st.objs, bg: st.bg, H: st.H, W, fmt: "endless", cam: { ...cam } }); save(); savedEl.textContent = "Gespeichert"; setTh();
  }, 700);
  const touch = () => { savedEl.textContent = "Speichert…"; persist(); };
  const snap = () => { st.hist.push({ s: [...st.strokes], o: JSON.stringify(st.objs) }); if (st.hist.length > 80) st.hist.shift(); st.redo = []; };
  const restore = h => { st.strokes = h.s; st.objs = JSON.parse(h.o); OBJ && (OBJ.rebuild(), render()); };
  const undo = () => { if (!st.hist.length) return; st.redo.push({ s: [...st.strokes], o: JSON.stringify(st.objs) }); restore(st.hist.pop()); render(); touch(); };
  const redo = () => { if (!st.redo.length) return; st.hist.push({ s: [...st.strokes], o: JSON.stringify(st.objs) }); restore(st.redo.pop()); render(); touch(); };

  /* pointer handling */
  const pos = e => { const r = cv.getBoundingClientRect(); return [cam.x + (e.clientX - r.left) / cam.z, cam.y + (e.clientY - r.top) / cam.z]; };
  const ptrs = new Map(); let panning = null, gest = null, space = false;
  let drawing = false, erased = false;
  const setTool = t => { if (t === "hl" && !HLCOL.includes(st.color)) { st.penColor = st.color; st.color = HLCOL[0]; } else if (t !== "hl" && HLCOL.includes(st.color) && st.penColor) { st.color = st.penColor; st.penColor = null; } st.tool = t; renderProp(); { const sh = ["rect", "ellipse", "line", "arrow"], sb = $("#shp", m); if (sb) { sb.classList.toggle("on", sh.includes(t)); if (sh.includes(t)) sb.firstChild.outerHTML = ic(T[t][1]); $("#fly", m).hidden = true; } } $$("[data-t]", m).forEach(b => b.classList.toggle("on", b.dataset.t === t)); cv.style.touchAction = "none"; cv.style.cursor = t === "hand" ? "grab" : t === "text" ? "text" : "crosshair"; if (t === "img") $("#fi", m).click(); };
  const beginGesture = () => { const [a, b] = [...ptrs.values()]; const r = cv.getBoundingClientRect(); gest = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, wx: 0, wy: 0 }; gest.wx = cam.x + gest.cx / cam.z; gest.wy = cam.y + gest.cy / cam.z; };
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "pen") st.penSeen = true; if (e.pointerType === "touch" && st.penSeen) return;
    if (e.pointerType === "touch") { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { drawing = false; st.cur = null; panning = null; beginGesture(); cv.setPointerCapture(e.pointerId); render(); return; } }
    if (e.button === 1 || st.tool === "hand" || space) { e.preventDefault(); panning = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; return; }
    if (e.button > 0) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (st.tool === "text") return textAt(p, e);
    if (st.tool === "place" && st.pending) { snap(); const pi = st.pending; st.strokes.push({ type: "img", src: pi.src, w: pi.w, h: pi.h, pts: [[p[0] - pi.w / 2, p[1] - pi.h / 2]], color: "#000", size: 1 }); st.pending = null; setTool("pen"); render(); touch(); return; }
    drawing = true;
    if (st.tool === "eraser") { snap(); erased = false; eraseAt(p); return; }
    st.cur = { type: st.tool, color: st.tool === "hl" && st.color === "#ffffff" ? "#ffe600" : st.color, size: st.size, pts: [[p[0], p[1], e.pressure || .5]], pr: e.pointerType === "pen" };
    if (["line", "arrow", "rect", "ellipse"].includes(st.tool)) st.cur.pts.push([p[0], p[1]]);
    render();
  });
  function eraseAt(p) { const n = st.strokes.length; st.strokes = st.strokes.filter(s => !hit(s, p[0], p[1], (st.esize || 14) / cam.z)); if (st.strokes.length !== n) { erased = true; render(); } }
  cv.addEventListener("pointermove", e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gest && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect(), nz = Math.max(.1, Math.min(4, gest.z * (Math.hypot(a.x - b.x, a.y - b.y) / gest.d))), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top; cam.z = nz; cam.x = gest.wx - cx / nz; cam.y = gest.wy - cy / nz; render(); updZoom(); return; }
    if (panning) { cam.x = panning.cx - (e.clientX - panning.x) / cam.z; cam.y = panning.cy - (e.clientY - panning.y) / cam.z; render(); return; }
    if (!drawing) return; if (e.pointerType === "touch" && st.penSeen) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) { const p = pos(ev); if (st.tool === "eraser") eraseAt(p); else if (st.cur) { if (["line", "arrow", "rect", "ellipse"].includes(st.cur.type)) { let q = p; if (ev.shiftKey && st.cur.type !== "arrow") { const a = st.cur.pts[0], dx = p[0] - a[0], dy = p[1] - a[1]; q = Math.abs(dx) > Math.abs(dy) * 2 ? [p[0], a[1]] : Math.abs(dy) > Math.abs(dx) * 2 ? [a[0], p[1]] : st.cur.type === "line" ? p : [p[0], a[1] + Math.sign(dy || 1) * Math.abs(dx)]; } st.cur.pts[1] = q; } else st.cur.pts.push([p[0], p[1], ev.pressure || .5]); } }
    if (st.cur) { render(); if (st.cur.type === "pen" || st.cur.type === "hl") { /* full redraw is cheap enough for typical sketches */ } }
  });
  const up = e => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) gest = null;
    if (panning) { panning = null; setTool(st.tool); touch(); return; }
    if (!drawing) return; drawing = false;
    if (st.tool === "eraser") { if (!erased) st.hist.pop(); else touch(); return; }
    if (st.cur) { const s = st.cur; st.cur = null; if (["line", "arrow", "rect", "ellipse"].includes(s.type) && Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) < 3) { render(); return; } snap(); st.strokes.push(s); render(); touch(); }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  function textAt(p, e) {
    const ti = $("#ti", m), r = cv.getBoundingClientRect(), w = $("#cvw", m).getBoundingClientRect();
    ti.hidden = false; ti.value = ""; ti.style.left = (e.clientX - w.left + $("#cvw", m).scrollLeft) + "px"; ti.style.top = (e.clientY - w.top + $("#cvw", m).scrollTop - 14) + "px"; ti.style.color = st.color === "#ffffff" ? "#111" : st.color; ti.style.fontSize = (st.size * 4 + 12) * cam.z + "px"; setTimeout(() => ti.focus(), 10);
    const done = () => { const v = ti.value.trim(); ti.hidden = true; ti.onblur = ti.onkeydown = null; if (v) { snap(); st.strokes.push({ type: "text", text: v, color: st.color === "#ffffff" ? "#111111" : st.color, size: st.size, pts: [p] }); render(); touch(); } };
    ti.onblur = done; ti.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); ti.blur(); } if (ev.key === "Escape") { ti.value = ""; ti.blur(); } };
  }

  /* UI */
  $$("[data-t]", m).forEach(b => b.onclick = () => setTool(b.dataset.t));
  const STEPS_OF = t => t === "eraser" ? [[8, "S"], [16, "M"], [28, "L"], [44, "XL"]] : t === "text" ? [[2, "S"], [4, "M"], [7, "L"], [12, "XL"]] : t === "hl" ? [[3, "S"], [6, "M"], [10, "L"], [14, "XL"]] : [[2, "Fein"], [4, "Normal"], [8, "Dick"], [14, "Breit"], [22, "Pinsel"]];
  const closeProp = () => {};
  function renderProp() {
    const t = st.tool, draws = ["pen", "hl", "line", "arrow", "rect", "ellipse", "text"].includes(t), er = t === "eraser"; closeProp();
    const el = $("#prop", m); el.hidden = !(draws || er); if (!el.hidden) fillProp(); syncProp(); paintPrev();
  }
  function paintPrev() {
    const t = st.tool, er = t === "eraser", cur = er ? (st.esize || 16) : st.size; $("#colb i", m).style.background = st.color; $("#colb", m).classList.toggle("lt", /^#f{3,6}$/i.test(st.color));
    const p = $("#szb i", m); p.className = "sprev" + (er ? " er" : t === "text" ? " tx" : ""); if (t === "text") { p.textContent = "A"; p.style.fontSize = 10 + cur * 1.4 + "px"; p.style.height = p.style.width = ""; } else { p.textContent = ""; p.style.fontSize = ""; p.style.width = er ? Math.min(22, 6 + cur / 2.4) + "px" : ""; p.style.height = er ? Math.min(22, 6 + cur / 2.4) + "px" : Math.max(2, Math.min(14, cur * (t === "hl" ? .8 : .7))) + "px"; }
  }
  function syncProp() { const bar = $("#bar", m), el = $("#prop", m), stg = $(".bd-stage", m); if (!bar || !el) return; const r = bar.getBoundingClientRect(), sr = stg.getBoundingClientRect(); el.style.left = r.left - sr.left + "px"; el.style.top = r.bottom - sr.top - 1 + "px"; el.style.width = r.width + "px"; bar.classList.toggle("ext", !el.hidden); }
  addEventListener("resize", () => setTimeout(syncProp, 30)); setTimeout(syncProp, 200);
  function fillProp() {
    const t = st.tool, el = $("#prop", m), er = t === "eraser", cols = t === "hl" ? HLCOL : COL, STEPS = STEPS_OF(t), cur = er ? (st.esize || 16) : st.size, near = STEPS.reduce((a, b) => Math.abs(b[0] - cur) < Math.abs(a[0] - cur) ? b : a)[0];
    el.innerHTML = (er ? "" : `<div class="pp-sec"><b class="pp-h">Farbe</b><div class="pp-cols">${cols.map(c => `<button class="cdot ${c.toLowerCase() === st.color.toLowerCase() ? "on" : ""}" data-c="${c}" style="background:${c}" title="${c}" aria-label="Farbe ${c}"></button>`).join("")}<label class="cdot pick" title="Eigene Farbe"><input type="color" id="cc" value="${/^#[0-9a-f]{6}$/i.test(st.color) ? st.color : "#111111"}"></label></div></div><i class="pp-sep"></i>`)
      + `<div class="pp-sec"><b class="pp-h">${t === "text" ? "Schriftgröße" : er ? "Radiergröße" : "Stärke"}</b><div class="pp-steps">${STEPS.map(([v, n]) => `<button type="button" data-ps="${v}" class="${v === near ? "on" : ""}" title="${n}" aria-label="${n}"><span class="pp-sv">${t === "text" ? `<span style="font-size:${10 + v * 1.6}px;font-weight:700">A</span>` : er ? `<i class="er" style="width:${6 + v / 2.4}px;height:${6 + v / 2.4}px"></i>` : `<i style="width:${Math.min(26, 6 + v * 1.1)}px;height:${Math.max(2, v * (t === "hl" ? 1.2 : 1))}px;${t === "hl" ? "opacity:.45;border-radius:3px" : ""}"></i>`}</span></button>`).join("")}</div></div>`;
    $$("[data-c]", el).forEach(b => b.onclick = () => { st.color = b.dataset.c; fillProp(); paintPrev(); });
    const cc = $("#cc", el); if (cc) cc.oninput = e => { st.color = e.target.value; paintPrev(); };
    $$("[data-ps]", el).forEach(b => b.onclick = () => { if (er) st.esize = +b.dataset.ps; else st.size = +b.dataset.ps; fillProp(); paintPrev(); });
  }
  function openProp(kind, btn) {
    const t = st.tool, el = $("#prop", m), er = t === "eraser", cols = t === "hl" ? HLCOL : COL, STEPS = STEPS_OF(t), cur = er ? (st.esize || 16) : st.size, near = STEPS.reduce((a, b) => Math.abs(b[0] - cur) < Math.abs(a[0] - cur) ? b : a)[0];
    const was = !el.hidden && el.dataset.k === kind; closeProp(); if (was) return; el.dataset.k = kind; btn.classList.add("open");
    el.innerHTML = kind === "color" ? `<b class="pp-h">Farbe</b><div class="pp-cols">${cols.map(c => `<button class="cdot ${c.toLowerCase() === st.color.toLowerCase() ? "on" : ""}" data-c="${c}" style="background:${c}" title="${c}" aria-label="Farbe ${c}"></button>`).join("")}<label class="cdot pick" title="Eigene Farbe"><input type="color" id="cc" value="${/^#[0-9a-f]{6}$/i.test(st.color) ? st.color : "#111111"}"></label></div>`
      : `<b class="pp-h">${t === "text" ? "Schriftgröße" : er ? "Radiergröße" : "Stärke"}</b><div class="pp-steps">${STEPS.map(([v, n]) => `<button type="button" data-ps="${v}" class="${v === near ? "on" : ""}" title="${n}" aria-label="${n}"><span class="pp-sv">${t === "text" ? `<span style="font-size:${10 + v * 1.6}px;font-weight:700">A</span>` : er ? `<i class="er" style="width:${6 + v / 2.4}px;height:${6 + v / 2.4}px"></i>` : `<i style="width:${Math.min(26, 6 + v * 1.1)}px;height:${Math.max(2, v * (t === "hl" ? 1.2 : 1))}px;${t === "hl" ? "opacity:.45;border-radius:3px" : ""}"></i>`}</span><small>${n}</small></button>`).join("")}</div>`;
    $$("[data-c]", el).forEach(b => b.onclick = () => { st.color = b.dataset.c; paintPrev(); closeProp(); });
    const cc = $("#cc", el); if (cc) { cc.oninput = e => { st.color = e.target.value; paintPrev(); }; cc.onchange = () => closeProp(); }
    $$("[data-ps]", el).forEach(b => b.onclick = () => { if (er) st.esize = +b.dataset.ps; else st.size = +b.dataset.ps; paintPrev(); closeProp(); });
    el.hidden = false; const r = btn.getBoundingClientRect(), sr = $(".bd-stage", m).getBoundingClientRect();
    if (innerWidth > 900) { el.style.left = r.right - sr.left + 12 + "px"; el.style.top = Math.max(8, Math.min(sr.height - el.offsetHeight - 8, r.top - sr.top - 6)) + "px"; el.style.bottom = "auto"; }
    else { el.style.left = Math.max(8, Math.min(sr.width - el.offsetWidth - 8, r.left - sr.left - 20)) + "px"; el.style.top = "auto"; el.style.bottom = sr.bottom - r.top + 10 + "px"; }
  }
  $("#colb", m).onclick = e => { e.stopPropagation(); openProp("color", e.currentTarget); }; $("#szb", m).onclick = e => { e.stopPropagation(); openProp("size", e.currentTarget); };
  document.addEventListener("pointerdown", e => { if (!e.target.closest("#prop, #colb, #szb")) closeProp(); }, true);
  $("#bg", m).onchange = e => { st.bg = e.target.value; render(); touch(); };
  $("#bgb", m).onclick = e => menu(e.currentTarget, [["blank", "Weiß"], ["grid", "Kariert"], ["lines", "Liniert"], ["dots", "Punkte"], ["dark", "Tafel"]].map(([k, l]) => ({ label: (st.bg === k ? "✓ " : "") + l, icon: "hash", fn: () => { $("#bg", m).value = k; $("#bg", m).dispatchEvent(new Event("change")); } })));
  cvw.addEventListener("wheel", e => { e.preventDefault(); const r = cv.getBoundingClientRect(); if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, cam.z * Math.exp(-e.deltaY * .01)); else { cam.x += e.deltaX / cam.z; cam.y += e.deltaY / cam.z; render(); } touch(); }, { passive: false });
  $("#zi", m).onclick = () => { zoomAt(VW / 2, VH / 2, cam.z * 1.25); touch(); }; $("#zo", m).onclick = () => { zoomAt(VW / 2, VH / 2, cam.z / 1.25); touch(); };
  $("#zp", m).onclick = () => { if (Math.abs(cam.z - 1) > .01) { zoomAt(VW / 2, VH / 2, 1); touch(); } else showAll(); };
  const ro = new ResizeObserver(fit); ro.observe(cvw);
  const sk = e => { if (e.code === "Space" && !e.target.isContentEditable && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) { space = e.type === "keydown"; if (space) e.preventDefault(); cv.style.cursor = space ? "grab" : cv.style.cursor; } };
  LEAVE.push(penGuard(cv)); m.classList.add("noselect");
  document.addEventListener("keydown", sk); document.addEventListener("keyup", sk); LEAVE.push(() => { ro.disconnect(); document.removeEventListener("keydown", sk); document.removeEventListener("keyup", sk); });
  $("#un", m).onclick = undo; $("#re", m).onclick = redo;
  $("#cl", m).onclick = async () => { if ((st.strokes.length || st.objs.length) && await confirmBox("Zeichenfläche komplett leeren?", "Leeren")) { snap(); st.strokes = []; st.objs = []; OBJ.rebuild(); render(); touch(); } };
  $("#fi", m).onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) { setTool("pen"); return; } const bmp = await createImageBitmap(f), s = Math.min(1, 700 / bmp.width), c = document.createElement("canvas"); c.width = bmp.width * s; c.height = bmp.height * s; c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); st.pending = { src: c.toDataURL("image/jpeg", .85), w: c.width, h: c.height }; st.tool = "place"; $$("[data-t]", m).forEach(b => b.classList.remove("on")); cv.style.touchAction = "pinch-zoom"; toast("Tippe dorthin, wo das Bild hin soll"); };
  $("#eb", m).onclick = () => go(d.folderId ? "docs/" + d.folderId : "board"); $("#et", m).oninput = touch;
  $("#done", m).onclick = () => go(d.folderId ? "docs/" + d.folderId : "board");
  $("#mo-m", m).onclick = e => menu(e.currentTarget, [...exportItems(), "-", { label: "Alles leeren", icon: "trash", fn: () => $("#cl", m).click() }, "-", { label: d.pinned ? "Lösen" : "Anheften", icon: "star", fn: () => { d.pinned = !d.pinned; save(); toast(d.pinned ? "Angeheftet" : "Gelöst"); } }, "-", { label: "Löschen", icon: "trash", danger: true, fn: async () => { await deleteDoc(d); go(d.folderId ? "docs/" + d.folderId : "board"); } }]);
  $("#exp", m).onclick = () => { snapshot(4000).toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (d.title || "zeichnung") + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }); };
  $("#ai-m", m).onclick = e => menu(e.currentTarget, [{ label: "Skizze erklären lassen", icon: "help", fn: async () => explainCanvas("Erkläre, was auf dieser Skizze/Tafel zu sehen ist. Wenn es Mathematik oder Naturwissenschaft ist, erkläre die Idee und Rechenschritte und weise auf mögliche Fehler hin.") }, { label: "Handschrift in Text umwandeln", icon: "text", fn: async () => explainCanvas("Lies die Handschrift/Beschriftungen auf dem Bild und gib sie als sauberen Text wieder (Formeln in Textform).") }, { label: "Als Notiz speichern (Bild)", icon: "note", fn: () => newNote(d.subjectId, `<p><img src="${snapshot(1600).toDataURL("image/jpeg", .8)}"></p><p><br></p>`, d.title) }]);
  function shareBoard() {
    const old = $("#shpop", m); if (old) { old.remove(); return; }
    const stage = $(".bd-stage", m), anc = $("#cob", m).getBoundingClientRect(), sr = stage.getBoundingClientRect(), link = location.origin + location.pathname + "#/app/draw/" + id;
    const pop = document.createElement("div"); pop.className = "bd-pop bd-shp"; pop.id = "shpop";
    pop.innerHTML = `<p class="sp-h">Link teilen</p><div class="sp-link"><input id="sh-l" readonly value="${esc(link)}"><button id="sh-cp">Kopieren</button></div>
    <p class="sp-h">Person einladen</p><div class="sp-inv"><input id="sh-n" placeholder="Name oder E-Mail" autocomplete="off"><button id="sh-in">Einladen</button></div>
    <p class="sp-h">Zugriff</p><div class="sp-me"><span class="bd-me" style="background:${meCol()}">${esc(coIni(coName()))}</span><b>${esc(coName())}</b><em>Inhaber:in</em></div>
    <p class="sp-n">Live gemeinsam zeichnen ist für Whiteboards noch nicht verfügbar – der Link öffnet das Board in der Studix-App der eingeladenen Person nur mit Zugriff auf dein Konto.</p>`;
    stage.appendChild(pop); pop.style.top = anc.bottom - sr.top + 8 + "px"; pop.style.left = Math.max(8, Math.min(sr.width - 348, anc.right - sr.left - 340)) + "px";
    const close = () => { pop.remove(); document.removeEventListener("pointerdown", off, true); }, off = e => { if (!pop.contains(e.target) && !e.target.closest("#cob, #mo-m")) close(); };
    setTimeout(() => document.addEventListener("pointerdown", off, true)); LEAVE.push(close);
    $("#sh-cp", pop).onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link kopiert"); } catch { $("#sh-l", pop).select(); } };
    $("#sh-in", pop).onclick = () => { const w = $("#sh-n", pop).value.trim(); if (!w) return $("#sh-n", pop).focus(); if (/@/.test(w)) location.href = "mailto:" + encodeURIComponent(w) + "?subject=" + encodeURIComponent("Whiteboard „" + (d.title || "Zeichnung") + "“") + "&body=" + encodeURIComponent("Hier ist das Whiteboard: " + link); else toast("Gib die E-Mail-Adresse der Person ein"); };
  }
  const blobDl = (f, q, w) => snapshot(w).toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (d.title || "zeichnung") + (f === "image/jpeg" ? ".jpg" : ".png"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, f, q);
  const exportItems = () => [{ label: "Als PNG exportieren", icon: "download", fn: () => $("#exp", m).click() }, { label: "Als JPG exportieren", icon: "image", fn: () => blobDl("image/jpeg", .92, 3000) }, { label: "Bild kopieren", icon: "copy", fn: () => snapshot(2400).toBlob(async b => { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("Bild kopiert"); } catch { toast("Kopieren wird von diesem Browser nicht unterstützt"); } }) }, { label: "Drucken / PDF", icon: "file", fn: () => { const u = snapshot(2400).toDataURL("image/png"), w = window.open("", "_blank"); if (!w) return toast("Pop-up wurde blockiert"); w.document.write(`<title>${esc(d.title || "Whiteboard")}</title><style>@page{margin:10mm}body{margin:0}img{width:100%}</style><img src="${u}" onload="print()">`); w.document.close(); } }, { label: "Als Notiz speichern (Bild)", icon: "note", fn: () => newNote(d.subjectId, `<p><img src="${snapshot(1600).toDataURL("image/jpeg", .8)}"></p><p><br></p>`, d.title) }, { label: "Duplizieren", icon: "copy", fn: () => duplicate() }];
  async function explainCanvas(q) { if (!hasKey()) return toast("Bild-Analyse braucht die eingerichtete Studix AI (Einstellungen → Studix AI)."); if (!st.strokes.length && !st.objs.length) return toast("Zeichne zuerst etwas."); toast("Studix AI schaut hin…"); const t = snapshot(1400); const r = await ai(q, { image: { data: t.toDataURL("image/jpeg", .85).split(",")[1], type: "image/jpeg" } }); if (r) { const { el } = modal(`<h3>Studix AI</h3><textarea class="field" rows="12">${esc(r)}</textarea><div class="row end"><button class="btn" id="sn">Als Notiz speichern</button></div>`, "wide"); $("#sn", el).onclick = () => { el.closest(".mask").remove(); newNote(d.subjectId, textToHtml(r), d.title + " – Studix AI"); }; } }
  const key = e => {
    if (!$("#cv")) return; const tag = e.target.tagName; if (e.target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (!e.ctrlKey && !e.metaKey) { const k = { v: "hand", p: "pen", h: "hl", e: "eraser", l: "line", a: "arrow", r: "rect", o: "ellipse", t: "text" }[e.key.toLowerCase()]; if (k) setTool(k); }
  };
  document.addEventListener("keydown", key); LEAVE.push(() => { document.removeEventListener("keydown", key); persist(); });
  OBJ = boardObjects({ host: cvw, cam, st, snap, touch, render }); LEAVE.push(() => OBJ.destroy());
  $("#qs", m).onclick = () => OBJ.add("sticky");
  const stage = $(".bd-stage", m); stage.appendChild($("#fly", m)); [stage, cvw].forEach(x => x.addEventListener("scroll", () => { x.scrollTop = 0; x.scrollLeft = 0; }));
  $("#shp", m).onclick = e => { e.stopPropagation(); const f = $("#fly", m); f.hidden = !f.hidden; if (!f.hidden) { const r = e.currentTarget.getBoundingClientRect(), sr = stage.getBoundingClientRect(); if ($("#bar", m).classList.contains("docked")) { f.style.left = r.left - sr.left + "px"; f.style.top = r.bottom - sr.top + 12 + "px"; f.style.bottom = "auto"; } else if (innerWidth > 900) { f.style.left = r.right - sr.left + 12 + "px"; f.style.top = r.top - sr.top + "px"; f.style.bottom = "auto"; } else { f.style.left = Math.max(8, r.left - sr.left - 40) + "px"; f.style.top = "auto"; f.style.bottom = sr.bottom - r.top + 10 + "px"; } } }; cvw.addEventListener("pointerdown", () => { $("#fly", m).hidden = true; });
  $("#hp", m).onclick = () => modal(`<h3>Tastenkürzel</h3><div class="kbd-l">${[["V", "Auswählen / Verschieben"], ["P", "Stift"], ["H", "Marker"], ["E", "Radierer"], ["L", "Linie"], ["A", "Pfeil"], ["R", "Rechteck"], ["O", "Ellipse"], ["T", "Text"], ["Strg + Z", "Rückgängig"], ["Strg + Umschalt + Z", "Wiederholen"], ["Leertaste + Ziehen", "Fläche verschieben"], ["Strg + Mausrad", "Zoomen"], ["Entf", "Gewähltes Element löschen"]].map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join("")}</div>`);
  $("#shb", m).onclick = () => shareBoard();
  $("#fr", m).onclick = () => OBJ.add("frame"); $("#fit", m).onclick = () => showAll();
  const pnl = $("#pnl", m), colm = $("#colm", m), ttl = $("#tt", m), cob = $("#cob", m), me = coName();
  const elp = $("#elp", m); const closePops = () => { pnl.hidden = colm.hidden = elp.hidden = true; $("#addo", m).setAttribute("aria-expanded", "false"); ttl.setAttribute("aria-expanded", "false"); cob.setAttribute("aria-expanded", "false"); $$(".bd-sub", m).forEach(x => x.remove()); };
  const syncTitle = () => { $("#ttx", m).textContent = titleEl.value.trim() || "Zeichnung"; const t = $(".pl-t", m); if (t && t.tagName === "H2") t.textContent = titleEl.value.trim() || "Zeichnung"; };
  const related = () => D.docs.filter(x => x.type === "draw" && x.id !== d.id).sort((a, b) => (b.folderId === d.folderId) - (a.folderId === d.folderId) || b.updated - a.updated).slice(0, 4);
  const ask2 = q => { closePops(); explainCanvas(q); };
  const renameInline = () => { const h = $(".pl-t", m); if (!h) return; const inp = document.createElement("input"); inp.className = "pl-in"; inp.value = titleEl.value; inp.maxLength = 80; h.replaceWith(inp); inp.focus(); inp.select(); let done = false; const fin = ok => { if (done) return; done = true; if (ok && inp.value.trim()) { titleEl.value = inp.value.trim(); touch(); } syncTitle(); const n = document.createElement("h2"); n.className = "pl-t"; n.textContent = titleEl.value; inp.replaceWith(n); }; inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } else if (e.key === "Escape") fin(false); }; };
  async function duplicate() { const nid = uid(), src = await KV.get("draw:" + id); await KV.set("draw:" + nid, JSON.parse(JSON.stringify(src || { strokes: st.strokes, objs: st.objs, bg: st.bg, H: st.H }))); D.docs.unshift({ ...JSON.parse(JSON.stringify(d)), id: nid, title: (titleEl.value.trim() || "Zeichnung") + " (Kopie)", share: undefined, shareOwner: undefined, pinned: false, created: Date.now(), updated: Date.now() }); save(); toast("Dupliziert"); closePops(); go("draw/" + nid); }
  async function move() { closePops(); const f = await pickFolder("Verschieben nach", ""); if (f == null) return; moveDoc(d, f); toast("Verschoben nach " + (folderOf(f)?.name || "Dokumente")); refreshNav(); go("draw/" + id); }
  const ICB = i => `<span class="pl-ic">${ic(i)}</span>`;
  function openPanel() {
    closePops(); const fpn = ["Home", ...folderPath(d.folderId).map(f => f.name)].map(esc).join(" / "), rel = related();
    pnl.innerHTML = `<div class="pl-cols"><div class="pl-c pl-l"><div class="pl-th">${d.thumb ? `<img src="${d.thumb}" alt="">` : `<span>${ic("brush")}</span>`}</div><h2 class="pl-t">${esc(titleEl.value.trim() || "Zeichnung")}</h2><p class="pl-f">${ic("folder")}${fpn}</p></div>
    <div class="pl-c pl-o"><p class="pl-h">Board-Optionen</p>${[["share", "Teilen", "send"], ["ren", "Umbenennen", "pen"], ["dup", "Duplizieren", "copy"], ["mov", "Verschieben", "arrowr"], ["exp", "Exportieren", "download"], ["del", "Löschen", "trash"]].map(([k, l, i]) => `<button class="pl-b" data-k="${k}">${ICB(i)}<span>${l}</span></button>`).join("")}</div>
    <div class="pl-c pl-i"><p class="pl-h">Board-Einblicke</p><div class="pl-ask"><input id="pl-q" placeholder="Frag mich etwas …" autocomplete="off"><button id="pl-go" aria-label="Fragen">${ic("spark")}</button></div>
      ${[["sum", "Zusammenfassen", "Verschaffe dir einen Überblick über die wichtigsten Inhalte des Boards.", "sumi"], ["todo", "To-dos", "Erhalte eine Liste der Aufgaben, die sich aus dem Board ergeben.", "todo"], ["chk", "Gegenprüfen", "Erhalte eine Einschätzung mit Verbesserungsvorschlägen zu deinem Board.", "xchk"]].map(([k, t, ds, i]) => `<button class="pl-ins" data-i="${k}">${ICB(i)}<span><b>${t}</b><small>${ds}</small></span></button>`).join("")}</div>
    <div class="pl-c pl-r"><p class="pl-h">Ähnliche Boards</p><div class="pl-rel">${rel.length ? rel.map(x => `<button class="pl-card" data-r="${x.id}"><span class="pl-rt">${x.thumb ? `<img src="${x.thumb}" alt="">` : ic("brush")}</span><small>${esc(x.title)}</small></button>`).join("") : `<p class="note">Noch keine weiteren Whiteboards.</p>`}</div></div></div>
    <button class="pl-help" id="pl-hp">${ICB("lifebuoy")}<span>Brauchst du Hilfe? Tastenkürzel ansehen</span></button>`;
    pnl.hidden = false; ttl.setAttribute("aria-expanded", "true");
    const act = { share: () => { closePops(); shareBoard(); }, ren: renameInline, dup: duplicate, mov: move, exp: () => { closePops(); $("#exp", m).click(); }, del: async () => { closePops(); if (await confirmBox("Whiteboard „" + (titleEl.value.trim() || "Zeichnung") + "“ löschen?", "Löschen")) { await deleteDoc(d); go(d.folderId ? "docs/" + d.folderId : "board"); } } };
    $$("[data-k]", pnl).forEach(b => b.onclick = () => act[b.dataset.k]());
    const Q = { sum: "Fasse die wichtigsten Inhalte dieses Whiteboards kurz und übersichtlich zusammen.", todo: "Erstelle aus diesem Whiteboard eine Liste der Aufgaben bzw. nächsten Schritte (To-dos) als Aufzählung.", chk: "Bewerte dieses Whiteboard: Was fehlt, was ist unklar oder widersprüchlich? Gib konkrete Verbesserungsvorschläge." };
    $$("[data-i]", pnl).forEach(b => b.onclick = () => ask2(Q[b.dataset.i]));
    const q = $("#pl-q", pnl), go2 = () => { if (q.value.trim()) ask2(q.value.trim()); }; $("#pl-go", pnl).onclick = go2; q.onkeydown = e => { if (e.key === "Enter") go2(); };
    $$("[data-r]", pnl).forEach(b => b.onclick = () => go("draw/" + b.dataset.r));
    $("#pl-hp", pnl).onclick = () => { closePops(); $("#hp", m).click(); };
  }
  ttl.onclick = e => { e.stopPropagation(); pnl.hidden ? openPanel() : closePops(); };
  function openColl() {
    closePops(); cob.setAttribute("aria-expanded", "true");
    colm.innerHTML = `<button class="cm-i" data-a="follow">${ICB("cursor")}<span>Alle folgen mir</span></button><button class="cm-i" data-a="chat">${ICB("chat")}<span>Gruppenchat starten</span></button><hr><p class="cm-h">Zusammenarbeitende</p>
    <div class="cm-row" data-p="me"><span class="bd-me" style="background:${meCol()}">${esc(coIni(me))}</span><b>${esc(me)}<em> (du)</em></b>${ic("chevr")}</div><p class="cm-n">Sonst ist gerade niemand im Board.</p>
    <button class="cm-i" data-a="inv">${ICB("userplus")}<span>Weitere Personen einladen</span></button>`;
    { const r = cob.getBoundingClientRect(), sr = $(".bd-stage", m).getBoundingClientRect(); colm.style.left = Math.min(sr.width - 312, r.right - sr.left - 300 + 0) + "px"; }
    colm.hidden = false;
    const sub = (row, items) => { $$(".bd-sub", m).forEach(x => x.remove()); const r = row.getBoundingClientRect(), sr = $(".bd-stage", m).getBoundingClientRect(), el = document.createElement("div"); el.className = "bd-pop bd-sub"; el.innerHTML = items.map(([k, l, i, off]) => `<button class="cm-i" data-s="${k}" ${off ? 'aria-disabled="true"' : ""}>${ICB(i)}<span>${l}</span></button>`).join("").replace('data-s="prof"><', 'data-s="prof"><') ; el.style.left = r.right - sr.left + 8 + "px"; el.style.top = (innerWidth <= 900 ? r.bottom - sr.top + 34 : r.top - sr.top - 6) + "px"; $(".bd-stage", m).appendChild(el); return el; };
    const SOON = "Folgen und Chat gibt es bei Live-Zusammenarbeit";
    $("[data-p=me]", colm).onclick = e => { e.stopPropagation(); const el = sub(e.currentTarget, [["f", "Mir folgen", "cursor", 1], ["c", "Privater Chat", "chat", 1], ["prof", "Dein Profil", "prof"]]); $$("[data-s]", el).forEach(b => b.onclick = () => { if (b.dataset.s === "prof") { closePops(); go("settings"); } else toast(SOON); }); };
    $$("[data-a]", colm).forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === "inv") { closePops(); shareBoard(); } else toast(SOON); });
  }
  cob.onclick = e => { e.stopPropagation(); colm.hidden ? openColl() : closePops(); };
  document.addEventListener("pointerdown", e => { if (!e.target.closest(".bd-pop, #tt, #cob, #addo")) closePops(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && (!pnl.hidden || !colm.hidden || !elp.hidden)) closePops(); }); 
  let elTab = "Alle", elQ = "";
  function openEl() {
    closePops(); $("#addo", m).setAttribute("aria-expanded", "true"); const TABS = ["Alle", "Notizen", "Text", "Formen", "Sticker"];
    elp.innerHTML = `<div class="el-h"><b>Elemente</b><div class="el-s">${ic("search")}<input id="el-q" placeholder="Suchen, z. B. Daumen, Stern, Haftnotiz …" autocomplete="off" value="${esc(elQ)}"></div></div><div class="el-tabs">${TABS.map(t => `<button data-t2="${t}" class="${t === elTab ? "on" : ""}">${t}</button>`).join("")}</div><div class="el-body" id="el-b"></div>`;
    elp.hidden = false; const body = $("#el-b", elp), cat = OBJ.catalog();
    const draw = () => {
      const q = elQ.trim().toLowerCase(), list = cat.filter(([c, l, kw]) => (elTab === "Alle" || c === elTab) && (!q || (l + " " + kw + " " + c).toLowerCase().includes(q)));
      body.innerHTML = ""; if (!list.length) { body.innerHTML = `<p class="el-none">Nichts gefunden.</p>`; return; }
      const colL = document.createElement("div"), colR = document.createElement("div"); colL.className = "el-l"; colR.className = "el-r"; body.className = "el-body el2" + (elTab === "Sticker" ? " only-r" : elTab === "Alle" ? "" : " only-l"); body.append(colL, colR);
      const groups = {}; list.forEach(it => { const g = it[0] === "Sticker" ? "Sticker · " + it[4] : it[0]; (groups[g] = groups[g] || []).push(it); });
      Object.entries(groups).forEach(([g, items]) => {
        const sec = document.createElement("section"); sec.innerHTML = `<h4>${g}</h4><div class="el-grid ${g.startsWith("Sticker") ? "st" : ""}"></div>`; const grid = $(".el-grid", sec);
        items.forEach(it => { const b = document.createElement("button"); b.className = "el-t"; b.title = it[1]; const st = it[0] === "Sticker"; b.appendChild(OBJ.preview(it[3], st ? 48 : 120, st ? 48 : 120)); if (!st) { const l = document.createElement("small"); l.textContent = it[1]; b.appendChild(l); } b.onclick = () => { OBJ.addSpec(it[3]); closePops(); }; grid.appendChild(b); });
        (g.startsWith("Sticker") ? colR : colL).appendChild(sec);
      });
    };
    $$("[data-t2]", elp).forEach(b => b.onclick = () => { elTab = b.dataset.t2; $$("[data-t2]", elp).forEach(x => x.classList.toggle("on", x === b)); draw(); });
    const qi = $("#el-q", elp); qi.oninput = () => { elQ = qi.value; draw(); }; setTimeout(() => qi.focus(), 30); draw();
  }
  $("#addo", m).onclick = e => { e.stopPropagation(); elp.hidden ? openEl() : closePops(); };
  setTool("pen"); fit(); updZoom();
};

/* ---------- Whiteboard erstellen: Format, Hintergrund, Vorlage ---------- */
const BFORMATS = [["endless", "Endlos", "Wächst nach unten", 1600, 1000], ["a4p", "A4 hoch", "Wie ein Blatt Papier", 1240, 1754], ["a4l", "A4 quer", "Querformat", 1754, 1240], ["wide", "16:9", "Präsentation", 1600, 900], ["sq", "Quadrat", "Skizze, Mindmap", 1200, 1200]];
const BBGS = [["blank", "Weiß"], ["grid", "Kariert"], ["lines", "Liniert"], ["dots", "Punkte"], ["dark", "Tafel"]];
const BTPLS = [["blank", "Leer", "Freie Fläche"], ["axes", "Achsenkreuz", "x- und y-Achse"], ["mind", "Mindmap", "Thema in der Mitte"], ["proco", "Pro & Contra", "Zwei Spalten"], ["time", "Zeitstrahl", "Linie mit Punkten"]];
function boardStrokes(k, W, H, dark) {
  const col = dark ? "#ffffff" : "#111111", acc = dark ? "#8fb8ff" : "#2563eb", S = [];
  const line = (a, b, c = col, size = 4, type = "line") => S.push({ type, color: c, size, pts: [a, b] });
  const text = (t, x, y, size = 4, c = col) => S.push({ type: "text", color: c, size, text: t, pts: [[x, y]] });
  const ell = (a, b, c = col, size = 4) => S.push({ type: "ellipse", color: c, size, pts: [a, b] });
  const rect = (a, b, c = col, size = 4) => S.push({ type: "rect", color: c, size, pts: [a, b] });
  if (k === "axes") { const cx = Math.round(W / 2), cy = Math.round(H / 2); line([80, cy], [W - 80, cy], col, 4, "arrow"); line([cx, H - 80], [cx, 80], col, 4, "arrow"); text("x", W - 76, cy + 14, 3); text("y", cx + 14, 70, 3); }
  else if (k === "mind") { const cx = W / 2, cy = H / 2; ell([cx - 190, cy - 80], [cx + 190, cy + 80], acc, 5); text("Thema", cx - 62, cy - 22, 5, acc); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => { const ex = cx + sx * 520, ey = cy + sy * 280; line([cx + sx * 150, cy + sy * 62], [ex - sx * 150, ey - sy * 20], col, 3); rect([ex - 150, ey - 40], [ex + 150, ey + 40], col, 3); text("Idee " + (i + 1), ex - 50, ey - 18, 3); }); }
  else if (k === "proco") { const m = W / 2; line([m, 120], [m, H - 80], col, 4); line([80, 150], [W - 80, 150], col, 4); text("Pro", m / 2 - 36, 70, 6, dark ? "#7be0a4" : "#16a34a"); text("Contra", m + m / 2 - 70, 70, 6, dark ? "#ff9a9a" : "#e5484d"); }
  else if (k === "time") { const y = Math.round(H / 2); line([80, y], [W - 80, y], col, 5, "arrow"); for (let i = 0; i < 5; i++) { const x = 220 + i * ((W - 440) / 4); ell([x - 14, y - 14], [x + 14, y + 14], acc, 5); text("Datum", x - 52, y + 36, 3); } }
  return S;
}
function boardDialog(pre = null) {
  let folder = pre && pre.folder !== undefined ? pre.folder : docFolder, fmt = "endless", bg = "grid", tpl = "blank";
  const { el, close } = modal(`<div class="nd bd"><div class="nd-sw seg" role="tablist" aria-label="Art"><button type="button" role="tab" id="bd-swd">Dokument</button><button type="button" class="on" role="tab">Whiteboard</button><button type="button" role="tab" id="bd-swg">Design</button></div><p class="eyebrow">Neues Whiteboard</p>
  <input class="nd-name" id="bd-n" placeholder="Wie soll das Whiteboard heißen?" autocomplete="off" maxlength="80">
  <p class="bd-inf">Unendliche Fläche – in alle Richtungen verschiebbar und zoombar.</p>
  <div class="bd-sec"><label class="lbl">Hintergrund</label><div class="bd-bg" id="bd-bg">${BBGS.map(([k, n]) => `<button type="button" class="bb ${k === bg ? "on" : ""}" data-k="${k}"><i class="pv ${k}"></i><b>${n}</b></button>`).join("")}</div></div>
  <div class="row end"><button class="btn ghost" data-c>Abbrechen</button><button class="btn accent big" id="bd-go">Whiteboard erstellen</button></div></div>`, "wide nd-modal");
  const nameIn = $("#bd-n", el); if (pre && pre.name) nameIn.value = pre.name; $("#bd-swg", el).onclick = () => { const n = nameIn.value, f = folder; close(); dsCreateDialog({ name: n, folder: f }); }; $("#bd-swd", el).onclick = () => { const n = nameIn.value, f = folder; close(); docDialog("note", { name: n, folder: f }); };
  setTimeout(() => nameIn.focus(), 40);
  const pick = (id, cls, set) => $$(`#${id} .${cls}`, el).forEach(b => b.onclick = () => { set(b.dataset.k); $$(`#${id} .${cls}`, el).forEach(x => x.classList.toggle("on", x === b)); });
  pick("bd-bg", "bb", k => bg = k); 
  $("[data-c]", el).onclick = close;
  const go2 = async () => {
    if (limitHit("board")) return;
    const f = BFORMATS[0], title = nameIn.value.trim() || (tpl !== "blank" ? BTPLS.find(x => x[0] === tpl)[1] : "Neues Whiteboard"); close();
    const id = uid(); D.docs.unshift({ id, type: "draw", title, subjectId: subjectOfFolder(folder), folderId: folder, updated: Date.now(), created: Date.now(), thumb: "" });
    await KV.set("draw:" + id, { strokes: boardStrokes(tpl, f[3], f[4], bg === "dark"), bg, H: f[4], W: f[3], fmt: "endless", cam: { x: -40, y: -40, z: 1 } }); save(); go("draw/" + id);
  };
  $("#bd-go", el).onclick = go2; nameIn.onkeydown = e => { if (e.key === "Enter") go2(); };
}
