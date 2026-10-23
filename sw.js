// Offline cache: app shell + card data precached; card images cached on first use (then background-filled).
const V = 'ripzone-v11.3'; // v9.26: v0.9.19 transparent VP9-alpha pack spins. v9.4: 1 card per pack, 12 price points, brand pack art + Logo C, full-quality card photos. v9: cash mode (USD balance, market values, buyback, ship requests). prev: v8 vault multi-select sell · v7: real card photos for the BETA categories (img/op|nfl|mlb|mtg/*.webp)
const SHELL = ['./', 'index.html', 'img/fx/sleeve.webp', 'img/fx/gloss.webp', 'splash/c/splash_c.js', 'splash/c/logo.webp', 'splash/c/icon.webp', 'css/app.css', 'css/wide.css', 'js/app.js', 'js/sky.js', 'js/inspect.js', 'js/pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon-180.png', 'js/compliance-config.js', 'js/compliance.js', 'js/backend.js', 'firebase-config.js', 'data/cards.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'img/brand/logo-icon.webp', 'img/brand/logo-wordmark.webp',
  ...['pkm'].flatMap(c => ['starter', 'rare', 'premium', 'legendary'].map(t => `img/packs/${c}-${t}.webp`))];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
  // background-fill every card image (Pokémon only since v0.11.1) so packs work offline.
  // Runs in the SW thread, 12 at a time with a short pause between batches, so it never competes with the page's animations.
  try { const c = await caches.open(V);
    const files = ['data/cards.json'];
    const imgs = (await Promise.all(files.map(f => fetch(f).then(r => r.json()).catch(() => ({ cards: [] }))))).flatMap(d => d.cards.map(x => x.img).filter(Boolean));
    for (let i = 0; i < imgs.length; i += 12) {
      await Promise.all(imgs.slice(i, i + 12).map(async u => { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } }));
      await new Promise(r => setTimeout(r, 40));
    } } catch {}
})()); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const isImg = /\/img\//.test(e.request.url);
  const put = r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; };
  // images: cache-first; shell/data: network-first so updates land, cache when offline
  e.respondWith(isImg ? caches.match(e.request).then(hit => hit || fetch(e.request).then(put))
    : fetch(e.request).then(put).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// v0.11.1 Web Push (test mode). Payload JSON: { title, body, url }
self.addEventListener('push', e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'RipZone', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' } })); });
self.addEventListener('notificationclick', e => { e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) if ('focus' in c) return c.focus(); return self.clients.openWindow(url); })); });
