// ============================================
// STOCK OPNAME PWA - SERVICE WORKER v2
// ============================================

const CACHE_VERSION = 'v2.5.0';
const STATIC_CACHE = `stock-opname-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `stock-opname-dynamic-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index-vanilla.html',
  '/app-vanilla.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// API endpoints (Google Apps Script) - use network first
const API_URL = 'script.google.com';

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.log('[SW] Cache add error:', err);
        });
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(keys => {
        console.log('[SW] Old caches:', keys);
        return Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle Google Apps Script API - Network First
  if (url.hostname.includes(API_URL)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Keep app shell fresh so login/storage fixes are not stuck on old JS.
  if (url.origin === self.location.origin &&
      (request.mode === 'navigate' ||
       url.pathname.endsWith('.html') ||
       url.pathname.endsWith('.js') ||
       url.pathname.endsWith('.json'))) {
    event.respondWith(appNetworkFirst(request));
    return;
  }

  // Handle other local assets - Cache First
  event.respondWith(cacheFirst(request));
});

async function appNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return createOfflineResponse();
  }
}

// Cache First Strategy - for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache first error:', error);
    return createOfflineResponse();
  }
}

// Network First Strategy - for API calls
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network first - serving from cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return createErrorResponse();
  }
}

// Create offline response
function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Offline - Data tidak tersedia. Silakan cek koneksi internet.'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Create error response for API
function createErrorResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Gagal mengambil data. Silakan coba lagi.'
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Handle messages from main app
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'checkForUpdates') {
    checkForUpdates();
  }
});

// Check for service worker updates
function checkForUpdates() {
  self.addEventListener('install', () => {
    // New service worker waiting
    if (self.registration.waiting) {
      notifyClients({
        type: 'UPDATE_AVAILABLE',
        message: 'Update tersedia! Tutup dan buka aplikasi untuk memperbarui.'
      });
    }
  });
}

// Notify all clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // This will be implemented when we add offline data queue
  console.log('[SW] Syncing offline data...');
}

// Push notifications (for future use)
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Ada notifikasi baru',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Stock Opname', options)
  );
});

console.log('[SW] Service Worker loaded - Version', CACHE_VERSION);
