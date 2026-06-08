const CACHE_NAME = 'orderflow-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Nouvelle commande reçue',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'new-order',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: '👀 Voir' },
      { action: 'close', title: '✕ Fermer' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🛍️ Nouvelle commande !', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
