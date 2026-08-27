// Gantz Web PWA Service Worker - Offline Cache-First Strategy
const CACHE_NAME = 'gantz-cache-v1.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './remote.html',
  './manifest.json',
  './css/display.css',
  './css/remote.css',
  './js/logger.js',
  './js/audio.js',
  './js/display-p2p.js',
  './js/remote-p2p.js',
  './js/vendor/peerjs.min.js',
  './js/vendor/qrcode.min.js',
  './js/vendor/html5-qrcode.min.js',
  './data/aliens.js',
  './data/weapons.js',
  './assets/webp/monsters/alien_cebolla_joven_recortado.webp',
  './assets/webp/monsters/alien_cebolla_adulto_recortado.webp',
  './assets/webp/monsters/alien_tanaka_recortado.webp',
  './assets/webp/monsters/alien_pajaros_recortado.webp',
  './assets/webp/monsters/alien_kannon_mil_brazos_recortado.webp',
  './assets/webp/monsters/alien_dinosaurio_recortado.webp',
  './assets/webp/monsters/alien_anillo_recortado.webp',
  './assets/webp/monsters/alien_chibi_recortado.webp',
  './assets/webp/monsters/alien_nurarihyon_recortado.webp',
  './assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp',
  './assets/webp/weapons/arma_y_alienigena.webp',
  './assets/webp/weapons/traje_gantz_biomecanico.webp',
  './assets/webp/weapons/radar_holografico.webp',
  './assets/webp/weapons/rifle_x_francotirador.webp',
  './assets/webp/weapons/espada_gantz_katana.webp',
  './assets/webp/weapons/mono_rueda_gantz_bike.webp',
  './assets/webp/weapons/zgun_canon_gravitatorio.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets could not be cached on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol.startsWith('ws') || url.pathname.includes('/peerjs')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./index.html') || caches.match('./remote.html');
        }
      });
    })
  );
});
