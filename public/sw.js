/*
 * Offline shell for CODM Filter Lab.
 *
 * The whole tool is client-side: the codec, the preview grade and the analyser
 * all run in the page. That means an offline copy is genuinely useful — players
 * open this next to the game, often on a bad connection — as long as the shell
 * and the JS chunks are already cached.
 *
 * Strategy: navigations are network-first (so a deploy is picked up) with the
 * cached shell as the fallback; hashed build assets are cache-first with a
 * background refresh, since their URL changes when their content does.
 */
const VERSION = "codm-v1";
const SHELL = ["/", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // one missing file must not fail the whole install
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const put = async (request, response) => {
  if (!response || !response.ok) return;
  const cache = await caches.open(VERSION);
  await cache.put(request, response);
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(put(request, response.clone()));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("Offline. Open CODM Filter Lab once with a connection to install it.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          event.waitUntil(put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
