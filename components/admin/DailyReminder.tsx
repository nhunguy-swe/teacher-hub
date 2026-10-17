"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LAST_SHOWN_KEY, readReminderSettings } from "@/lib/reminderSettings";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// Hỗ trợ "YYYY-MM-DD" (ô chọn ngày) và "DD/MM/YYYY" (nhập từ Excel)
function parseDayMonth(s?: string): { d: number; m: number } | null {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { d: +m[3], m: +m[2] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return { d: +m[1], m: +m[2] };
  return null;
}

export default function DailyReminder() {
  const [lines, setLines] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings = readReminderSettings();
        if (!settings.enabled) return;
        if (localStorage.getItem(LAST_SHOWN_KEY) === todayKey()) return;

        const result: string[] = [];

        if (settings.birthday) {
          const snap = await getDocs(collection(db, "students"));
          const now = new Date();
          const names = snap.docs
            .map(
              (d) =>
                d.data() as {
                  name?: string;
                  dob?: string;
                  statusText?: string;
                },
            )
            .filter((s) => {
              if (s.statusText && s.statusText !== "Đang học") return false;
              const b = parseDayMonth(s.dob);
              return !!b && b.d === now.getDate() && b.m === now.getMonth() + 1;
            })
            .map((s) => s.name)
            .filter(Boolean) as string[];

          if (names.length) {
            result.push(`🎂 Hôm nay là sinh nhật của: ${names.join(", ")}`);
          }
        }

        // Sau này thêm các loại nhắc nhở khác vào đây (result.push(...))

        if (cancelled || result.length === 0) return; // không có gì để nhắc thì không hiện

        setLines(result);
        setOpen(true);
        localStorage.setItem(LAST_SHOWN_KEY, todayKey());
      } catch (err) {
        console.error("Lỗi nhắc nhở:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed top-4 right-4 z-70 w-[calc(100%-2rem)] max-w-sm bg-white border border-amber-200 rounded-3xl shadow-xl shadow-amber-950/10 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-xs text-slate-700 font-medium">
          <p className="m-0 text-[11px] font-extrabold text-amber-600 uppercase tracking-wide">
            Nhắc nhở hôm nay
          </p>
          {lines.map((l, i) => (
            <p key={i} className="m-0 text-sm font-bold text-slate-800">
              {l}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng"
          className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
