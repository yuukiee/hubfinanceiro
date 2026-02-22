/* ============================================================
   SERVICE WORKER — Controle de Gastos
   Estratégia: Cache-first para assets estáticos,
               Network-first para Firebase (dados em tempo real)
   ============================================================ */

const CACHE_NAME = "controle-gastos-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/auth.js",
  "/firebase-config.js",
  "/manifest.json",
  "/icons/icon.svg"
];

// ── Instalação: pré-cache dos assets estáticos ──────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear cada asset individualmente (ignora erros)
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => console.warn("[SW] Não cacheado:", url))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Ativação: limpa caches antigos ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia mista ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Firebase, Google APIs → sempre network (dados ao vivo)
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("identitytoolkit") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("fonts")
  ) {
    return; // deixa o browser gerenciar normalmente
  }

  // Assets estáticos locais → cache-first, fallback network
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            // Cacheia somente respostas válidas de mesma origem
            if (
              response.ok &&
              url.origin === self.location.origin
            ) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, clone)
              );
            }
            return response;
          })
          .catch(() => {
            // Offline fallback para páginas HTML
            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("/index.html");
            }
          });
      })
    );
  }
});
