// ============================================================================
// SERVICE WORKER DE GRID — lot 4 de PLAN-GRID-V2.md (03/10/2026).
//
// Ecrit a la main, sans dependance : une soixantaine de lignes valent mieux
// qu'une bibliotheque dont on ne maitrise pas les mises a jour.
//
// CE QU'IL FAIT
//   - les fichiers de l'application (`/assets/*`, hashes par Vite donc
//     immuables) sont servis depuis le cache : l'application s'ouvre meme quand le
//     reseau rame ;
//   - la PAGE (`index.html`) passe d'abord par le reseau, le cache n'est qu'un
//     secours hors ligne. C'est ce qui garantit qu'un `wrangler rollback` atteint
//     les postes : la page servie est toujours celle en ligne, et elle designe
//     ses propres fichiers.
//
// CE QU'IL NE FAIT JAMAIS
//   - mettre en cache une reponse de Supabase. Aucune donnee, aucun jeton :
//     seulement des fichiers statiques de NOTRE origine ;
//   - recharger la page de force. Une nouvelle version s'annonce (message
//     `nouvelle-version`) et l'utilisateur choisit le moment — jamais au milieu
//     d'une saisie.
// ============================================================================

const CACHE = 'grid-coquille-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/grid.svg', '/manifest.webmanifest'])));
});

self.addEventListener('activate', (e) => {
  // Les caches des versions precedentes du service worker partent ; celui-ci
  // prend la main sur les onglets ouverts sans les recharger.
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Notre origine seulement, et en lecture : Supabase et tout le reste passent
  // directement, sans jamais toucher au cache.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // La page : le reseau d'abord, le cache en secours.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put('/', copie));
          return r;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Les fichiers hashes : le cache d'abord, ils ne changent jamais sous un nom donne.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (trouve) =>
          trouve ||
          fetch(e.request).then((r) => {
            if (r.ok) {
              const copie = r.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copie));
            }
            return r;
          })
      )
    );
  }
});
