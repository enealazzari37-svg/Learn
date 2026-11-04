"use strict";
/* Studix Voice – Sprachgespräch mit Studix AI: Mikrofon → Antwort derselben KI-Modelle → natürliche Stimme (Google Gemini TTS, sonst Systemstimme).
   Die animierte Kugel ist eigens gezeichnet (Canvas) und reagiert auf Zuhören, Denken und Sprechen. */

/* Stimmen: „or:“ = OpenRouter (HeyGen Voice Turbo, serverseitig über /api/tts); Thorsten läuft direkt im Browser (Notlösung ohne Server) */
const VC_VOICES = [["or:nadine", "Nadine"], ["or:tabitha", "Tabitha"], ["or:noelle", "Noelle"], ["or:meredith", "Meredith"], ["or:sabrina", "Sabrina"], ["or:bram", "Bram"], ["or:gareth", "Gareth"], ["or:lucian", "Lucian"], ["or:weston", "Weston"], ["or:vincent", "Vincent"], ["de_DE-thorsten-medium", "Thorsten · klar (Browser)"], ["de_DE-thorsten_emotional-medium", "Thorsten · lebhaft (Browser)"]];
const vcCloud = id => String(id).startsWith("or:");
/* Sprachausgabe: Piper (MIT, Stimme „Thorsten“ CC0) läuft direkt im Browser – kein Server, kein Limit. Modell (~60 MB) wird einmal geladen und im Browser gespeichert. */
const VC_PIPER = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm", VC_ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
let vcMod = null, vcSes = {};
async function vcPiper(voiceId) {
  vcMod = vcMod || await import(VC_PIPER);
  if (!vcSes[voiceId]) { vcMod.TtsSession._instance = null; vcSes[voiceId] = vcMod.TtsSession.create({ voiceId, wasmPaths: { ...vcMod.TtsSession.WASM_LOCATIONS, onnxWasm: VC_ORT } }).catch(e => { delete vcSes[voiceId]; throw e; }); }
  return vcSes[voiceId];
}
const vcLang = () => "de-DE";   // immer Hochdeutsch, auch für Schweizer Konten

