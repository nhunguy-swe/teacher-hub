"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function StandaloneRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const checked = useRef(false);

  useEffect(() => {
    // Chỉ kiểm tra 1 lần duy nhất khi app khởi động, và chỉ khi đang ở trang chủ
    if (checked.current || pathname !== "/") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      checked.current = true;
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      checked.current = true;
      if (user) {
        router.replace("/admin/statistics");
      }
      unsubscribe();
    });
  }, [pathname, router]);

  return null;
}