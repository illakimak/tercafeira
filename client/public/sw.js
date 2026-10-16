/* Service worker do ITO online.
 *
 * O jogo depende do servidor em tempo real, então o app não funciona offline.
 * O service worker existe para o app abrir rápido e ser instalável:
 *  - páginas: rede primeiro; sem rede, usa a última cópia guardada
 *  - arquivos compilados (/assets) e ícones: cache primeiro, são imutáveis
 *  - fontes: guarda para abrir mais rápido nas próximas vezes
 *  - socket e qualquer outra coisa: passa direto, sem mexer
 *
 * Ao publicar uma versão nova, o navegador instala o novo sw.js sozinho,
 * porque o servidor entrega este arquivo sem cache.
 */
const VERSION = "v1";
const SHELL = `ito-shell-${VERSION}`;
const ASSETS = `ito-assets-${VERSION}`;
const FONTS = `ito-fonts-${VERSION}`;
const KEEP = [SHELL, ASSETS, FONTS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put("/", fresh.clone()); // o app é uma página só; ?sala=XXXX cai na mesma cópia
    return fresh;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // opaque (type 0) acontece com arquivos de outra origem sem CORS; ainda vale guardar
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === "opaque") cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/socket.io") || url.pathname === "/health") return;

    if (request.mode === "navigate") {
      event.respondWith(networkFirstPage(request));
    } else if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request, ASSETS));
    }
    return;
  }

  if (url.hostname === "fonts.googleapis.com") {
    event.respondWith(staleWhileRevalidate(request, FONTS));
  } else if (url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONTS));
  }
});
