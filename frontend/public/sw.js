// Guarda el armazón de la app para que la tablet abra aunque se caiga el internet. La API nunca se guarda.
const CACHE = "ecoconecta-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request).then((guardada) => guardada ?? caches.match("/"))),
  );
});
