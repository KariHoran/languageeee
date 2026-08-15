/* Languageeee PWA service worker — offline-first shell + static assets */
/* eslint-disable no-restricted-globals */

const CACHE_VERSION = 'languageeee-v5';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[sw] precache skip', url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Сообщения от registerPwa (SKIP_WAITING). */
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isFirebaseOrApi(url) {
  const host = url.hostname;
  return (
    host.includes('firestore.googleapis.com') ||
    host.includes('firebaseio.com') ||
    host.includes('identitytoolkit.googleapis.com') ||
    host.includes('securetoken.googleapis.com') ||
    url.pathname.startsWith('/api/')
  );
}

function isFontCdn(url) {
  return (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|woff2?|ttf|otf|eot|png|webp|svg|ico|json)$/i.test(url.pathname)
  );
}

/**
 * Navigation: network-first → cache (offline resume).
 * Expo bundles + fonts: cache-first.
 * Same-origin rest: stale-while-revalidate.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts — кэшируем для офлайн UI (Comfortaa / Nunito)
  if (isFontCdn(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Firebase / API — только online, без SW-кэша
  if (isFirebaseOrApi(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/'));
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><meta name="theme-color" content="#0D0D11"/><title>Languageeee · Офлайн</title></head><body style="margin:0;background:#0D0D11;color:#fff;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:2rem;text-align:center"><div><h1 style="font-size:1.25rem;margin:0 0 .5rem">Вы в оффлайн-режиме</h1><p style="opacity:.65;margin:0;font-size:.9rem">Доступны сохранённые тексты после первого онлайн-визита.</p></div></body></html>',
      {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        cache.put(request, fresh.clone());
      }
      return fresh;
    })
    .catch(() => null);

  return cached || (await networkPromise) || Response.error();
}
