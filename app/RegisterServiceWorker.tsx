"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Đăng ký Service Worker chính của ứng dụng
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service worker registration successful:", registration.scope);
        })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}