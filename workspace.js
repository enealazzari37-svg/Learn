"use strict";
/* Pro: Workspace schneller abfragen (Essential/Gratis seltener, spart Datenverkehr; im Hintergrund-Tab gar nicht) */
const wsPollMs = (slow, fast) => { try { return isPlus() && !isEss() ? fast : slow; } catch { return slow; } };
/* Studix Workspaces: gemeinsame Bereiche mit Mitgliedern, Rollen (Admin/Mitglied), Ordnern und gemeinsam bearbeiteten Dokumenten.
   Alle Daten liegen in Supabase (supabase/workspace.sql) und werden nur über Funktionen gelesen/geschrieben, die Mitgliedschaft und Rolle prüfen.
   Dokumente sind geteilte Notizen (wie „Zusammenarbeiten“): jedes Mitglied öffnet sie im normalen Editor und schreibt live mit. */

(() => { const m = (location.hash.match(/wsjoin\/([0-9a-f]{10})/) || [])[1]; if (m) { try { LS.set("ws-pending", m); } catch {} } })();   // Code merken, falls erst noch angemeldet werden muss

const WS_TEAM = '<circle cx="9" cy="9" r="3.4"/><path d="M3.5 19.2c.4-3.1 2.7-5 5.5-5s5.1 1.9 5.5 5"/><circle cx="17" cy="9.8" r="2.6"/><path d="M16.2 14.5c2.4-.2 4.3 1.4 4.8 4"/>';
SDK.adduser = '<circle cx="10" cy="8.5" r="3.6"/><path d="M3.8 19.3c.5-3.2 3-5.2 6.2-5.2s5.7 2 6.2 5.2M18 8v5M15.5 10.5h5"/>'; SDK.more = '<path d="M6 12h.01M12 12h.01M18 12h.01"/>';
P.team = WS_TEAM; P["team-f"] = '<g stroke-width="2.7">' + WS_TEAM + '</g>';

const wsRpc = async (fn, args = {}) => {
  if (!CLOUD.sb || !CLOUD.user) throw new Error("login required");
  const { data, error } = await CLOUD.sb.rpc(fn, args); if (error) throw error; return data;
};
const wsMsg = e => { const t = String(e?.message || e || ""); return /login required/.test(t) ? "Bitte melde dich an." : /invalid code/.test(t) ? "Diesen Code gibt es nicht." : /no access/.test(t) ? "Kein Zugriff auf diesen Workspace." : /admin only/.test(t) ? "Das dürfen nur Admins." : /last admin/.test(t) ? "Es muss mindestens ein Admin bleiben." : /workspace limit/.test(t) ? "Du hast schon 20 Workspaces." : t || "Fehler"; };
const wsWho = () => (D.profile.name || (CLOUD.user?.email || "Gast").split("@")[0]).trim();
const wsLink = c => location.origin + location.pathname + "#/app/wsjoin/" + c;
const wsIni = n => (String(n).trim()[0] || "?").toUpperCase();
const wsCol = n => CO_COL[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % CO_COL.length];
const wsGate = (m, text) => { m.innerHTML = `<div class="page"><div class="emptybox"><div class="big-ic">${ic("team")}</div><h3>Workspace</h3><p>${esc(text)}</p><button class="btn primary" id="ws-login">Anmelden</button></div></div>`; $("#ws-login", m).onclick = () => cloudLoginModal(); };

