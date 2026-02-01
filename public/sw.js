/**
 * Minimal service worker for PWA installability.
 * Pass-through fetch; no caching. Required by some browsers (e.g. Chrome on Android)
 * to show "Add to Home Screen" when manifest is present.
 */
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
