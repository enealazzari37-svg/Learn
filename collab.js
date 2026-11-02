"use strict";
/* Studix Zusammenarbeit: Notiz per Link teilen, gemeinsam schreiben (Supabase Realtime) – Teilnehmer erscheinen neben den drei Punkten.
   Modell: Wer den Link hat und angemeldet ist, kann mitschreiben. Zeichen: letzter Stand gewinnt (Cursor bleibt erhalten). */
const CO_COL = ["#d9777c", "#d9a35f", "#6fb08a", "#6f93d1", "#9b8bd0", "#d48fb0"]; /* gedeckte Farben */
const coColor = s => CO_COL[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % CO_COL.length];
const coName = () => (D.profile.name || (CLOUD.user?.email || "Gast").split("@")[0]).trim();
const coLink = id => location.origin + location.pathname + "#/app/join/" + id;
const meCol = () => D.profile.avColor || coColor(CLOUD.user?.id || coName());
const coIni = n => (String(n).trim()[0] || "?").toUpperCase();

V.join = async (m, id) => {
  m.innerHTML = `<div class="page"><div class="emptybox"><h3>Einladung wird geöffnet …</h3></div></div>`;
  const fail = t => { m.innerHTML = `<div class="page"><div class="emptybox"><h3>${esc(t)}</h3><button class="btn" onclick="location.hash='#/app'">Zur Startseite</button></div></div>`; };
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return fail("Ungültiger Einladungslink");
  if (!CLOUD.user) return fail("Bitte melde dich an, um der Zusammenarbeit beizutreten");
  if (teamPending()) { try { await plusLoad(false); } catch {} } if (teamLocked()) return fail("Gemeinsames Bearbeiten gibt es mit Studix Essential oder Study Pro – nicht im Gratis-Konto." + teamHint());
  const ex = D.docs.find(x => x.share === id); if (ex) return location.replace("#/app/doc/" + ex.id);
  const { data, error } = await CLOUD.sb.rpc("lumi_share_get", { p_id: id }); const row = data && data[0];
  if (error || !row || row.rev < 0) return fail("Diese Einladung gibt es nicht mehr");
  const nid = uid(); D.docs.unshift({ id: nid, type: "note", title: row.title || "Geteilte Notiz", subjectId: "", folderId: docFolder, paper: D.profile.paper || "white", share: id, shareRev: row.rev, updated: Date.now(), created: Date.now(), text: htmlToText(row.html) });
  await KV.set("html:" + nid, row.html || ""); await KV.set("tb:" + nid, row.tb || []); if ((row.ink || []).length) await KV.set("ink:" + nid, row.ink); save();
  toast("Du arbeitest jetzt mit – Änderungen werden live geteilt"); location.replace("#/app/doc/" + nid);
};

