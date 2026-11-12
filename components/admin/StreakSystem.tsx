"use client";

/**
 * Hệ thống streak kiểu Duolingo cho teacher-hub.
 *
 * - Mỗi admin có streak riêng: Firestore `adminStreaks/{uid}`.
 * - Nickname hiển thị ở lời chào: Firestore `adminProfiles/{uid}` (field `nickname`),
 *   được đặt trong trang Cài đặt.
 * - Mở web lần đầu trong ngày => ghi nhận ngày đó (mở nhiều lần chỉ tính 1).
 * - Chuỗi chỉ tính từ T2 đến T6:
 *     + Vào web: +1, hiện dấu ✓.
 *     + Bỏ lỡ 1 ngày: tự dùng 1 băng, hiện bông tuyết ❄️.
 *     + Hết băng: mất chuỗi, bắt đầu lại từ 1.
 * - T7, CN không làm đứt chuỗi và không cộng thêm vào chuỗi:
 *     + Vào web: hiện dấu ✓ (không cộng vào chuỗi).
 *     + Không vào: hiện cỏ 4 lá 🍀 (thay cho băng).
 * - "Băng bảo vệ" (Streak Freeze): cứ mỗi 7 ngày liên tiếp được tặng 1 băng
 *   (tối đa 3).
 * - Popup chúc mừng + pháo giấy khi tăng chuỗi (ngày làm việc), mốc lớn có
 *   lời chúc riêng. Cuối tuần không hiện popup.
 *
 * Xuất ra:
 *   <StreakCard />        -> thẻ chi tiết: ngọn lửa + 7 ngày trong tuần + băng bảo vệ
 *   <StreakModal />       -> popup xem streak khi bấm vào chip
 *   <StreakChip />        -> chip nhỏ cho banner (bấm để mở popup)
 *   <StreakCelebration /> -> popup chúc mừng
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/* ================= CẤU HÌNH ================= */

// Tên mặc định (dự phòng) khi admin chưa đặt nickname trong Cài đặt.
// Có thể để trống: nickname đặt trong Cài đặt luôn được ưu tiên.
export const ADMIN_NAMES: Record<string, string> = {
  UID_ADMIN_1: "Cô Trúc",
  UID_ADMIN_2: "Admin 2",
};

const MAX_FREEZES = 3; // số băng tối đa được giữ
const FREEZE_EVERY = 7; // cứ mỗi 7 ngày liên tiếp tặng 1 băng
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

/* ================= KIỂU DỮ LIỆU ================= */

export interface StreakData {
  current: number;
  best: number;
  lastDate: string; // YYYY-MM-DD
  freezes: number;
  days: string[]; // các ngày đã vào (giữ 60 ngày gần nhất)
  frozenDays: string[]; // các ngày được băng bảo vệ
  streakStart?: string; // ngày bắt đầu chuỗi hiện tại; ngày trước đó không còn tính cam
}

export interface Celebration {
  count: number;
  usedFreezes: number;
  lostFreezes: number; // số băng đã dùng hết khi mất chuỗi
  earnedFreeze: boolean;
  restarted: boolean; // mất chuỗi cũ, bắt đầu lại
  previous: number;
}

const EMPTY: StreakData = {
  current: 0,
  best: 0,
  lastDate: "",
  freezes: 0,
  days: [],
  frozenDays: [],
  streakStart: "",
};

// Ngày bắt đầu chuỗi hiện tại. Nếu dữ liệu cũ chưa có streakStart thì suy ra
// bằng cách đi lùi từ lastDate, đếm đủ `current` ngày làm việc đã vào.
function getStreakStart(s: StreakData): string {
  if (s.streakStart) return s.streakStart;
  if (!s.lastDate || s.current <= 0) return "";
  const visited = new Set(s.days);
  let k = s.lastDate;
  let count = visited.has(k) && !isWeekend(k) ? 1 : 0;
  for (let i = 0; count < s.current && i < 400; i++) {
    k = addDays(k, -1);
    if (!isWeekend(k) && visited.has(k)) count++;
  }
  return k;
}

// Ngày có thuộc chuỗi hiện tại không
const inStreak = (s: StreakData, k: string) => {
  const start = getStreakStart(s);
  return !start || k >= start;
};

