"use client";

import { useSyncExternalStore } from "react";

function subscribeClock(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

const getClockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getClockServerSnapshot = () => 0;

export default function LiveClock() {
  const timestamp = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );

  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-700 shadow-2xs tabular-nums">
      <svg
        className="w-4 h-4 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      </svg>
      {timestamp
        ? new Date(timestamp).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : "--:--:--"}
    </span>
  );
}