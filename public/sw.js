const CACHE_NAME = "teacher-hub-v2"; // 👈 tăng version để force update cache cũ

// Các trang/asset cốt lõi cần có sẵn để app mở được khi offline
const PRECACHE_URLS = [
  "/",
  "/admin/login",
  "/admin/statistics",
  "/admin/students",
  "/admin/attendance",
  "/admin/schedule",
  "/admin/announcements",
  "/admin/contact",
  "/admin/competition-groups",
  "/admin/criteria",
  "/admin/rewards",
  "/admin/honor",
  "/admin/privileges",
  "/admin/materials",
  "/admin/gallery",
  "/admin/games",
  "/admin/noise-meter",
  "/admin/stopwatch",
  "/admin/seatting-chart",
  "/admin/lucky-spin",
  "/admin/lucky-drawcard",
  "/admin/lucky-flipcard",
  "/admin/settings",
  "/offline.html",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Nếu là điều hướng trang (không phải ảnh/JS/CSS) -> trả về trang offline đẹp
        if (event.request.mode === "navigate") {
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
        }

        return new Response("Offline và chưa có dữ liệu cache cho request này.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});