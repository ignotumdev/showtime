const CACHE_NAME = "showtime-app-shell-v1";
const APP_SHELL = new URL("./", self.location.href).href;
const PRECACHE = [
  APP_SHELL,
  new URL("./manifest.webmanifest", self.location.href).href,
  new URL("./icon.svg", self.location.href).href,
  new URL("./icons/icon-192.png", self.location.href).href,
  new URL("./icons/icon-512.png", self.location.href).href,
  new URL("./icons/icon-maskable.svg", self.location.href).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

const cacheResponse = async (request, response) => {
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL)) || Response.error()),
    );
    return;
  }

  if (!["script", "style", "font", "image", "manifest"].includes(request.destination)) return;
  event.respondWith(
    caches
      .match(request)
      .then(
        (cached) => cached || fetch(request).then((response) => cacheResponse(request, response)),
      ),
  );
});
