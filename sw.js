/* Service worker Absensi Tamu Acara.
   Tugasnya satu: menyimpan file aplikasi di perangkat supaya bisa dibuka tanpa internet.
   Data tamu tidak lewat sini. Data tetap di penyimpanan browser (localStorage). */
'use strict';
var VERSI = '1.4';
var CACHE = 'absensi-tamu-pwa-' + VERSI;
var BASE = new URL('./', self.registration.scope).href;
var INDEX = BASE + 'index.html';
var INTI = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* cache:'reload' memaksa ambil salinan terbaru dari server, bukan dari cache HTTP browser */
      return Promise.all(INTI.map(function (f) {
        return fetch(new Request(BASE + f, { cache: 'reload' })).then(function (r) {
          if (!r.ok) throw new Error(f + ' ' + r.status);
          return c.put(BASE + f, r);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('absensi-tamu-pwa-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Cache dulu supaya cepat dan tetap jalan tanpa sinyal. Di latar belakang, bila ada sinyal,
   salinan baru disimpan untuk pembukaan berikutnya. */
function segarkan(c, url) {
  return fetch(new Request(url, { cache: 'no-cache' })).then(function (r) {
    if (r && r.ok && !r.redirected && r.type === 'basic') return c.put(url, r.clone());
  }).catch(function () {});
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (u.href.indexOf(BASE) !== 0) return;
  var nav = req.mode === 'navigate';
  var kunci = nav ? INDEX : u.origin + u.pathname;
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(kunci).then(function (hit) {
        if (hit) { e.waitUntil(segarkan(c, kunci)); return hit; }
        return fetch(req).then(function (r) {
          if (r && r.ok && r.type === 'basic' && !r.redirected && !nav) c.put(kunci, r.clone());
          return r;
        }).catch(function () {
          return nav ? c.match(INDEX) : new Response('', { status: 504, statusText: 'Offline' });
        }).then(function (r) {
          return r || new Response('Aplikasi belum tersimpan untuk offline. Buka sekali dengan internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      });
    })
  );
});
