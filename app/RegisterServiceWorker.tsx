"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Đăng ký Service Worker chính của ứng dụng
      navigator.serviceWorker
        .register("/sw.js");
    }
  }, []);

  return null;
}