/* ---------- Übersicht ---------- */
async function wsHome(m) {
  if (!CLOUD.user) return wsGate(m, "Melde dich an, um gemeinsame Workspaces zu erstellen oder einem beizutreten.");
  const pend = (() => { try { return LS.get("ws-pending"); } catch { return ""; } })();
  if (pend) { try { LS.set("ws-pending", ""); const id = await wsRpc("lumi_ws_join", { p_code: pend, p_who: wsWho() }); toast("Du bist dem Workspace beigetreten"); return go("workspace/" + id); } catch (e) { toast(wsMsg(e)); } }
  m.innerHTML = `<div class="ned dfull docsed">${pageHead("<b>Workspace</b>", `${dkAct("adduser", "Mit Code beitreten", 'id="ws-join"')}<i class="sdk-sep" aria-hidden="true"></i>${dkAct("plus", "Neuer Workspace", 'id="ws-new"')}`)}
    <article class="ned-paper docspaper" id="paperc"><div class="dmain"><div class="emptybox"><h3>Wird geladen …</h3></div></div></article></div>`;
  setScroller($("#paperc", m));
  const draw = async () => {
    let list = []; try { list = await wsRpc("lumi_ws_list"); } catch (e) { $(".dmain", m).innerHTML = `<div class="emptybox"><h3>${esc(wsMsg(e))}</h3></div>`; return; }
    const box = $(".dmain", m); if (!box) return;
    box.innerHTML = list.length ? `<div class="dtl"><h3 class="dsec">Deine Workspaces<small>${list.length}</small></h3><div class="ws-grid">${list.map(w => `<button class="ws-card" data-w="${w.id}"><span class="ws-ic">${ic("team")}</span><b>${esc(w.name)}</b><small>${w.members} ${w.members === 1 ? "Mitglied" : "Mitglieder"} · ${w.role === "admin" ? "Admin" : "Mitglied"}</small></button>`).join("")}</div></div>`
      : `<div class="emptybox"><div class="big-ic">${ic("team")}</div><h3>Noch kein Workspace</h3><p>Erstelle einen Workspace und lade andere ein. Alle Mitglieder arbeiten dort gemeinsam in Ordnern und Dokumenten.</p><div class="row" style="justify-content:center;gap:10px"><button class="btn primary" id="ws-new2">Workspace erstellen</button><button class="btn ghost" id="ws-join2">Mit Code beitreten</button></div></div>`;
    $$("[data-w]", box).forEach(b => b.onclick = () => go("workspace/" + b.dataset.w));
    $("#ws-new2", box)?.addEventListener("click", wsNew); $("#ws-join2", box)?.addEventListener("click", wsJoin);
  };
  const wsNew = async () => { if (freePlan()) return proUpsell("Eigene Workspaces für Lerngruppen gibt es mit Studix Essential und Pro. Einem Workspace beitreten kannst du auch gratis.", "Workspace erstellen"); const n = await ask("Neuer Workspace", { placeholder: "z. B. Lerngruppe Mathe", ok: "Erstellen" }); if (!n || !n.trim()) return; try { const id = await wsRpc("lumi_ws_create", { p_name: n.trim(), p_who: wsWho() }); go("workspace/" + id); } catch (e) { toast(wsMsg(e)); } };
  const wsJoin = async () => { const c = await ask("Mit Code beitreten", { placeholder: "Einladungscode", ok: "Beitreten" }); if (!c || !c.trim()) return; const code = (c.trim().match(/[0-9a-f]{10}/i) || [c.trim()])[0]; try { const id = await wsRpc("lumi_ws_join", { p_code: code, p_who: wsWho() }); toast("Du bist dem Workspace beigetreten"); go("workspace/" + id); } catch (e) { toast(wsMsg(e)); } };
  $("#ws-new", m).onclick = wsNew; $("#ws-join", m).onclick = wsJoin;
  await draw();
}

/* ---------- Einladungslink ---------- */
V.wsjoin = async (m, code) => {
  m.innerHTML = `<div class="page"><div class="emptybox"><h3>Einladung wird geöffnet …</h3></div></div>`;
  if (!CLOUD.user) return wsGate(m, "Bitte melde dich an, um dem Workspace beizutreten.");
  if (teamPending()) { try { await plusLoad(false); } catch {} } if (teamLocked()) return wsPaywall(m);
  try { try { LS.set("ws-pending", ""); } catch {} const id = await wsRpc("lumi_ws_join", { p_code: String(code || ""), p_who: wsWho() }); toast("Du bist dem Workspace beigetreten"); location.replace("#/app/workspace/" + id); }
  catch (e) { m.innerHTML = `<div class="page"><div class="emptybox"><h3>${esc(wsMsg(e))}</h3><button class="btn" onclick="location.hash='#/app/workspace'">Zu den Workspaces</button></div></div>`; }
};

/* ---------- Workspace öffnen ---------- */
const wsPaywall = m => { m.innerHTML = `<div class="page"><div class="emptybox"><div class="big-ic">${ic("team")}</div><h3>Workspace</h3><p>Gemeinsame Workspaces und das Bearbeiten von Dateien in Echtzeit gibt es mit Studix Essential und Studix Study Pro – nicht im Gratis-Konto.${esc(teamHint())}</p><button class="btn primary" id="ws-up">Pläne ansehen</button></div></div>`; $("#ws-up", m).onclick = () => { window.__setTab = "pro"; go("settings"); }; };
V.workspace = async (m, id, fid = "") => { if (teamPending()) { try { await plusLoad(false); } catch {} } return teamLocked() ? wsPaywall(m) : id ? wsOpen(m, id, fid) : wsHome(m); };

