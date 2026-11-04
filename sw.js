/* Studix service worker: network-first with offline fallback */
const C = "lumi-v45";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return; const u = new URL(r.url);
  if (u.origin !== location.origin && !/cdnjs\.cloudflare\.com/.test(u.host)) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(x => x || caches.match("index.html")).then(x => x || new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }))));
});