/* ================= TIỆN ÍCH NGÀY ================= */

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => new Date(`${k}T00:00:00`);
const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
const isWeekend = (k: string) => {
  const w = fromKey(k).getDay();
  return w === 0 || w === 6;
};

/** Tính streak mới khi admin vào web ở ngày todayKey. */
function computeVisit(prev: StreakData | null, todayKey: string) {
  const base = prev ?? EMPTY;

  // Cuối tuần: chỉ ghi nhận đã vào (hiện ngọn lửa), không đổi chuỗi, không popup
  if (isWeekend(todayKey)) {
    const next: StreakData = {
      ...base,
      days: [...base.days, todayKey].slice(-60),
    };
    return { next, celebration: null };
  }

  let current: number;
  let freezes = base.freezes;
  let usedFreezes = 0;
  let lostFreezes = 0;
  let restarted = false;
  let streakStart = base.streakStart || "";
  let frozenDays = [...base.frozenDays];

  if (!base.lastDate) {
    current = 1;
    streakStart = todayKey;
  } else {
    const missed: string[] = [];
    let d = addDays(base.lastDate, 1);
    for (let i = 0; d < todayKey && i < 400; i++) {
      if (!isWeekend(d)) missed.push(d);
      d = addDays(d, 1);
    }

    if (missed.length === 0) {
      current = base.current + 1;
    } else if (freezes >= missed.length) {
      freezes -= missed.length;
      usedFreezes = missed.length;
      frozenDays.push(...missed);
      current = base.current + 1;
    } else {
      // Mất chuỗi: dùng hết băng, reset về 1, ngày cũ mất màu cam
      current = 1;
      restarted = base.current > 1;
      lostFreezes = base.freezes;
      freezes = 0;
      frozenDays = [];
      streakStart = todayKey;
    }
  }

  let earnedFreeze = false;
  if (current > 0 && current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) {
    freezes += 1;
    earnedFreeze = true;
  }

  const next: StreakData = {
    current,
    best: Math.max(base.best, current),
    lastDate: todayKey,
    freezes,
    days: [...base.days, todayKey].slice(-60),
    frozenDays: frozenDays.slice(-30),
    streakStart,
  };

  const celebration: Celebration = {
    count: current,
    usedFreezes,
    lostFreezes,
    earnedFreeze,
    restarted,
    previous: base.current,
  };
  return { next, celebration };
}

/* ================= HOOK ================= */

export function useAdminStreak() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | undefined>();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const checkedFor = useRef<string | null>(null);

  useEffect(
    () => onAuthStateChanged(auth, (u) => setAdminId(u?.uid ?? null)),
    [],
  );

  // Lắng nghe nickname do admin tự đặt trong Cài đặt (đổi là cập nhật ngay)
  useEffect(() => {
    if (!adminId) return;
    const unsub = onSnapshot(
      doc(db, "adminProfiles", adminId),
      (snap) => {
        const n = snap.exists()
          ? (snap.data().nickname as string | undefined)
          : undefined;
        setNickname(n?.trim() || undefined);
      },
      (err) => console.error("Lỗi đọc nickname:", err),
    );
    return unsub;
  }, [adminId]);

  useEffect(() => {
    if (!adminId) return;
    const ref = doc(db, "adminStreaks", adminId);

    const unsub = onSnapshot(ref, (snap) =>
      setStreak(
        snap.exists() ? { ...EMPTY, ...(snap.data() as StreakData) } : EMPTY,
      ),
    );

    if (checkedFor.current !== adminId) {
      checkedFor.current = adminId;
      (async () => {
        try {
          const todayKey = toKey(new Date());
          const snap = await getDoc(ref);
          const data = snap.exists() ? (snap.data() as StreakData) : null;
          if (data?.lastDate === todayKey || data?.days?.includes(todayKey))
            return; // hôm nay đã tính

          const { next, celebration: c } = computeVisit(data, todayKey);
          await setDoc(ref, next);
          if (c) setCelebration(c);
        } catch (e) {
          console.error("Lỗi cập nhật streak:", e);
          checkedFor.current = null;
        }
      })();
    }
    return unsub;
  }, [adminId]);

  return {
    adminId,
    // Ưu tiên: nickname (Cài đặt) -> ADMIN_NAMES -> undefined (hiện "bạn")
    adminName: adminId ? (nickname ?? ADMIN_NAMES[adminId]) : undefined,
    streak,
    celebration,
    dismissCelebration: () => setCelebration(null),
  };
}