async function wsOpen(m, wid, fid) {
  if (!CLOUD.user) return wsGate(m, "Melde dich an, um diesen Workspace zu öffnen.");
  let W = null, busy = false, dead = false, sig = "";
  LEAVE.push(() => { dead = true; });
  const folderOf = id => W.folders.find(f => f.id === id), kids = p => W.folders.filter(f => (f.parent || "") === (p || ""));
  const pathOf = id => { const out = []; let f = folderOf(id); while (f) { out.unshift(f); f = folderOf(f.parent); } return out; };
  const nameOf = uid_ => (W.members.find(x => x.user_id === uid_) || {}).name || "Mitglied";
  const isAdmin = () => W.role === "admin";
  const load = async () => {
    const w = await wsRpc("lumi_ws_get", { p_ws: wid });
    /* Titel geteilter Dokumente, die du lokal umbenannt hast, in den Workspace übernehmen */
    (w.items || []).forEach(it => { const d = D.docs.find(x => x.share === it.share_id); if (d && d.title && d.title !== it.title) { it.title = d.title; wsRpc("lumi_ws_item_update", { p_ws: wid, p_id: it.id, p_title: d.title, p_folder: null, p_move: false }).catch(() => {}); } });
    return w;
  };
  try { W = await load(); } catch (e) { m.innerHTML = `<div class="page"><div class="emptybox"><h3>${esc(wsMsg(e))}</h3><button class="btn" onclick="location.hash='#/app/workspace'">Zu den Workspaces</button></div></div>`; return; }
  if (fid && !folderOf(fid)) fid = "";
  let wsTab = (() => { try { return LS.get("ws-tab") === "docs" ? "docs" : "dash"; } catch { return "dash"; } })();
  const draw = () => {
    if (dead) return;
    const path = pathOf(fid), folders = kids(fid), items = W.items.filter(i => (i.folder_id || "") === (fid || ""));
    const crumbHtml = `<button class="cr" data-gows="">Workspace</button><i>/</i>` + (path.length ? `<button class="cr" data-gows="${wid}">${esc(W.name)}</button>` : `<b>${esc(W.name)}</b>`) + path.map((f, i) => `<i>/</i>${i === path.length - 1 ? `<b>${esc(f.name)}</b>` : `<button class="cr" data-gows="${wid}/${f.id}">${esc(f.name)}</button>`}`).join("");
    const av = (W.members.length > 2 ? [W.members[0]] : W.members).map(p => `<i style="background:${wsCol(p.user_id)}" title="${esc(p.name)}">${esc(wsIni(p.name))}</i>`).join("") + (W.members.length > 2 ? `<i class="more" title="${W.members.slice(1).map(p => esc(p.name)).join(", ")}">+${W.members.length - 1}</i>` : "") + `<i class="inv" title="Mitglieder & Einladen">${ic("plus")}</i>`;
    m.innerHTML = `<div class="ned dfull docsed" id="ws-root">${pageHead(crumbHtml, `${fid ? "" : `${sdkBtn("all", "Dashboard", `data-wt="dash" class="${wsTab === "dash" ? "on" : ""}"`)}${sdkBtn("note", "Dokumente", `data-wt="docs" class="${wsTab === "docs" ? "on" : ""}"`)}<i class="sdk-sep" aria-hidden="true"></i>`}<button type="button" class="ws-av" id="ws-mem" title="Mitglieder" aria-label="Mitglieder">${av}</button>${dkAct("more", "Mehr", 'id="ws-more"')}<i class="sdk-sep" aria-hidden="true"></i>${dkAct("plus", "Neu", 'id="ws-nw"')}`)}
      <article class="ned-paper docspaper" id="paperc"><div class="dmain" data-tab="${fid ? "docs" : wsTab}">
      ${fid ? "" : `<div id="ws-hub"></div>`}
      ${folders.length || items.length ? `${folders.length ? `<div class="dtop"><div class="dtl"><h3 class="dsec">Ordner<small>${folders.length}</small></h3><div class="items fgrid">${folders.map(f => { const n = W.items.filter(i => i.folder_id === f.id).length; return `<div class="fold" data-f="${f.id}" style="--c:${esc(f.color)}" tabindex="0"><div class="f3d">${folderSvg(f.color)}<span class="fico">${sji(sjiOf(f))}</span><div class="ftxt"><b>${esc(f.name)}</b><small>${n} ${n === 1 ? "Datei" : "Dateien"}</small></div></div><button class="dmore on" data-fm="${f.id}" aria-label="Mehr">${ic("more")}</button></div>`; }).join("")}</div></div></div>` : ""}
      ${items.length ? `<section class="dlist"><h3 class="dsec">Dokumente<small>${items.length}</small></h3><div class="dtab" role="table"><div class="dth" role="row"><span>Name</span><span>Typ</span><span>Erstellt von</span><span>Erstellt</span><span></span></div>${items.map(it => `<div class="dtr" role="row" data-i="${it.id}" tabindex="0"><span class="dn"><i class="dk k-note">${ic("note")}</i><b>${esc(it.title || "Unbenannt")}</b></span><span class="dt2"><em class="tag k-note">Notiz</em></span><span class="dsj"><i style="background:${wsCol(it.created_by)}"></i>${esc(nameOf(it.created_by))}</span><span class="dd">${fmtAgo(new Date(it.created_at).getTime())}</span><span class="da"><button class="dmore" data-im="${it.id}" aria-label="Mehr">${ic("more")}</button></span></div>`).join("")}</div></section>` : ""}`
      : `<div class="emptybox"><div class="big-ic">${ic("folder")}</div><h3>${path.length ? "Dieser Ordner ist leer" : "Noch nichts hier"}</h3><p>Lege Ordner und Dokumente an – alle Mitglieder sehen und bearbeiten sie gemeinsam.</p><div class="row" style="justify-content:center;gap:10px"><button class="btn primary" id="ws-d2">Neues Dokument</button><button class="btn ghost" id="ws-f2">Neuer Ordner</button></div></div>`}
      </div></article></div>`;
    setScroller($("#paperc", m));
    $$("[data-wt]", m).forEach(b => b.onclick = () => { wsTab = b.dataset.wt; try { LS.set("ws-tab", wsTab); } catch {} $(".dmain", m).dataset.tab = wsTab; $$("[data-wt]", m).forEach(x => x.classList.toggle("on", x === b)); });
    if (!fid) wsHub($("#ws-hub", m), wid, W, nameOf, () => dead);
    bind();
  };
  const refresh = async () => { if (dead) return; try { W = await load(); const s = JSON.stringify([W.name, W.members, W.folders, W.items]); if (s !== sig) { sig = s; if (!busy) draw(); } } catch (e) { if (/no access/.test(String(e.message))) { toast("Du bist nicht mehr in diesem Workspace"); go("workspace"); } } };
  const act = async (fn, okMsg) => { busy = true; try { await fn(); if (okMsg) toast(okMsg); W = await load(); sig = JSON.stringify([W.name, W.members, W.folders, W.items]); } catch (e) { toast(wsMsg(e)); } busy = false; draw(); };

  const newDoc = async () => {
    const t = await ask("Neues Dokument", { placeholder: "Titel", ok: "Erstellen" }); if (t == null) return; const title = t.trim() || "Unbenanntes Dokument";
    busy = true;
    try {
      const share = await wsRpc("lumi_share_create", { p_title: title, p_html: "", p_tb: [], p_ink: [] });
      await wsRpc("lumi_ws_item_add", { p_ws: wid, p_folder: fid || null, p_share: share, p_title: title });
      const nid = uid(); D.docs.unshift({ id: nid, type: "note", title, subjectId: "", folderId: "", paper: D.profile.paper || "white", share, shareOwner: true, shareRev: 0, updated: Date.now(), created: Date.now(), text: "" });
      await KV.set("html:" + nid, ""); await KV.set("tb:" + nid, []); save(); busy = false; go("doc/" + nid);
    } catch (e) { busy = false; toast(wsMsg(e)); }
  };
  const newFolder = async (parent = fid) => { const n = await ask("Neuer Ordner", { placeholder: "Name", ok: "Erstellen" }); if (!n || !n.trim()) return; act(() => wsRpc("lumi_ws_folder_save", { p_ws: wid, p_id: null, p_parent: parent || null, p_name: n.trim(), p_color: COLORS[W.folders.length % COLORS.length], p_icon: "" })); };
  const openItem = it => { const ex = D.docs.find(x => x.share === it.share_id); if (ex) go("doc/" + ex.id); else V.join(m, it.share_id); };

  const folderMenu = (btn, f) => menu(btn, [
    { label: "Umbenennen", icon: "pen", fn: async () => { const n = await ask("Ordner umbenennen", { value: f.name }); if (n?.trim()) act(() => wsRpc("lumi_ws_folder_save", { p_ws: wid, p_id: f.id, p_parent: null, p_name: n.trim(), p_color: null, p_icon: null })); } },
    { label: "Farbe & Icon", icon: "brush", fn: () => {
      const { el } = modal(`<h3>Farbe & Icon</h3><div class="chips" style="gap:12px">${COLORS.map(c => `<button class="cdot ${c === f.color ? "on" : ""}" data-c="${c}" style="background:${c};width:38px;height:38px"></button>`).join("")}</div><p class="note" style="margin:18px 0 8px">Icon</p><div class="sji-grid">${Object.keys(SJI).map(k => `<button type="button" class="sji-b ${k === sjiOf(f) ? "on" : ""}" data-i="${k}" aria-label="${k}">${sji(k)}</button>`).join("")}</div>`);
      $$("[data-c]", el).forEach(b => b.onclick = () => { f.color = b.dataset.c; $$("[data-c]", el).forEach(x => x.classList.toggle("on", x === b)); wsRpc("lumi_ws_folder_save", { p_ws: wid, p_id: f.id, p_parent: null, p_name: "", p_color: f.color, p_icon: null }).then(() => refresh()).catch(e => toast(wsMsg(e))); });
      $$(".sji-b", el).forEach(b => b.onclick = () => { f.icon = b.dataset.i; $$(".sji-b", el).forEach(x => x.classList.toggle("on", x === b)); wsRpc("lumi_ws_folder_save", { p_ws: wid, p_id: f.id, p_parent: null, p_name: "", p_color: null, p_icon: f.icon }).then(() => refresh()).catch(e => toast(wsMsg(e))); });
    } },
    { label: "Unterordner anlegen", icon: "folder", fn: () => newFolder(f.id) },
    "-",
    { label: "Löschen", icon: "trash", danger: true, fn: async () => { if (await confirmBox("Ordner „" + f.name + "“ mit allen Unterordnern löschen? Die Dokumente darin kommen in den Hauptordner des Workspace.")) act(() => wsRpc("lumi_ws_folder_delete", { p_ws: wid, p_id: f.id })); } },
  ]);
  const itemMenu = (btn, it) => menu(btn, [
    { label: "Öffnen", icon: "file", fn: () => openItem(it) },
    { label: "Umbenennen", icon: "pen", fn: async () => { const n = await ask("Dokument umbenennen", { value: it.title }); if (n?.trim()) { const d = D.docs.find(x => x.share === it.share_id); if (d) { d.title = n.trim(); d.updated = Date.now(); save(); } act(() => wsRpc("lumi_ws_item_update", { p_ws: wid, p_id: it.id, p_title: n.trim(), p_folder: null, p_move: false })); } } },
    { label: "Verschieben …", icon: "folder", fn: () => { const { el, close } = modal(`<h3>Verschieben nach</h3><div class="ws-pick"><button data-t="">Hauptordner</button>${W.folders.map(f => `<button data-t="${f.id}" style="padding-left:${14 + pathOf(f.id).length * 12 - 12}px">${esc(f.name)}</button>`).join("")}</div>`); $$("[data-t]", el).forEach(b => b.onclick = () => { close(); act(() => wsRpc("lumi_ws_item_update", { p_ws: wid, p_id: it.id, p_title: null, p_folder: b.dataset.t || null, p_move: true }), "Verschoben"); }); } },
    "-",
    { label: "Aus Workspace entfernen", icon: "trash", danger: true, fn: async () => { if (await confirmBox("„" + (it.title || "Dokument") + "“ aus dem Workspace entfernen? Mitglieder behalten ihre eigene Kopie.", "Entfernen")) act(() => wsRpc("lumi_ws_item_delete", { p_ws: wid, p_id: it.id })); } },
  ]);

  const inviteModal = () => {
    if (!isAdmin()) return toast("Einladungen können nur Admins verschicken.");
    const { el } = modal(`<h3>Mitglieder einladen</h3><div id="ws-ib"></div>`), box = $("#ws-ib", el);
    const paint = () => { const link = wsLink(W.code); box.innerHTML = `<p class="note">Wer den Link öffnet (angemeldet) oder den Code eingibt, tritt dem Workspace bei und kann alles bearbeiten.</p><div class="co-link"><input class="field" readonly value="${esc(link)}" id="ws-l"><button class="btn primary" id="ws-cp">Kopieren</button></div><p class="note" style="margin-top:12px">Code: <b style="letter-spacing:.06em">${esc(W.code)}</b></p>${navigator.share ? `<button class="btn ghost small" id="ws-sh">Teilen …</button>` : ""}<div class="row end" style="margin-top:14px"><button class="btn ghost" id="ws-nc">Neuen Code erzeugen</button></div><p class="note">Ein neuer Code macht den alten Link ungültig.</p>`;
      $("#ws-cp", box).onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link kopiert"); } catch { $("#ws-l", box).select(); } };
      $("#ws-sh", box)?.addEventListener("click", () => navigator.share({ title: W.name, url: link }).catch(() => {}));
      $("#ws-nc", box).onclick = async () => { try { W.code = await wsRpc("lumi_ws_new_code", { p_ws: wid }); paint(); toast("Neuer Code erzeugt"); } catch (e) { toast(wsMsg(e)); } };
    }; paint();
  };
  const membersModal = () => {
    const { el, close } = modal(`<h3>Mitglieder</h3><div id="ws-mb"></div>`), box = $("#ws-mb", el);
    const paint = () => {
      box.innerHTML = `<div class="ws-ppl">${W.members.map(p => `<div class="ws-p"><i style="background:${wsCol(p.user_id)}">${esc(wsIni(p.name))}</i><span><b>${esc(p.name || "Mitglied")}${p.user_id === W.me ? " (du)" : ""}</b></span>${isAdmin() && p.user_id !== W.me ? `<select data-r="${p.user_id}" class="field slim"><option value="member" ${p.role === "member" ? "selected" : ""}>Mitglied</option><option value="admin" ${p.role === "admin" ? "selected" : ""}>Admin</option></select><button class="dmore" data-rm="${p.user_id}" aria-label="Entfernen" title="Entfernen">${ic("x")}</button>` : `<em class="tag">${p.role === "admin" ? "Admin" : "Mitglied"}</em>`}</div>`).join("")}</div><div class="row end" style="margin-top:14px"><button class="btn ghost danger" id="ws-leave">Workspace verlassen</button></div>${isAdmin() ? `<button class="btn accent" id="ws-invite" style="width:100%;margin-top:10px">${ic("adduser")} Einladen</button>` : ""}`;
      $("#ws-invite", box)?.addEventListener("click", () => { close(); inviteModal(); });
      $$("[data-r]", box).forEach(s => s.onchange = async () => { try { await wsRpc("lumi_ws_set_role", { p_ws: wid, p_user: s.dataset.r, p_role: s.value }); W = await load(); paint(); } catch (e) { toast(wsMsg(e)); paint(); } });
      $$("[data-rm]", box).forEach(b => b.onclick = async () => { if (!await confirmBox("Mitglied entfernen?", "Entfernen")) return; try { await wsRpc("lumi_ws_remove_member", { p_ws: wid, p_user: b.dataset.rm }); W = await load(); paint(); } catch (e) { toast(wsMsg(e)); } });
      $("#ws-leave", box).onclick = async () => { if (!await confirmBox("Workspace verlassen?", "Verlassen")) return; try { await wsRpc("lumi_ws_remove_member", { p_ws: wid, p_user: W.me }); close(); go("workspace"); } catch (e) { toast(wsMsg(e)); } };
    }; paint();
  };
  const moreMenu = btn => menu(btn, [
    { label: "Mitglieder", icon: "team", fn: membersModal },
    isAdmin() && { label: "Workspace umbenennen", icon: "pen", fn: async () => { const n = await ask("Workspace umbenennen", { value: W.name }); if (n?.trim()) act(() => wsRpc("lumi_ws_rename", { p_ws: wid, p_name: n.trim() })); } },
    "-",
    isAdmin() && { label: "Workspace löschen", icon: "trash", danger: true, fn: async () => { if (await confirmBox("Workspace „" + W.name + "“ für alle löschen? Die Dokumente bleiben als Kopien bei den Mitgliedern.", "Löschen")) { try { await wsRpc("lumi_ws_delete", { p_ws: wid }); toast("Workspace gelöscht"); go("workspace"); } catch (e) { toast(wsMsg(e)); } } } },
  ].filter(Boolean));

  function bind() {
    $$("[data-gows]", m).forEach(b => b.onclick = () => go("workspace" + (b.dataset.gows ? "/" + b.dataset.gows : "")));
    $$("[data-f]", m).forEach(c => c.onclick = e => { if (e.target.closest("[data-fm]")) return; go("workspace/" + wid + "/" + c.dataset.f); });
    $$("[data-fm]", m).forEach(b => b.onclick = e => { e.stopPropagation(); folderMenu(b, folderOf(b.dataset.fm)); });
    $$("[data-i]", m).forEach(r => r.onclick = e => { if (e.target.closest("[data-im]")) return; openItem(W.items.find(x => x.id === r.dataset.i)); });
    $$("[data-im]", m).forEach(b => b.onclick = e => { e.stopPropagation(); itemMenu(b, W.items.find(x => x.id === b.dataset.im)); });
    $("#ws-nw", m).onclick = e => menu(e.currentTarget, [{ label: "Neues Dokument", icon: "newnote", fn: newDoc }, { label: "Neuer Ordner", icon: "folder", fn: () => newFolder() }]);
    $("#ws-mem", m).onclick = membersModal; $("#ws-more", m).onclick = e => moreMenu(e.currentTarget);
    $("#ws-d2", m)?.addEventListener("click", newDoc); $("#ws-f2", m)?.addEventListener("click", () => newFolder());
  }
  sig = JSON.stringify([W.name, W.members, W.folders, W.items]); draw();
  const t = setInterval(() => { if (dead || !m.isConnected) return clearInterval(t); if (!document.hidden) refresh(); }, wsPollMs(10000, 3000)); LEAVE.push(() => clearInterval(t));
}

