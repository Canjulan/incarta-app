// Service worker di Incarta — rende l'app installabile e utilizzabile offline.
// Strategia: "network first, cache fallback" per la pagina principale (così chi
// è online vede sempre l'ultima versione pubblicata), "cache first" per tutto
// il resto (librerie, icone) perché cambiano raramente e serve che siano
// disponibili anche senza connessione.

const CACHE_NAME = 'incarta-cache-v1';

const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-favicon-32.png',
  './icon-android-192.png',
  './icon-playstore-512.png',
  './icon-appstore-1024.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fallirebbe tutto se anche un solo asset non si carica (es. sei
      // offline al primo avvio): li mettiamo in cache uno per uno, ignorando
      // i singoli fallimenti, così l'installazione non si blocca del tutto.
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch(() => { /* verrà ricachato al prossimo utilizzo online */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate';

  if(isNavigation){
    // Pagina principale: prova la rete per avere sempre l'ultima versione;
    // se non c'è connessione, servi quella salvata in cache.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Tutto il resto (librerie, icone): cache first, poi rete come riserva.
  event.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
