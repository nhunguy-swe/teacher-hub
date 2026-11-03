"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// Cắt vuông ở giữa, thu nhỏ còn size x size, trả về data URL (khoảng 15-30KB)
export function resizeToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error("canvas"));
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}

// Lắng nghe ảnh đại diện trong Firestore, đổi ở Cài đặt là header đổi theo
export function useAdminAvatar(uid?: string | null): string | null {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "adminProfiles", uid),
      (snap) => setAvatar((snap.data()?.avatar as string | undefined) ?? null),
      (err) => console.error(err),
    );
  }, [uid]);

  return uid ? avatar : null;
}