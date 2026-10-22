import { Capacitor } from "@capacitor/core";

// Web (Vercel): gọi cùng domain. App Android (Capacitor): gọi URL tuyệt đối tới Vercel.
export const API_BASE = Capacitor.isNativePlatform()
  ? "https://lophoccuacotruc.vercel.app"
  : "";