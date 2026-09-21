const CACHE_NAME = "teacher-hub-v1";

self.addEventListener("install", () => {
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

// Network-first: luôn ưu tiên lấy dữ liệu mới nhất, chỉ dùng cache khi mất mạng
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Bỏ qua request từ extension trình duyệt (chrome-extension://, moz-extension://...)
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Chỉ cache response hợp lệ (bỏ qua opaque/error response)
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

        // Không có mạng và cũng không có cache -> trả về Response hợp lệ thay vì undefined
        return new Response("Offline và chưa có dữ liệu cache cho request này.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});