/* ---------- Workspace-Hub: Team-Kalender, Termine, Aufgaben, Chat, Aktivität (supabase/workspace-hub.sql) ---------- */
let WSHUB_T = 0;
function wsHub(host, wid, W, nameOf, isDead) {
  clearInterval(WSHUB_T); let H = null, cy = new Date().getFullYear(), cm = new Date().getMonth(), selDay = "", chatKey = "";
  const KIND = { event: ["Termin", "cal"], meeting: ["Meeting", "team"], exam: ["Prüfung", "star"] }, PR = { high: ["Hoch", "hi"], medium: ["Mittel", "md"], low: ["Niedrig", "lo"] }, ST = { todo: "To-do", doing: "In Arbeit", done: "Erledigt" };
  const dayKey = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const fmtDT = d => new Date(d).toLocaleString("de-CH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const me = W.me, call = async (fn, args, ok) => { try { await wsRpc(fn, { p_ws: wid, ...args }); if (ok) toast(ok); await load(); } catch (e) { toast(wsMsg(e)); } };
  const load = async () => { if (isDead() || !host.isConnected) return clearInterval(WSHUB_T); try { H = await wsRpc("lumi_ws_hub", { p_ws: wid }); paint(); } catch (e) { const msg = String(e?.message || e || "Fehler"); host.innerHTML = /could not find|does not exist|schema cache/i.test(msg) ? `<p class="hub-off">Team-Kalender, Aufgaben und Chat werden aktiviert, sobald <code>supabase/workspace-hub.sql</code> im Supabase-Projekt ausgeführt wurde.</p>` : `<p class="hub-off">Das Dashboard konnte nicht geladen werden: ${esc(wsMsg(e))} <button class="link" id="hub-retry">Erneut versuchen</button></p>`; $("#hub-retry", host)?.addEventListener("click", load); } };
  const evModal = day => {
    const { el, close } = modal(`<h3>Neuer Termin</h3><div class="hub-f"><input class="field" id="e-t" placeholder="Titel, z. B. Mathe-Prüfung" maxlength="120"><div class="hub-r"><input class="field" type="date" id="e-d" value="${day || dayKey(new Date())}"><input class="field" type="time" id="e-h" value="09:00"></div><div class="hub-seg" id="e-k">${Object.entries(KIND).map(([k, [l]], i) => `<button type="button" data-k="${k}" class="${i ? "" : "on"}">${l}</button>`).join("")}</div><textarea class="field" id="e-n" rows="2" placeholder="Notiz (optional)"></textarea></div><div class="row end"><button class="btn primary" id="e-ok">Hinzufügen</button></div>`);
    let kind = "event"; $$("#e-k button", el).forEach(b => b.onclick = () => { kind = b.dataset.k; $$("#e-k button", el).forEach(x => x.classList.toggle("on", x === b)); });
    $("#e-ok", el).onclick = () => { const t = $("#e-t", el).value.trim(); if (!t) return $("#e-t", el).focus(); const at = new Date($("#e-d", el).value + "T" + ($("#e-h", el).value || "09:00")); if (isNaN(at)) return toast("Bitte Datum prüfen"); close(); call("lumi_ws_event_save", { p_id: null, p_title: t, p_kind: kind, p_at: at.toISOString(), p_note: $("#e-n", el).value }, "Termin hinzugefügt"); };
    setTimeout(() => $("#e-t", el).focus(), 30);
  };
  const taskModal = () => {
    const { el, close } = modal(`<h3>Neue Aufgabe</h3><div class="hub-f"><input class="field" id="t-t" placeholder="Was ist zu tun?" maxlength="160"><div class="hub-r"><select class="field" id="t-p"><option value="medium">Priorität: Mittel</option><option value="high">Priorität: Hoch</option><option value="low">Priorität: Niedrig</option></select><input class="field" type="date" id="t-d"></div><select class="field" id="t-a"><option value="">Niemand zugewiesen</option>${W.members.map(x => `<option value="${x.user_id}">${esc(x.name)}</option>`).join("")}</select></div><div class="row end"><button class="btn primary" id="t-ok">Hinzufügen</button></div>`);
    $("#t-ok", el).onclick = () => { const t = $("#t-t", el).value.trim(); if (!t) return $("#t-t", el).focus(); close(); call("lumi_ws_task_save", { p_id: null, p_title: t, p_prio: $("#t-p", el).value, p_status: "todo", p_assignee: $("#t-a", el).value || null, p_due: $("#t-d", el).value || null }); };
    setTimeout(() => $("#t-t", el).focus(), 30);
  };
  function paint() {
    const ev = H.events, tasks = H.tasks, msgs = H.msgs, now = Date.now(), today = dayKey(now);
    const byDay = {}; ev.forEach(e => (byDay[dayKey(e.starts_at)] = byDay[dayKey(e.starts_at)] || []).push(e));
    const first = (new Date(cy, cm, 1).getDay() + 6) % 7, dim = new Date(cy, cm + 1, 0).getDate();
    let cells = ["M", "D", "M", "D", "F", "S", "S"].map(w => `<span class="hc-w">${w}</span>`).join("") + Array(first).fill("<i></i>").join("");
    for (let n = 1; n <= dim; n++) { const k = `${cy}-${String(cm + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`, has = byDay[k]; cells += `<button class="hc-d ${k === today ? "today" : ""} ${k === selDay ? "sel" : ""}" data-day="${k}">${n}${has ? `<u class="${has.some(x => x.kind === "exam") ? "ex" : ""}"></u>` : ""}</button>`; }
    const upc = ev.filter(e => new Date(e.starts_at).getTime() >= now - 36e5).slice(0, 6), shown = selDay ? (byDay[selDay] || []) : upc;
    const act = Array.from({ length: 14 }, (_, i) => { const d = new Date(now - (13 - i) * 864e5), k = dayKey(d); return { k, n: tasks.filter(t => t.done_at && dayKey(t.done_at) === k).length + msgs.filter(x => dayKey(x.created_at) === k).length + W.items.filter(x => dayKey(x.created_at) === k).length + tasks.filter(t => dayKey(t.created_at) === k).length }; });
    const mx = Math.max(3, ...act.map(a => a.n)), week = act.slice(7).reduce((a, b) => a + b.n, 0), prev = act.slice(0, 7).reduce((a, b) => a + b.n, 0);
    const open = tasks.filter(t => t.status !== "done"), done = tasks.length - open.length;
    host.innerHTML = `<div class="hub">
      <section class="hc hc-cal"><header><b>${new Date(cy, cm, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })}</b><span><button data-cn="-1" aria-label="Zurück">${ic("back")}</button><button data-cn="1" class="nx" aria-label="Weiter">${ic("back")}</button></span></header><div class="hc-g">${cells}</div></section>
      <section class="hc hc-act"><header><b>Aktivität</b><small>letzte 14 Tage</small></header><div class="ha-n"><strong>${week}</strong><span>Aktionen diese Woche${prev ? ` · ${week >= prev ? "+" : ""}${week - prev} zur Vorwoche` : ""}</span></div><div class="ha-bars">${act.map(a => `<i style="height:${Math.max(4, Math.round(a.n / mx * 100))}%" title="${a.n} am ${a.k}"></i>`).join("")}</div></section>
      <section class="hc hc-up"><header><b>${selDay ? new Date(selDay + "T12:00").toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" }) : "Anstehende Termine"}</b><button class="hub-add" id="hub-ev">${ic("plus")}Termin</button></header>${shown.length ? shown.map(e => `<div class="hu-r k-${e.kind}"><span class="hu-i">${ic(KIND[e.kind][1])}</span><div><b>${esc(e.title)}</b><small>${fmtDT(e.starts_at)} · ${KIND[e.kind][0]}${e.note ? " · " + esc(e.note) : ""}</small></div>${e.created_by === me || W.role === "admin" ? `<button class="hu-x" data-ed="${e.id}" aria-label="Löschen">${ic("x")}</button>` : ""}</div>`).join("") : `<p class="hub-n">${selDay ? "Keine Termine an diesem Tag." : "Noch keine Termine – lege Prüfungen, Meetings oder Abgaben für das Team an."}</p>`}</section>
      <section class="hc hc-tk"><header><b>Aufgaben</b><small>${done}/${tasks.length} erledigt</small></header><button class="hub-addrow" id="hub-tk">${ic("plus")}Aufgabe hinzufügen</button>${open.length ? open.slice(0, 8).map(t => `<div class="ht-r"><button class="ht-c ${t.status === "doing" ? "doing" : ""}" data-tc="${t.id}" title="Status ändern" aria-label="Status ändern"></button><div><b>${esc(t.title)}</b><small>${ST[t.status]}${t.assignee ? " · " + esc(nameOf(t.assignee)) : ""}${t.due ? " · bis " + new Date(t.due + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" }) : ""}</small></div><span class="kprio ${PR[t.prio][1]}">${PR[t.prio][0]}</span><button class="hu-x" data-td="${t.id}" aria-label="Löschen">${ic("x")}</button></div>`).join("") + (open.length > 8 ? `<p class="hub-n">+${open.length - 8} weitere</p>` : "") : `<p class="hub-n">Alles erledigt.</p>`}</section>
      <section class="hc hc-ch"><header><b>Team-Chat</b><small>${W.members.length} Mitglieder</small></header><div class="hch-l" id="hch-l">${msgs.length ? msgs.map(x => `<div class="hch-m ${x.user_id === me ? "me" : ""}">${x.user_id === me ? "" : `<i style="background:${wsCol(x.user_id)}" title="${esc(nameOf(x.user_id))}">${esc(wsIni(nameOf(x.user_id)))}</i>`}<div class="hch-b">${x.user_id === me ? "" : `<small>${esc(nameOf(x.user_id))}</small>`}<p>${esc(x.body)}</p><em>${new Date(x.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</em></div></div>`).join("") : `<p class="hub-n">Noch keine Nachrichten. Schreib dem Team etwas.</p>`}</div><form class="hch-f" id="hch-f"><input id="hch-i" placeholder="Nachricht an das Team …" maxlength="1000" autocomplete="off"><button type="submit" aria-label="Senden">${ic("up")}</button></form></section></div>`;
    const l = $("#hch-l", host); if (l) l.scrollTop = l.scrollHeight;
    $$("[data-cn]", host).forEach(b => b.onclick = () => { cm += +b.dataset.cn; if (cm < 0) { cm = 11; cy--; } if (cm > 11) { cm = 0; cy++; } paint(); });
    $$("[data-day]", host).forEach(b => b.onclick = () => { selDay = selDay === b.dataset.day ? "" : b.dataset.day; paint(); });
    $("#hub-ev", host).onclick = () => evModal(selDay); $("#hub-tk", host).onclick = taskModal;
    $$("[data-ed]", host).forEach(b => b.onclick = () => call("lumi_ws_event_delete", { p_id: b.dataset.ed }));
    $$("[data-td]", host).forEach(b => b.onclick = () => call("lumi_ws_task_delete", { p_id: b.dataset.td }));
    $$("[data-tc]", host).forEach(b => b.onclick = () => { const t = tasks.find(x => x.id === b.dataset.tc); call("lumi_ws_task_save", { p_id: t.id, p_title: t.title, p_prio: t.prio, p_status: t.status === "todo" ? "doing" : "done", p_assignee: t.assignee, p_due: t.due }); });
    $("#hch-f", host).onsubmit = e => { e.preventDefault(); const i = $("#hch-i", host), v = i.value.trim(); if (!v) return; i.value = ""; call("lumi_ws_msg_send", { p_body: v }); };
  }
  load(); WSHUB_T = setInterval(() => { if (!document.hidden && (!document.activeElement || document.activeElement.id !== "hch-i")) load(); }, wsPollMs(12000, 4000)); LEAVE.push(() => clearInterval(WSHUB_T));
}

/* ---------- Überarbeitete Zeichen-Icons (Stift, Marker, Radierer): einheitlich, klar, abgerundet ---------- */
Object.assign(P, {
  pen: '<path d="M4.6 19.4l.9-4L16.5 4.4a2.3 2.3 0 0 1 3.2 3.2L8.7 18.6z"/><path d="M14.3 6.6l3.2 3.2M4.6 19.4l4-.9"/>',
  hl: '<path d="M15.2 4.3l4.5 4.5a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0L6.6 12.9a1.4 1.4 0 0 1 0-2l6.6-6.6a1.4 1.4 0 0 1 2 0z"/><path d="M6.8 12.8l-2.3 4.4 3.1.3 2-1.6M4 20.4h8.5"/>',
  eraser: '<path d="M13.2 5.6a2.2 2.2 0 0 1 3.1 0l2.9 2.9a2.2 2.2 0 0 1 0 3.1l-7.1 7.1a2.2 2.2 0 0 1-1.6.7H8.9a2.2 2.2 0 0 1-1.6-.7l-2.5-2.5a2.2 2.2 0 0 1 0-3.1z"/><path d="M9.1 9.7l5.2 5.2M10.4 19.4H19"/>',
});
P.brush = P.pen;