/* ================= HÌNH ẢNH ================= */

function Flame({ size = 64, lit = true }: { size?: number; lit?: boolean }) {
  const id = `fl-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 64 77"
      aria-hidden="true"
      className={lit ? "streak-flame" : ""}
      style={
        lit
          ? { filter: "drop-shadow(0 4px 10px rgba(255,106,0,0.45))" }
          : undefined
      }
    >
      <defs>
        <linearGradient id={`${id}-o`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={lit ? "#FF9A1F" : "#CBD5E1"} />
          <stop offset="0.55" stopColor={lit ? "#FF5A1F" : "#A8B3C2"} />
          <stop offset="1" stopColor={lit ? "#E8261A" : "#8A97A8"} />
        </linearGradient>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? "#FFD23F" : "#E2E8F0"} />
          <stop offset="1" stopColor={lit ? "#FF8A00" : "#B6C0CD"} />
        </linearGradient>
        <linearGradient id={`${id}-i`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? "#FFFBE0" : "#F1F5F9"} />
          <stop offset="1" stopColor={lit ? "#FFD84D" : "#DDE3EA"} />
        </linearGradient>
      </defs>

      {/* Lớp ngoài: đỏ cam */}
      <path
        d="M33 1c1 11 6 16 12 24 7 9 11 17 9 29-2 13-11 22-22 22S10 67 9 54c-1-9 3-15 8-21 2-3 4-6 5-11 3 3 5 6 6 10 3-5 5-12 4-20 0-4-1-7 1-11z"
        fill={`url(#${id}-o)`}
      />
      {/* Lớp giữa: cam vàng */}
      <path
        d="M32 24c1 7 7 11 11 18 4 7 3 15-2 20-3 3-7 5-11 5-8 0-14-6-14-14 0-5 3-9 6-13 2-3 4-6 4-12 3 3 4 5 6 6 1-3 1-7 0-10z"
        fill={`url(#${id}-m)`}
      />
      {/* Lõi: vàng trắng */}
      <path
        d="M32 44c1 4 5 6 6 11 1 5-2 10-6 10s-8-4-7-9c1-3 3-4 4-7 1 2 2 3 3 3z"
        fill={`url(#${id}-i)`}
      />
      {/* Điểm sáng */}
      {lit && (
        <ellipse
          cx="20"
          cy="46"
          rx="2.2"
          ry="5"
          fill="#fff"
          opacity="0.35"
          transform="rotate(12 20 46)"
        />
      )}
      {/* Đốm lửa bay lên */}
      {lit && (
        <>
          <circle
            className="streak-spark s1"
            cx="14"
            cy="22"
            r="1.8"
            fill="#FFB020"
          />
          <circle
            className="streak-spark s2"
            cx="52"
            cy="30"
            r="1.5"
            fill="#FF8A00"
          />
          <circle
            className="streak-spark s3"
            cx="46"
            cy="12"
            r="1.2"
            fill="#FFD23F"
          />
        </>
      )}
    </svg>
  );
}

function SnowflakeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 12 12)`}>
          <path d="M12 12V2.5" />
          <path d="M12 6l-2.4-2" />
          <path d="M12 6l2.4-2" />
        </g>
      ))}
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloverIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {[0, 90, 180, 270].map((deg) => (
        <path
          key={deg}
          transform={`rotate(${deg} 12 12)`}
          d="M12 12C12 8 9.2 5 7.2 6.4 5.2 7.9 7.2 11 12 12z"
          fill="#22C55E"
          stroke="#16A34A"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      ))}
      <path
        d="M12 12q1 5 4 8"
        fill="none"
        stroke="#15803D"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Huy hiệu băng bảo vệ: tinh thể xanh phát sáng + số lượng */
function FreezeBadge({
  count,
  max,
  title,
}: {
  count: number;
  max: number;
  title?: string;
}) {
  const has = count > 0;
  return (
    <div
      className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-xs font-extrabold ${
        has
          ? "bg-linear-to-r from-sky-50 to-cyan-50 border-sky-200 text-sky-700"
          : "bg-slate-50 border-slate-200 text-slate-400"
      }`}
      title={title}
    >
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${
          has
            ? "bg-linear-to-br from-cyan-300 via-sky-400 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,0.7)] streak-ice"
            : "bg-slate-300"
        }`}
      >
        <SnowflakeIcon className="w-4 h-4" />
      </span>
      {count}/{max}
    </div>
  );
}

const WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function weekKeys(todayKey: string) {
  const d = fromKey(todayKey);
  const offset = (d.getDay() + 6) % 7; // Thứ 2 = 0
  const monday = addDays(todayKey, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function WeekRow({ streak }: { streak: StreakData }) {
  const todayKey = toKey(new Date());
  const days = new Set(streak.days);
  const frozen = new Set(streak.frozenDays);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekKeys(todayKey).map((k, i) => {
        const done = days.has(k) && inStreak(streak, k);
        const ice = frozen.has(k) && inStreak(streak, k);
        const weekend = isWeekend(k);
        const isToday = k === todayKey;
        const past = k < todayKey;

        let cls = "bg-slate-50 border-slate-200 text-slate-300";
        let content: ReactNode = "";

        if (weekend) {
          if (done) {
            cls = "bg-orange-500 border-orange-500 text-white shadow-sm";
            content = "✓";
          } else if (past) {
            cls = "bg-emerald-50 border-emerald-200";
            content = <CloverIcon />;
          } else if (isToday) {
            cls = "bg-white border-orange-400 border-dashed";
          }
        } else {
          if (done) {
            cls = "bg-orange-500 border-orange-500 text-white shadow-sm";
            content = "✓";
          } else if (ice) {
            cls =
              "bg-linear-to-br from-cyan-100 to-sky-200 border-sky-300 text-sky-600 shadow-[0_0_8px_rgba(56,189,248,0.5)]";
            content = <SnowflakeIcon className="w-4 h-4" />;
          } else if (isToday) {
            cls = "bg-white border-orange-400 border-dashed text-orange-500";
          } else if (past) {
            cls = "bg-slate-100 border-slate-200 text-slate-300";
          }
        }

        return (
          <div key={k} className="flex flex-col items-center gap-1.5">
            <span
              className={`text-[10px] font-bold ${
                isToday ? "text-orange-600" : "text-slate-400"
              }`}
            >
              {WEEK_LABELS[i]}
            </span>
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold border-2 transition-all ${cls}`}
              title={k}
            >
              {content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ================= THẺ STREAK ================= */

export function StreakCard({
  streak,
  className = "",
}: {
  streak: StreakData | null;
  className?: string;
}) {
  if (!streak) return null;

  const next = MILESTONES.find((m) => m > streak.current);
  const prevM = [...MILESTONES].reverse().find((m) => m <= streak.current) ?? 0;
  const pct = next
    ? Math.min(100, ((streak.current - prevM) / (next - prevM)) * 100)
    : 100;

  return (
    <div
      className={`bg-white p-6 rounded-3xl shadow-xs border border-amber-200 space-y-5 ${className}`}
    >
      <StreakStyles />

      <div className="flex items-center gap-4">
        <Flame size={56} lit={streak.current > 0} />
        <div className="min-w-0">
          <p className="m-0 text-4xl font-extrabold text-orange-500 leading-none">
            {streak.current}
          </p>
          <p className="m-0 mt-1 text-sm font-bold text-slate-700">
            ngày liên tiếp
          </p>
          <p className="m-0 mt-0.5 text-[11px] font-semibold text-slate-400">
            Kỷ lục: {streak.best} ngày
          </p>
        </div>

        <div className="ml-auto">
          <FreezeBadge
            count={streak.freezes}
            max={MAX_FREEZES}
            title="Băng bảo vệ: tự dùng khi bạn bỏ lỡ một ngày làm việc"
          />
        </div>
      </div>

      <WeekRow streak={streak} />

      {next && (
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
            <span>Mốc tiếp theo: {next} ngày</span>
            <span>còn {next - streak.current} ngày</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-orange-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= LỊCH THÁNG KIỂU DUOLINGO ================= */

const MONTH_WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function StreakMonthCalendar({ streak }: { streak: StreakData }) {
  const todayKey = toKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  const done = useMemo(() => new Set(streak.days), [streak.days]);
  const frozen = useMemo(() => new Set(streak.frozenDays), [streak.frozenDays]);

  // Dựng các tuần (T2 -> CN), ô ngoài tháng = null
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(toKey(new Date(year, month, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  // Chỉ ngày đã vào và thuộc chuỗi hiện tại mới nằm trong dải cam
  const lit = (k: string | null) => !!k && done.has(k) && inStreak(streak, k);

  return (
    <div className="space-y-3">
      {/* Tiêu đề tháng + chuyển tháng */}
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-sm font-extrabold text-slate-800">
          Tháng {month + 1} • {year}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs cursor-pointer"
            aria-label="Tháng trước"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            disabled={isCurrentMonth}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs cursor-pointer disabled:opacity-30 disabled:cursor-default"
            aria-label="Tháng sau"
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-slate-200 p-3 space-y-1.5">
        {/* Nhãn thứ */}
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 pb-1">
          {MONTH_WEEK_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>

        {weeks.map((row, ri) => {
          // Tìm các đoạn ngày liên tiếp được thắp sáng để vẽ dải nối liền
          const segments: { start: number; end: number }[] = [];
          let s = -1;
          row.forEach((k, i) => {
            if (lit(k)) {
              if (s === -1) s = i;
            } else if (s !== -1) {
              segments.push({ start: s, end: i - 1 });
              s = -1;
            }
          });
          if (s !== -1) segments.push({ start: s, end: 6 });

          return (
            <div key={ri} className="relative grid grid-cols-7 h-9">
              {/* Dải màu cam nối liền các ngày */}
              {segments.map((seg, si) => (
                <div
                  key={si}
                  className="absolute top-0.5 bottom-0.5 rounded-full bg-linear-to-b from-amber-400 to-orange-500 ring-2 ring-amber-200"
                  style={{
                    left: `calc(${(seg.start / 7) * 100}% + 2px)`,
                    width: `calc(${((seg.end - seg.start + 1) / 7) * 100}% - 4px)`,
                  }}
                />
              ))}

              {/* Ô băng bảo vệ: xanh băng, không nối vào dải cam */}
              {row.map((k, ci) =>
                k && frozen.has(k) && !done.has(k) && inStreak(streak, k) ? (
                  <div
                    key={`ice-${ci}`}
                    className="absolute top-0.5 bottom-0.5 rounded-full bg-linear-to-b from-sky-300 to-sky-500 ring-2 ring-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                    style={{
                      left: `calc(${(ci / 7) * 100}% + 2px)`,
                      width: `calc(${100 / 7}% - 4px)`,
                    }}
                  />
                ) : null,
              )}

              {/* Số ngày */}
              {row.map((k, ci) => {
                if (!k) return <span key={ci} className="relative z-10" />;
                const dayNum = Number(k.slice(8));
                const isDone = done.has(k) && inStreak(streak, k);
                const isIce = frozen.has(k) && !isDone && inStreak(streak, k);
                const isToday = k === todayKey;
                const future = k > todayKey;
                const weekend = isWeekend(k);
                const missedPast =
                  !isDone && !isIce && !future && !isToday && weekend;

                return (
                  <span
                    key={ci}
                    title={k}
                    className={`relative z-10 flex items-center justify-center text-xs font-extrabold ${
                      isDone
                        ? "text-white"
                        : isIce
                          ? "text-sky-700"
                          : isToday
                            ? "text-orange-600"
                            : future
                              ? "text-slate-300"
                              : "text-slate-400"
                    }`}
                  >
                    {isIce ? (
                      <span style={{ color: "#fff" }}>
                        <SnowflakeIcon className="w-4 h-4" />
                      </span>
                    ) : missedPast ? (
                      <CloverIcon className="w-4 h-4" />
                    ) : isToday && !isDone ? (
                      <span className="w-7 h-7 rounded-full border-2 border-dashed border-orange-400 flex items-center justify-center">
                        {dayNum}
                      </span>
                    ) : (
                      dayNum
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= POPUP XEM STREAK ================= */

export function StreakModal({
  open,
  streak,
  onClose,
}: {
  open: boolean;
  streak: StreakData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !streak) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 dark:bg-black/30 backdrop-blur-xs dark:backdrop-blur-none p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <StreakStyles />
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-xl border-2 border-amber-400 p-6 space-y-5 streak-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 shadow-xs hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        >
          ✕
        </button>

        {/* Hàng thống kê: streak + băng bảo vệ */}
        <div className="grid grid-cols-2 gap-2.5 pt-6">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 py-3">
            <Flame size={28} lit={streak.current > 0} />
            <div className="min-w-0 leading-tight">
              <p className="m-0 text-xl font-extrabold text-orange-500">
                {streak.current}
              </p>
              <p className="m-0 text-[11px] font-semibold text-slate-400 truncate">
                Ngày liên tiếp
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 py-3"
            title="Băng bảo vệ: tự dùng khi bạn bỏ lỡ một ngày làm việc. Cứ 7 ngày liên tiếp nhận 1 băng."
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-linear-to-br from-cyan-300 via-sky-400 to-blue-500 shrink-0">
              <SnowflakeIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="m-0 text-xl font-extrabold text-sky-500">
                {streak.freezes}/{MAX_FREEZES}
              </p>
              <p className="m-0 text-[11px] font-semibold text-slate-400 truncate">
                Băng bảo vệ
              </p>
            </div>
          </div>
        </div>

        {/* Lịch tháng */}
        <StreakMonthCalendar streak={streak} />
      </div>
    </div>
  );
}

/* ================= CHIP CHO BANNER ================= */

export function StreakChip({
  streak,
  onClick,
}: {
  streak: StreakData | null;
  onClick?: () => void;
}) {
  if (!streak || streak.current <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-orange-700 shadow-2xs hover:bg-orange-100 hover:border-orange-300 transition-colors cursor-pointer"
      title={`Kỷ lục: ${streak.best} ngày • Bấm để xem chi tiết`}
    >
      <Flame size={14} />
      {streak.current} ngày liên tiếp
      <span className="inline-flex items-center gap-0.5 ml-1 pl-2 border-l border-orange-200 text-sky-600">
        <SnowflakeIcon className="w-3.5 h-3.5" />
        {streak.freezes}/{MAX_FREEZES}
      </span>
    </button>
  );
}

/* ================= POPUP CHÚC MỪNG ================= */

function messageFor(c: Celebration) {
  if (c.restarted)
    return {
      title: "Bắt đầu chuỗi mới!",
      sub: `Chuỗi ${c.previous} ngày đã dừng lại. Không sao, mình bắt đầu lại nhé.`,
    };
  if (MILESTONES.includes(c.count))
    return {
      title: `Mốc ${c.count} ngày!`,
      sub: "Bạn giữ nhịp rất đều. Tiếp tục phát huy nhé!",
    };
  if (c.count === 1)
    return {
      title: "Ngày đầu tiên!",
      sub: "Quay lại mỗi ngày để giữ ngọn lửa cháy.",
    };
  return {
    title: `${c.count} ngày liên tiếp!`,
    sub: "Một ngày nữa được thắp sáng.",
  };
}

const CONFETTI_COLORS = [
  "#F59E0B",
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#8B5CF6",
];

export function StreakCelebration({
  celebration,
  streak,
  onClose,
}: {
  celebration: Celebration | null;
  streak: StreakData | null;
  onClose: () => void;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 100) / 100,
        dur: 2.2 + ((i * 17) % 15) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: (i * 47) % 360,
      })),
    [],
  );

  if (!celebration || !streak) return null;
  const { title, sub } = messageFor(celebration);
  const big = !celebration.restarted && MILESTONES.includes(celebration.count);

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 dark:bg-black/30 backdrop-blur-xs dark:backdrop-blur-none p-4"
      role="dialog"
      aria-modal="true"
    >
      <StreakStyles />

      {!celebration.restarted &&
        pieces.map((p, i) => (
          <span
            key={i}
            className="streak-confetti"
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}

      <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-sm p-7 text-center space-y-5 streak-pop">
        <div className="flex flex-col items-center">
          <div className={big ? "scale-125 mb-4" : "mb-2"}>
            <Flame size={88} />
          </div>
          <p className="m-0 text-6xl font-extrabold text-orange-500 leading-none streak-count">
            {celebration.count}
          </p>
          <p className="m-0 mt-1 text-sm font-bold text-slate-500">
            ngày liên tiếp
          </p>
        </div>

        <div>
          <h3 className="m-0 text-lg font-extrabold text-slate-800">{title}</h3>
          <p className="m-0 mt-1 text-xs text-slate-500 leading-relaxed">
            {sub}
          </p>
        </div>

        <WeekRow streak={streak} />

        {celebration.usedFreezes > 0 && (
          <div className="flex items-center justify-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl px-3 py-2 text-xs font-bold">
            <SnowflakeIcon />
            Băng bảo vệ đã cứu chuỗi của bạn ({celebration.usedFreezes} ngày)
          </div>
        )}
        {celebration.restarted && (
          <div className="flex items-center justify-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl px-3 py-2 text-xs font-bold">
            <SnowflakeIcon />
            {celebration.lostFreezes > 0
              ? `Đã dùng hết ${celebration.lostFreezes} băng bảo vệ nhưng không giữ được chuỗi`
              : "Bạn không còn băng bảo vệ để giữ chuỗi"}
          </div>
        )}
        {celebration.earnedFreeze && (
          <div className="flex items-center justify-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl px-3 py-2 text-xs font-bold">
            <SnowflakeIcon />
            Bạn nhận được 1 băng bảo vệ!
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-extrabold shadow-[0_4px_0_0_#c2410c] active:translate-y-0.5 active:shadow-[0_2px_0_0_#c2410c] transition-all cursor-pointer outline-none focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
        >
          {celebration.restarted ? "OK" : "Tiếp tục"}
        </button>
      </div>
    </div>
  );
}

/* ================= CSS ANIMATION ================= */

function StreakStyles() {
  return (
    <style>{`
      @keyframes streakFlicker {
        0%, 100% { transform: scale(1) rotate(-1deg); }
        50% { transform: scale(1.06) rotate(1.5deg); }
      }
      @keyframes streakPop {
        0% { transform: scale(0.8); opacity: 0; }
        70% { transform: scale(1.04); opacity: 1; }
        100% { transform: scale(1); }
      }
      @keyframes streakCount {
        0% { transform: scale(0.4); opacity: 0; }
        60% { transform: scale(1.25); opacity: 1; }
        100% { transform: scale(1); }
      }
      @keyframes streakFall {
        0% { top: -5%; opacity: 1; }
        100% { top: 105%; opacity: 0.9; }
      }
      .streak-flame { transform-origin: 50% 90%; animation: streakFlicker 1.6s ease-in-out infinite; }
      .streak-pop { animation: streakPop 0.45s ease-out both; }
      .streak-count { animation: streakCount 0.7s 0.15s ease-out both; }
      .streak-confetti {
        position: fixed; top: -5%; width: 8px; height: 14px; border-radius: 2px;
        animation-name: streakFall; animation-timing-function: linear; animation-fill-mode: forwards;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .streak-flame, .streak-pop, .streak-count, .streak-confetti, .streak-spark, .streak-ice { animation: none; }
        .streak-confetti { display: none; }
      }
      @keyframes streakSpark {
        0%   { transform: translateY(6px) scale(0.6); opacity: 0; }
        30%  { opacity: 1; }
        100% { transform: translateY(-14px) scale(0.2); opacity: 0; }
      }
      @keyframes streakIce {
        0%, 100% { box-shadow: 0 0 8px rgba(56,189,248,0.55); }
        50%      { box-shadow: 0 0 16px rgba(56,189,248,0.95); }
      }
      .streak-spark { animation: streakSpark 2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
      .streak-spark.s2 { animation-delay: 0.7s; }
      .streak-spark.s3 { animation-delay: 1.3s; }
      .streak-ice { animation: streakIce 2.4s ease-in-out infinite; }
    `}</style>
  );
}