function collabAttach({ d, m, body, TBX, ink, dirty, svEl }) {
  const me = { key: uid(), name: coName() }; me.color = meCol();
  const av = $("#co-av", m), btn = $("#co-m", m); let ch = null, conn = "", peers = {}, lastType = 0, pend = null, tPush = 0, tSave = 0, dead = false;
  const state = () => ({ html: lumiHtml(body), tb: TBX.get(), ink: ink.st.strokes });
  let peerList = [], slot = 0, avTimer = 0;
  /* Button: ich · 2. Slot (Teilnehmende, wechselt durch) · + */
  const paintAvs = () => {
    const avs = $(".bd-avs", btn); if (!avs) return;
    const me1 = `<span class="bd-me" style="background:${meCol()}">${esc(coIni(coName()))}</span>`, inv = `<span class="bd-me inv">${ic("plus")}</span>`;
    let mid = "";
    if (d.share) { const p = peerList.length ? peerList[slot % peerList.length] : null; mid = p ? `<span class="bd-me peer" style="background:${p.color}">${esc(coIni(p.name))}</span>` : `<span class="bd-me peer empty"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg></span>`; }
    avs.innerHTML = me1 + mid + inv;
    btn.title = d.share ? (peerList.length ? "Mit dir arbeiten: " + peerList.map(x => x.name).join(", ") : "Zusammenarbeit – gerade niemand sonst online") : "Personen hinzufügen";
  };
  avTimer = setInterval(() => { if (dead) return; if (peerList.length > 1) { slot = (slot + 1) % peerList.length; paintAvs(); } }, 2600);
  const paint = () => {
    const list = Object.values(peers).map(a => a[0]).filter(Boolean);
    av.innerHTML = ""; av.title = ""; peerList = list; paintAvs(); { const sv = JSON.stringify(list.slice(0, 5).map(p => ({ n: p.name, c: p.color, o: !!p.owner }))); if (d.share && list.length && d.peers !== sv) { d.peers = sv; save(); } }
    btn.classList.toggle("on", !!d.share); btn.title = d.share ? "Zusammenarbeit" : "Zusammenarbeiten – andere einladen";
  };
  const caretOff = () => { const s = getSelection(); if (document.activeElement !== body || !s.rangeCount || !body.contains(s.anchorNode)) return -1; const r = document.createRange(); r.selectNodeContents(body); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length; };
  const setCaret = o => { if (o < 0) return; const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let n, acc = 0; while ((n = w.nextNode())) { if (acc + n.length >= o) { const r = document.createRange(); r.setStart(n, o - acc); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } acc += n.length; } };
  /* Absatzweise zusammenführen: nur Blöcke, die lokal unverändert sind, werden ersetzt – dein Absatz mit Cursor bleibt unberührt */
  let base = [];
  const blocksNow = () => [...body.children].map(e => e.outerHTML);
  function mergeHtml(html) {
    const tmp = document.createElement("div"); tmp.innerHTML = html; const rem = [...tmp.children], remH = rem.map(e => e.outerHTML);
    const loc = [...body.children], n = Math.max(rem.length, loc.length);
    for (let i = n - 1; i >= 0; i--) {
      const r = remH[i], l = loc[i] ? loc[i].outerHTML : undefined, b = base[i];
      if (r === l) continue;
      if (l !== undefined && l !== b) continue;                         // lokal geändert → behalten (wird beim nächsten Senden verteilt)
      if (r === undefined) { loc[i].remove(); continue; }
      const nn = rem[i].cloneNode(true);
      if (l === undefined) { body.appendChild(nn); continue; }
      const o = loc[i].contains(getSelection().anchorNode) ? (() => { const rg = document.createRange(); rg.selectNodeContents(loc[i]); rg.setEnd(getSelection().anchorNode, getSelection().anchorOffset); return rg.toString().length; })() : -1;
      loc[i].replaceWith(nn);
      if (o >= 0 && document.activeElement === body) { const w = document.createTreeWalker(nn, NodeFilter.SHOW_TEXT); let t, acc = 0; while ((t = w.nextNode())) { if (acc + t.length >= o) { const r2 = document.createRange(); r2.setStart(t, o - acc); r2.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r2); break; } acc += t.length; } }
    }
    base = remH;
  }
  function apply(p) {
    if (dead || !p) return;
    if (p.html != null && p.html !== lumiHtml(body)) { mergeHtml(p.html); dirty(); }
    if (p.tb && JSON.stringify(p.tb) !== JSON.stringify(TBX.get()) && !document.activeElement?.closest?.(".tbx")) { TBX.load(p.tb); KV.set("tb:" + d.id, p.tb); }
    if (p.ink && JSON.stringify(p.ink) !== JSON.stringify(ink.st.strokes)) { ink.load(p.ink); KV.set("ink:" + d.id, p.ink); }
    if (p.rev) d.shareRev = p.rev; svEl.textContent = "Gespeichert";
  }
  async function pull() { const { data } = await CLOUD.sb.rpc("lumi_share_get", { p_id: d.share }); const r = data && data[0]; if (r && r.rev < 0) { stop(); delete d.share; delete d.shareOwner; save(); paint(); toast("Die Zusammenarbeit wurde beendet"); return; } if (r && r.rev > (d.shareRev || 0)) apply({ html: r.html, tb: r.tb, ink: r.ink, rev: r.rev }); }
  async function persist() { const s = state(); const { data, error } = await CLOUD.sb.rpc("lumi_share_put", { p_id: d.share, p_title: d.title, p_html: s.html, p_tb: s.tb, p_ink: s.ink, p_who: me.name }); if (!error && data) d.shareRev = data; return s; }
  let tPersist = 0;
  function touch() {
    if (!d.share || !ch) return; lastType = Date.now(); clearTimeout(tPush); clearTimeout(tPersist);
    tPush = setTimeout(() => { const s = state(), small = JSON.stringify(s).length < 180000; base = blocksNow(); if (small) ch.send({ type: "broadcast", event: "doc", payload: { ...s, from: me.key } }); tPersist = setTimeout(async () => { await persist(); if (!small) ch.send({ type: "broadcast", event: "doc", payload: { pull: true, from: me.key } }); }, small ? 1800 : 100); }, 90);
  }
  /* Live-Mauszeiger der anderen: farbiger Pfeil mit Namensschild, gleitet weich */
  const paper = body.closest(".ned-paper") || body.parentElement, curLayer = document.createElement("div"); curLayer.className = "co-curs"; paper.appendChild(curLayer);
  const curEls = new Map(); let lastCur = 0;
  const showCur = c => {
    let e = curEls.get(c.k); if (!e) { e = document.createElement("div"); e.className = "co-cur"; e.innerHTML = `<svg viewBox="0 0 20 24"><path d="M2 2l15 8.5-6.5 1.8L8 19z"/></svg><span></span>`; curLayer.appendChild(e); curEls.set(c.k, e); e.style.transform = `translate(${c.x}px, ${c.y}px)`; }
    e.style.setProperty("--c", c.color || "#2563eb"); e.querySelector("span").textContent = c.name || "Gast"; e.classList.toggle("off", !!c.off); e.style.transform = `translate(${c.x}px, ${c.y}px)`;
    clearTimeout(e._t); e._t = setTimeout(() => e.classList.add("off"), 6000);
  };
  const sendCur = (e, off) => { if (!ch || !d.share) return; const t = Date.now(); if (!off && t - lastCur < 45) return; lastCur = t; const r = paper.getBoundingClientRect(); ch.send({ type: "broadcast", event: "cur", payload: { k: me.key, name: me.name, color: me.color, x: Math.round(e.clientX - r.left - r.width / 2), y: Math.round(e.clientY - r.top), off: !!off } }); };
  const onMove = e => sendCur(e), onLeave = e => sendCur(e, true);
  paper.addEventListener("pointermove", onMove); paper.addEventListener("pointerleave", onLeave);
  function start() {
    if (!d.share || ch || !CLOUD.sb || !CLOUD.user || teamLocked() || teamPending()) return paint();   // Gratis: keine Live-Verbindung
    ch = CLOUD.sb.channel("lumi-share-" + d.share, { config: { presence: { key: me.key }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, () => { peers = ch.presenceState(); delete peers[me.key]; paint(); curEls.forEach((e, k) => { if (!peers[k]) { e.remove(); curEls.delete(k); } }); })
      .on("broadcast", { event: "doc" }, ({ payload }) => { if (payload?.pull) pull(); else apply(payload); })
      .on("broadcast", { event: "cur" }, ({ payload }) => { if (payload && payload.k !== me.key) showCur(payload); })
      .subscribe(async st => { conn = st; if (st === "SUBSCRIBED") { await ch.track({ name: me.name, color: me.color, owner: !!d.shareOwner }); base = blocksNow(); pull(); } else if ((st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") && !dead && d.share) { stop(); setTimeout(() => { if (!dead && d.share && !ch) start(); }, 3000); } });
    paint();
  }
  const stop = () => { if (ch) { try { ch.untrack(); CLOUD.sb.removeChannel(ch); } catch {} ch = null; } conn = ""; peers = {}; paint(); };
  body.addEventListener("input", touch);
  /* Dropdown unter dem Personen-Knopf – gleiche Optik wie im Whiteboard (kein Overlay, kein Blur) */
  let pop = null, popOff = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; } if (popOff) { document.removeEventListener("pointerdown", popOff, true); document.removeEventListener("keydown", popKey, true); popOff = null; } btn.setAttribute("aria-expanded", "false"); };
  const popKey = e => { if (e.key === "Escape") closePop(); };
  btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
  btn.onclick = () => {
    if (pop) return closePop();
    if (teamLocked()) return teamUpsell("Das gemeinsame Bearbeiten von Dateien in Echtzeit");
    if (!CLOUD.user) { openPop(`<p class="sp-h">Zusammenarbeiten</p><p class="sp-n">Zum gemeinsamen Schreiben melde dich zuerst an – dann kannst du Notizen per Link teilen.</p><button class="co-pb" id="co-login">Anmelden</button>`, q => { $("#co-login", q).onclick = () => { closePop(); cloudLoginModal(); }; }); return; }
    if (!d.share && typeof freePlan === "function" && freePlan()) return proUpsell("Gemeinsam an einer Notiz schreiben – live, mit Textfeldern und Zeichnungen – gibt es mit Studix Essential und Pro. Mitschreiben, wenn dich jemand einlädt, geht auch gratis.", "Gemeinsam schreiben");
    const render = () => {
      if (!pop) return;
      if (!d.share) { pop.innerHTML = `<p class="sp-h">Zusammenarbeiten</p><p class="sp-n">Teile diese Notiz per Link. Wer den Link hat und angemeldet ist, schreibt live mit – Texte, Textfelder und Zeichnungen.</p><button class="co-pb" id="co-go">Zusammenarbeit starten</button>`;
        $("#co-go", pop).onclick = async () => { const st = state(), { data, error } = await CLOUD.sb.rpc("lumi_share_create", { p_title: d.title, p_html: st.html, p_tb: st.tb, p_ink: st.ink }); if (error || !data) return toast("Freigabe nicht möglich: " + (error?.message || "Fehler")); d.share = data; d.shareOwner = true; d.shareRev = 0; save(); start(); paint(); render(); }; return; }
      const link = coLink(d.share);
      pop.innerHTML = `<p class="sp-h">Link teilen</p><div class="sp-link"><input id="co-l" readonly value="${esc(link)}"><button id="co-cp">Kopieren</button></div>${navigator.share ? `<button class="co-sec" id="co-sh">Teilen …</button>` : ""}
        <p class="sp-h">Person einladen</p><div class="sp-inv"><input id="co-n" placeholder="E-Mail-Adresse" autocomplete="off"><button id="co-in">Einladen</button></div>
        <p class="sp-h">Zugriff <em class="co-st" id="co-st"></em></p><div class="co-ppl" id="co-ppl"></div>
        <button class="co-end" id="co-end">${d.shareOwner ? "Zusammenarbeit beenden" : "Verlassen"}</button>`;
      $("#co-cp", pop).onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link kopiert"); } catch { $("#co-l", pop).select(); } };
      $("#co-sh", pop)?.addEventListener("click", () => navigator.share({ title: d.title, url: link }).catch(() => {}));
      $("#co-in", pop).onclick = () => { const w = $("#co-n", pop).value.trim(); if (!w) return $("#co-n", pop).focus(); if (/@/.test(w)) location.href = "mailto:" + encodeURIComponent(w) + "?subject=" + encodeURIComponent("Notiz „" + (d.title || "Notiz") + "“") + "&body=" + encodeURIComponent("Schreib live mit: " + link); else toast("Gib die E-Mail-Adresse der Person ein"); };
      $("#co-end", pop).onclick = async () => { if (!await confirmBox(d.shareOwner ? "Zusammenarbeit beenden? Andere können dann nicht mehr mitschreiben, deine Notiz bleibt erhalten." : "Zusammenarbeit verlassen? Deine Kopie bleibt erhalten.", "Ja")) return; if (d.shareOwner) await CLOUD.sb.rpc("lumi_share_stop", { p_id: d.share }); stop(); delete d.share; delete d.shareOwner; save(); paint(); render(); };
      people();
    };
    const people = () => { const box = $("#co-ppl", pop || document); if (!box) return; const st = $("#co-st", pop); if (st) { st.textContent = conn === "SUBSCRIBED" ? "Live verbunden" : "Verbinde …"; st.classList.toggle("ok", conn === "SUBSCRIBED"); }
      box.innerHTML = `<span class="sp-me"><i class="bd-me" style="background:${me.color}">${esc(coIni(me.name))}</i><b>${esc(me.name)} (du)</b><em>${d.shareOwner ? "Inhaber:in" : "Mitglied"}</em></span>` + (peerList.map(p => `<span class="sp-me"><i class="bd-me" style="background:${p.color}">${esc(coIni(p.name))}</i><b>${esc(p.name)}</b><em class="on">online</em></span>`).join("") || `<small class="note">Noch niemand sonst online.</small>`); };
    openPop("", () => { render(); const t = setInterval(() => { if (!pop) return clearInterval(t); people(); }, 2000); });
  };
  function openPop(html, ready) {
    pop = document.createElement("div"); pop.className = "co-pop"; pop.id = "copop"; pop.innerHTML = html; document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(); pop.style.top = r.bottom + 8 + "px"; pop.style.right = Math.max(8, innerWidth - r.right) + "px";
    btn.setAttribute("aria-expanded", "true");
    popOff = e => { if (!pop.contains(e.target) && !e.target.closest("#co-m")) closePop(); };
    setTimeout(() => { if (pop) { document.addEventListener("pointerdown", popOff, true); document.addEventListener("keydown", popKey, true); } });
    ready && ready(pop);
  }
  window.__co = { touch };
  /* Beim direkten Öffnen/Neuladen ist die Anmeldung evtl. noch nicht fertig – so lange warten, bis die Verbindung steht */
  const boot = setInterval(() => { if (dead || ch || !d.share) { if (dead) clearInterval(boot); return; } if (CLOUD.sb && CLOUD.user) start(); }, 700); setTimeout(() => clearInterval(boot), 60000);
  start(); paint();
  return { touch, destroy() { dead = true; clearInterval(boot); clearInterval(avTimer); closePop(); clearTimeout(tPush); clearTimeout(tPersist); paper.removeEventListener("pointermove", onMove); paper.removeEventListener("pointerleave", onLeave); curLayer.remove(); if (d.share && ch) persist().catch(() => {}); stop(); if (window.__co && window.__co.touch === touch) window.__co = null; } };
}