/* ---------- die Kugel ---------- */
function vcOrb(cv, get) {
  const ctx = cv.getContext("2d"); let W = 0, H = 0, raf = 0, t0 = performance.now(), lv = 0, phase = 0, mix = { think: 0, speak: 0, listen: 0 };
  const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = cv.width = Math.round(r.width * d); H = cv.height = Math.round(r.height * d); };
  fit(); const ro = new ResizeObserver(fit); ro.observe(cv);
  const lerp = (a, b, k) => a + (b - a) * k;
  function frame(now) {
    if (!cv.isConnected) { ro.disconnect(); return; }
    const { state, level } = get(), dt = Math.min(.05, (now - t0) / 1000); t0 = now;
    lv = lerp(lv, level, state === "speaking" || state === "listening" ? .22 : .08);
    for (const k of ["think", "speak", "listen"]) mix[k] = lerp(mix[k], (state === "thinking" && k === "think") || (state === "speaking" && k === "speak") || (state === "listening" && k === "listen") ? 1 : 0, .06);
    phase += dt * (.55 + mix.listen * .5 + mix.speak * 1.2 + mix.think * 2.4);
    const t = now / 1000, cx = W / 2, cy = H / 2, R = Math.min(W, H) * .31 * (1 + .018 * Math.sin(t * 1.3) + lv * .05);
    ctx.clearRect(0, 0, W, H);
    /* weicher Schein ausserhalb */
    const gO = Math.min(W, H) / 2, gl = ctx.createRadialGradient(cx, cy, R * .8, cx, cy, gO);
    gl.addColorStop(0, `rgba(150,160,255,${.22 + lv * .25 + mix.think * .08})`); gl.addColorStop(.5, "rgba(190,170,255,.07)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    /* Schatten unter der Kugel */
    const sh = ctx.createRadialGradient(cx, cy + R * 1.18, R * .1, cx, cy + R * 1.18, R * .9); sh.addColorStop(0, "rgba(90,100,130,.20)"); sh.addColorStop(1, "rgba(90,100,130,0)");
    ctx.save(); ctx.scale(1, .32); ctx.translate(0, (cy + R * 1.18) / .32 - (cy + R * 1.18)); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy + R * 1.18, R * .9, 0, 7); ctx.fill(); ctx.restore();
    /* Körper */
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    const body = ctx.createRadialGradient(cx - R * .3, cy - R * .45, R * .1, cx, cy, R * 1.05);
    body.addColorStop(0, "#f7f8ff"); body.addColorStop(.45, "#e4e7fb"); body.addColorStop(.8, "#c9d3f5"); body.addColorStop(1, "#b4c3f0"); ctx.fillStyle = body; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    const warm = ctx.createRadialGradient(cx - R * .85, cy + R * .1, 0, cx - R * .85, cy + R * .1, R * 1.1); warm.addColorStop(0, `rgba(255,150,200,${.55 + mix.speak * .2})`); warm.addColorStop(1, "rgba(255,150,200,0)"); ctx.fillStyle = warm; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    const cool = ctx.createRadialGradient(cx + R * .35, cy + R * .95, 0, cx + R * .35, cy + R * .95, R * 1.1); cool.addColorStop(0, `rgba(110,170,255,${.6 + mix.listen * .15})`); cool.addColorStop(1, "rgba(110,170,255,0)"); ctx.fillStyle = cool; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    /* Band aus feinen Linien (wie ein gewebtes Licht), reagiert auf Pegel und Zustand */
    const amp = R * (.1 + lv * .38 + mix.think * .08 + .02 * Math.sin(t * .9)), n = 34, span = R * 1.9, x0 = -span / 2, rot = (mix.think * Math.sin(t * .8) * .35) + Math.sin(t * .35) * .08 - .1;
    ctx.save(); ctx.translate(cx, cy + R * .03); ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), off = (f - .5) * R * (.22 + lv * .3), g = ctx.createLinearGradient(x0, 0, x0 + span, 0);
      g.addColorStop(0, "rgba(255,110,190,0)"); g.addColorStop(.2, `rgba(255,110,190,${.5 + f * .3})`); g.addColorStop(.55, `rgba(150,120,255,${.55})`); g.addColorStop(.85, `rgba(60,190,255,${.65 - f * .2})`); g.addColorStop(1, "rgba(60,190,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, R * .0075); ctx.beginPath();
      for (let s = 0; s <= 64; s++) { const u = s / 64, x = x0 + u * span, env = Math.pow(Math.sin(Math.PI * u), 1.6), y = off + env * amp * (Math.sin(u * 5.2 + phase + f * 1.4) * .6 + Math.sin(u * 9.1 - phase * 1.3 + f * 2.2) * .4) + (u - .5) * R * .12; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    /* zweite, feine Kurve unten rechts */
    ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = "rgba(150,170,255,.8)"; ctx.lineWidth = Math.max(1, R * .006);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); for (let s = 0; s <= 40; s++) { const u = s / 40, x = cx + R * (.15 + u * .75) - i * R * .015, y = cy + R * (.15 + u * .85) - Math.sin(u * 3.1 + phase * .6) * R * .06 * (1 + lv) + i * R * .012; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.restore();
    /* Glanz oben, Rand */
    const hl = ctx.createRadialGradient(cx - R * .1, cy - R * .78, 0, cx - R * .1, cy - R * .78, R * .75); hl.addColorStop(0, "rgba(255,255,255,.95)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save(); ctx.scale(1, .55); ctx.translate(0, (cy - R * .78) / .55 - (cy - R * .78)); ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(cx - R * .1, cy - R * .78, R * .75, 0, 7); ctx.fill(); ctx.restore();
    const rim = ctx.createRadialGradient(cx, cy, R * .78, cx, cy, R); rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(1, "rgba(255,255,255,.55)"); ctx.fillStyle = rim; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

/* ---------- die Seite ---------- */
V.voice = m => {
  m.classList.add("voicepg");
  if (aiOff()) { m.innerHTML = `<div class="vc"><div class="vc-top"><button class="btn ghost small" id="vc-back" type="button">${ic("back")}Studix AI</button></div><div style="max-width:420px;margin:90px auto;text-align:center;padding:0 20px"><h2 style="margin-bottom:10px">KI ist ausgeschaltet</h2><p class="note">Studix Voice nutzt Mikrofon und KI-Anbieter. Solange die KI ausgeschaltet ist, wird nichts aufgenommen oder gesendet. Du kannst sie unter Einstellungen → Studix AI wieder einschalten.</p></div></div>`; const bk = m.querySelector("#vc-back"); if (bk) bk.onclick = () => go("ai"); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const S = { state: "idle", level: 0, hist: [], paused: false, alive: true, voice: (VC_VOICES.find(v => v[0] === LS.get("lumi-voice")) || VC_VOICES[0])[0], ac: null, mic: null, micAn: null, outAn: null, src: null, rec: null, token: 0, chat: null, pip: null, pipQ: Promise.resolve() };
  const serverOk = typeof serverAI !== "undefined" && serverAI && typeof CLOUD !== "undefined" && CLOUD.user;
  m.innerHTML = `<div class="vc"><div class="vc-top"><button class="btn ghost small" id="vc-back" type="button">${ic("back")}Studix AI</button>
      <label class="vc-v"><span>Stimme</span><select id="vc-sel" class="field flat">${VC_VOICES.map(([k, n]) => `<option value="${k}" ${S.voice === k ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <div class="vc-stage" data-keep-colors><canvas id="vc-orb" aria-hidden="true"></canvas></div>
    <p class="vc-st" id="vc-st" aria-live="polite">Bereit</p>
    <div class="vc-sub"><p class="vc-u" id="vc-u"></p><p class="vc-a" id="vc-a"></p></div>
    <div class="vc-ctl"><button class="vc-mic" id="vc-mic" type="button" aria-label="Mikrofon an oder aus">${ic("mic")}</button><button class="btn ghost" id="vc-end" type="button">Beenden</button></div>
    <p class="ai-note vc-note">Studix AI ist eine KI und kann Fehler machen – prüfe wichtige Antworten. Studix AI wird mit Unterstützung von Google Gemini und Groq betrieben.</p></div>`;
  const $$st = $("#vc-st", m), $u = $("#vc-u", m), $a = $("#vc-a", m), $mic = $("#vc-mic", m);
  const setSt = (st, text) => { S.state = st; $$st.textContent = text; $mic.classList.toggle("on", st === "listening"); m.dataset.vs = st; };
  const stopOrb = vcOrb($("#vc-orb", m), () => ({ state: S.state, level: S.level }));

  /* ---- Audio-Grundlagen ---- */
  const ctx = () => S.ac || (S.ac = new (window.AudioContext || window.webkitAudioContext)());
  const rms = an => { const b = new Uint8Array(an.fftSize); an.getByteTimeDomainData(b); let s = 0; for (const v of b) { const x = (v - 128) / 128; s += x * x; } return Math.sqrt(s / b.length); };
  const meter = () => { if (!S.alive) return; let lvl = 0; if (S.state === "listening" && S.micAn) lvl = Math.min(1, rms(S.micAn) * 5); else if (S.state === "speaking" && S.outAn) lvl = Math.min(1, rms(S.outAn) * 4.5); else if (S.state === "speaking") lvl = .25 + .2 * Math.abs(Math.sin(performance.now() / 160)); S.level = lvl; requestAnimationFrame(meter); }; requestAnimationFrame(meter);
  async function openMic() { if (S.mic) return true; try { S.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); const ac = ctx(); const src = ac.createMediaStreamSource(S.mic); S.micAn = ac.createAnalyser(); S.micAn.fftSize = 1024; src.connect(S.micAn); return true; } catch { setSt("idle", "Mikrofon nicht erlaubt – erlaube den Zugriff in der Adresszeile"); return false; } }

  /* ---- Zuhören ---- */
  async function listen() {
    if (!S.alive || S.paused) return; const tk = ++S.token; if (!(await openMic())) return;
    ctx().resume?.(); setSt("listening", "Ich höre zu …"); $u.textContent = ""; stopRec();
    if (SR && !S.noSR) {
      const rec = S.rec = new SR(); rec.lang = vcLang(); rec.interimResults = true; rec.continuous = false; let fin = "", got = false;
      rec.onresult = e => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else it += r[0].transcript; } $u.textContent = (fin + it).trim(); got = true; };
      rec.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setSt("idle", "Mikrofon nicht erlaubt"); S.paused = true; } else if (e.error === "network" || e.error === "audio-capture") { S.noSR = true; } };
      rec.onend = () => { if (tk !== S.token || !S.alive) return; const txt = (fin || $u.textContent).trim(); if (txt.length > 1) respond(txt); else if (!S.paused) setTimeout(() => S.state === "listening" && tk === S.token && listen(), S.noSR ? 0 : 250); };
      try { rec.start(); } catch { S.noSR = true; listen(); }
    } else recordFallback(tk);
  }
  function stopRec() { try { S.rec && (S.rec.onend = null, S.rec.abort()); } catch {} S.rec = null; try { S.mr && S.mr.state !== "inactive" && S.mr.stop(); } catch {} }
  /* Ohne eingebaute Spracherkennung (Firefox, Windows-App): Aufnahme mit Stille-Erkennung, Text kommt vom Server */
  function recordFallback(tk) {
    const mr = S.mr = new MediaRecorder(S.mic), chunks = []; let started = false, quiet = 0, t0 = performance.now(), loud = 0;
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => { clearInterval(iv); if (tk !== S.token || !S.alive) return; if (!started || loud < 4) { return !S.paused && S.state === "listening" && listen(); } setSt("thinking", "Verstehe …"); try { const buf = await new Blob(chunks, { type: mr.mimeType }).arrayBuffer(); let b = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) b += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); const j = await vcPost("/api/stt", { audio: btoa(b), mime: mr.mimeType }); const txt = (j.text || "").trim(); if (txt.length > 1) respond(txt); else listen(); } catch (e) { toast(e.message); setSt("idle", "Das hat nicht geklappt – tippe auf das Mikrofon"); S.paused = true; $mic.classList.remove("on"); } };
    const iv = setInterval(() => { if (tk !== S.token || !S.alive) { clearInterval(iv); try { mr.state !== "inactive" && mr.stop(); } catch {} return; } const l = rms(S.micAn); if (l > .035) { loud++; quiet = 0; if (!started) { started = true; } $u.textContent = "…"; } else if (started) quiet += 60; if ((started && quiet > 1100) || performance.now() - t0 > 25000 || (!started && performance.now() - t0 > 12000)) { clearInterval(iv); try { mr.state !== "inactive" && mr.stop(); } catch {} } }, 60);
    mr.start(250);
  }
  async function vcPost(path, body) { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (r.status === 402 && j.pro && typeof proUpsell === "function") proUpsell(j.error); if (!r.ok) throw Object.assign(new Error(j.error || "Fehler " + r.status), { status: r.status, fallback: j.fallback, limit: j.limit }); return j; }

  /* ---- Antworten ---- */
  const clean = t => String(t || "").replace(/<lumi-actions>[\s\S]*?(<\/lumi-actions>|$)/g, "").replace(/\[(\d+)\]/g, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#>~|]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s+/g, " ").trim();
  async function respond(text) {
    stopRec(); const tk = ++S.token; $u.textContent = text; $a.textContent = ""; setSt("thinking", "Denke nach …");
    const c = typeof ctxText === "function" ? await ctxText().catch(() => "") : "";
    const sys = sysBase("Du sprichst gerade per Sprache mit der lernenden Person. Sprich ausschließlich Hochdeutsch (Standarddeutsch), niemals Schweizerdeutsch oder Dialekt, und verwende deutsche Wörter statt Helvetismen (z. B. Fahrrad statt Velo). Dein gesprochener Teil ist kurz und natürlich, meist 1 bis 3 Sätze, ohne Markdown, ohne Listen, ohne Emojis und ohne Sonderzeichen. Sprich Formeln in Worten aus. Frage bei Bedarf kurz nach. Nenne keine Quellenmarker. Du kannst die ganze App bedienen: Wenn die Person etwas erstellen, ändern, eintragen oder löschen will (Notizen, Dokumente, Aufgaben, Termine, Noten, Karteikarten, Prüfungen …), tu es mit einem <lumi-actions>-Block, den niemand vorgelesen bekommt. Der Inhalt in den Aktionen (z. B. der Text einer Notiz) darf ausführlich sein, dein gesprochener Satz davor bleibt kurz. Die Aktion „open“ benutzt du nicht, weil das Gespräch offen bleibt.\n\n" + AGENT_RULES + "\n\nAktueller Stand der App:\n" + agentContext() + (c ? "\nUnterlagen des Lernenden:\n" + c : ""));
    let reply = await ai(text, { system: sys, history: S.hist.slice(-12), max: 1800, model: "groq:llama-3.3-70b-versatile", temperature: .5 }), acts = [];
    if (reply && /<lumi-actions>/i.test(reply)) {
      try { reply = reply.replace(/<lumi-actions>([\s\S]*?)<\/lumi-actions>/i, (all, j) => { try { const l = JSON.parse(j.trim().replace(/^```(json)?|```$/g, "")); return "<lumi-actions>" + JSON.stringify((Array.isArray(l) ? l : [l]).filter(a => a && a.action !== "open")) + "</lumi-actions>"; } catch { return all; } }); const o = await runAgent(reply, { stay: true }); reply = o.text; acts = o.acts; } catch (e) { reply = reply.replace(/<lumi-actions>[\s\S]*/i, "").trim(); }
    }
    if (tk !== S.token || !S.alive) return;
    if (!reply) { setSt("idle", "Keine Antwort – tippe auf das Mikrofon"); S.paused = true; $mic.classList.remove("on"); return; }
    const say = clean(reply) + (acts.some(x => x.err) ? " Das hat leider nicht ganz geklappt." : ""); S.hist.push({ role: "user", text }, { role: "assistant", text: say }); keep(text, say);
    $a.textContent = say + (acts.length ? "\n" + acts.map(x => (x.err ? "✕ " : "✓ ") + x.label).join("\n") : ""); await speak(say, tk);
    if (tk === S.token && S.alive && !S.paused) listen();
  }
  function keep(q, a) { try { D.chats = D.chats || []; let c = S.chat || D.chats.find(x => x.voice); if (!c) { c = { id: uid(), title: "Voice-Chat", projectId: "", instr: "", msgs: [], updated: Date.now(), voice: true }; D.chats.unshift(c); } S.chat = c; c.msgs.push({ role: "user", text: q }, { role: "assistant", text: a }); c.msgs = c.msgs.slice(-80); c.updated = Date.now(); save(); } catch {} }

  /* ---- Sprechen ---- */
  const sentences = t => { const out = []; let cur = ""; const m1 = t.match(/^(.{20,140}?[.!?…])\s+(?=\S)/); if (m1 && t.length > m1[0].length + 20) { out.push(m1[1]); t = t.slice(m1[0].length); } for (const s of t.split(/(?<=[.!?…])\s+/)) { if ((cur + " " + s).trim().length > 230 && cur) { out.push(cur.trim()); cur = s; } else cur = (cur + " " + s).trim(); } if (cur) out.push(cur); return out.length ? out : [t]; };
  async function speak(text, tk) {
    setSt("speaking", "Spreche …"); const parts = sentences(text);
    const cloud = p => vcPost("/api/tts", { text: p, voice: S.voice.slice(3) }).then(j => { const bin = atob(j.audio), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); return ctx().decodeAudioData(u8.buffer); })
      .catch(e => { if (!S.cloudMsg) { S.cloudMsg = true; toast(e.status === 503 ? "Die Stimme ist noch nicht eingerichtet – es wird die Browser-Stimme genutzt." : "Die Stimme ist gerade nicht erreichbar – es wird die Browser-Stimme genutzt."); } if (e.status === 503 || e.status === 402) S.cloudOff = true; else { S.cloudRetry = Date.now() + 60000; } if (!S.pip && !S.pipLoading) { S.pipLoading = true; vcPiper("de_DE-thorsten-medium").then(ses => { S.pip = ses; }).catch(() => {}); } return null; });
    const useCloud = () => vcCloud(S.voice) && !S.cloudOff && !(S.cloudRetry && Date.now() < S.cloudRetry);
    const fetchPart = p => useCloud() ? cloud(p) : S.pip ? (S.pipQ = S.pipQ.catch(() => {}).then(() => S.pip.predict(p)).then(bl => bl.arrayBuffer()).then(ab => ctx().decodeAudioData(ab))).catch(() => null) : Promise.resolve(null);
    let next = fetchPart(parts[0]);
    for (let i = 0; i < parts.length; i++) {
      if (tk !== S.token || !S.alive) return; const buf = await next; next = i + 1 < parts.length ? fetchPart(parts[i + 1]) : null;
      if (tk !== S.token || !S.alive) return;
      if (buf) await new Promise(res => { const ac = ctx(); ac.resume?.(); const src = ac.createBufferSource(); src.buffer = buf; if (!S.outAn) { S.outAn = ac.createAnalyser(); S.outAn.fftSize = 1024; S.outAn.connect(ac.destination); } src.connect(S.outAn); S.src = src; src.onended = res; src.start(); });
      else await synth(parts.slice(i).join(" "), tk), i = parts.length;
    }
    S.src = null;
  }
  /* Notlösung: beste verfügbare deutsche Systemstimme */
  function bestVoice() { const vs = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang)); const score = v => (/natural|neural|online/i.test(v.name) ? 5 : 0) + (/google/i.test(v.name) ? 3 : 0) + (v.lang.toLowerCase() === vcLang().toLowerCase() ? 2 : 0) + (v.localService ? 0 : 1); return vs.sort((a, b) => score(b) - score(a))[0]; }
  function synth(text, tk) { return new Promise(res => { if (!("speechSynthesis" in window)) return res(); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = vcLang(); const v = bestVoice(); if (v) u.voice = v; u.rate = 1.02; u.onend = u.onerror = () => res(); S.synthOn = true; speechSynthesis.speak(u); const iv = setInterval(() => { if (tk !== S.token || !S.alive) { speechSynthesis.cancel(); clearInterval(iv); res(); } else if (!speechSynthesis.speaking) clearInterval(iv); }, 200); }); }
  function interrupt() { S.token++; try { S.src && S.src.stop(); } catch {} S.src = null; try { "speechSynthesis" in window && speechSynthesis.cancel(); } catch {} stopRec(); }

  /* ---- Bedienung ---- */
  $mic.onclick = () => { ctx().resume?.(); try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {} if (S.state === "listening") { S.paused = true; interrupt(); setSt("idle", "Pausiert – tippe auf das Mikrofon"); } else { S.paused = false; interrupt(); listen(); } };
  $("#vc-orb", m).onclick = () => { if (S.state === "speaking") { interrupt(); S.paused = false; listen(); } };
  const loadVoice = (say) => { S.pip = null; if (vcCloud(S.voice)) { S.cloudOff = false; S.cloudRetry = 0; S.cloudMsg = false; say && speak("Hallo, so klingt diese Stimme.", ++S.token).then(() => !S.paused && listen()); return; } vcPiper(S.voice).then(ses => { if (!S.alive) return; S.pip = ses; say && speak("Hallo, so klingt diese Stimme.", ++S.token).then(() => !S.paused && listen()); }).catch(() => toast("Natürliche Stimme konnte nicht geladen werden – es wird die Systemstimme genutzt.")); };
  $("#vc-sel", m).onchange = e => { S.voice = e.target.value; LS.set("lumi-voice", S.voice); interrupt(); toast(vcCloud(S.voice) ? "Stimme wird gewechselt …" : "Stimme wird geladen …"); loadVoice(true); };
  if (!vcCloud(S.voice) && !vcSes[S.voice]) toast("Natürliche Stimme wird einmalig geladen (ca. 60 MB) …");
  loadVoice(false);
  const leave = () => { S.alive = false; interrupt(); stopOrb(); try { S.mic && S.mic.getTracks().forEach(t => t.stop()); S.ac && S.ac.close(); } catch {} };
  LEAVE.push(leave);
  $("#vc-back", m).onclick = () => go("ai"); $("#vc-end", m).onclick = () => go("ai");

  if (!serverOk) { setSt("idle", "Melde dich an, um mit Studix AI zu sprechen"); $mic.disabled = true; return; }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { setSt("idle", "Dieser Browser erlaubt kein Mikrofon"); $mic.disabled = true; return; }
  setSt("idle", "Tippe auf das Mikrofon und sprich los"); $a.textContent = "Frag mich etwas zu deinen Fächern, lass dir etwas erklären oder übe mit mir.";
};
