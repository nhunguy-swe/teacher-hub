"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  buildWeeklyDeltaMap,
  getMonday,
  getSunday,
  WEEKLY_BASE_POINTS,
} from "@/lib/weeklyScore";

interface StudentItem {
  id: string;
  name: string;
  group: string;
  stars: number;
  status?: "present" | "excused" | "absent" | "late";
  avatarUrl?: string;
  weeklyScore?: number;
  weeklyDelta?: number;
}
interface ContactItem {
  id: string;
  status?: string;
}
interface AnnouncementItem {
  id: string;
  title: string;
}
interface ActivityItem {
  id: string;
  name: string;
  label: string;
  delta: number;
}
interface TaskItem {
  id: string;
  title: string;
  sub: string;
  completed: boolean;
  dateKey?: string; // Định dạng "YYYY-MM-DD"
  isDefault?: boolean;
  order?: number;
  createdAt?: unknown;
}

const GROUPS = ["Tổ 1", "Tổ 2", "Tổ 3"];
const GROUP_COLORS = ["#3B82F6", "#10B981", "#F59E0B"];

const GROUP_BADGE_STYLES: {
  [key: string]: { badgeBg: string; badgeText: string; badgeBorder: string };
} = {
  "Tổ 1": {
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-100",
  },
  "Tổ 2": {
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-100",
  },
  "Tổ 3": {
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-100",
  },
};

const GROUP_BADGE_SVG_STYLES = [
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }, // Tổ 1 - blue nhạt
  { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" }, // Tổ 2 - emerald nhạt
  { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" }, // Tổ 3 - amber nhạt
];

const DEFAULT_DAILY_TASKS: { title: string; sub: string }[] = [
  { title: "Điểm danh đầu giờ", sub: "Kiểm tra sĩ số đầu buổi học" },
  { title: "Kiểm tra vệ sinh lớp học", sub: "Bàn ghế, bảng, sàn lớp gọn gàng" },
  { title: "Ghi sổ đầu bài", sub: "Cập nhật nội dung tiết học trong ngày" },
  {
    title: "Nhắc học sinh mang đồ dùng học tập",
    sub: "Sách vở, dụng cụ học tập đầy đủ",
  },
  {
    title: "Cập nhật điểm thi đua cuối ngày",
    sub: "Tổng kết sao thưởng/phạt trong ngày",
  },
];

function lastInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.charAt(0).toUpperCase() || "?";
}

// Hàm format ngày thành YYYY-MM-DD an toàn theo giờ địa phương
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ---------- Biểu đồ tròn (SVG thuần) ---------- */
function Doughnut({
  segments,
  size = 148,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const thickness = 20;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {total === 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-slate-200"
            strokeWidth={1}
          />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((seg, i) => {
              const frac = seg.value / total;
              const len = frac * circumference;
              const dasharray = `${len} ${circumference - len}`;
              const dashoffset = -offset;
              offset += len;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
            })
        )}
        {/* <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          fontWeight={800}
          fontSize={22}
          fill="#22303A"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fontSize={10}
          fill="#8A8F98"
        >
          học sinh
        </text> */}
        <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          fontWeight={800}
          fontSize={22}
          className="fill-slate-800"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fontSize={10}
          className="fill-slate-500"
        >
          học sinh
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-3">
        {segments.map((s, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700"
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: s.color }}
            />
            {s.label} {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Biểu đồ cột (SVG thuần) ---------- */
function BarChart({
  labels,
  values,
  colors,
  width = 280,
  height = 190,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const pad = { top: 24, right: 8, bottom: 24, left: 8 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const n = values.length;
  const gap = 14;
  const barW = (chartW - gap * (n - 1)) / n;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <line
        x1={pad.left}
        y1={pad.top + chartH}
        x2={width - pad.right}
        y2={pad.top + chartH}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {values.map((v, i) => {
        const h = (v / max) * chartH;
        const x = pad.left + i * (barW + gap);
        const y = pad.top + (chartH - h);
        const badgeStyle =
          GROUP_BADGE_SVG_STYLES[i % GROUP_BADGE_SVG_STYLES.length];
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={7}
              fill={colors[i % colors.length]}
            />
            {/* <text
              x={x + barW / 2}
              y={y - 7}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={800}
              fill="#22303A"
            >
              {v}
            </text> */}
            <text
              x={x + barW / 2}
              y={y - 7}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={800}
              className="fill-slate-800"
            >
              {v}
            </text>
            {/* 👇 Badge nhạt: nền pha loãng + viền + chữ màu, thay cho nền đặc/chữ trắng cũ */}
            <rect
              x={x + barW / 2 - 24}
              y={height - 20}
              width={48}
              height={16}
              rx={8}
              fill={badgeStyle.bg}
              stroke={badgeStyle.border}
              strokeWidth={1}
            />
            <text
              x={x + barW / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={badgeStyle.text}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Bục xếp hạng Top 3 (kiểu podium, hạng nhất ở giữa có vương miện) ---------- */
function PodiumAvatar({
  student,
  rank,
}: {
  student: StudentItem;
  rank: number;
}) {
  const isFirst = rank === 1;
  const avatarSize = isFirst ? "w-20 h-20 text-xl" : "w-16 h-16 text-base";
  const ring = isFirst
    ? "ring-4 ring-amber-300"
    : rank === 2
      ? "ring-4 ring-slate-200"
      : "ring-4 ring-orange-200";
  const badgeColor = rank === 2 ? "bg-slate-400" : "bg-orange-700";

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className="h-7 flex items-end justify-center">
        {isFirst && <span className="text-2xl">👑</span>}
      </div>
      <div className="relative">
        <div
          className={`${avatarSize} ${ring} rounded-full flex items-center justify-center font-extrabold text-white shadow-md overflow-hidden`}
          style={
            student.avatarUrl
              ? undefined
              : { background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }
          }
        >
          {student.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.avatarUrl}
              alt={student.name}
              className="w-full h-full object-cover"
            />
          ) : (
            lastInitial(student.name)
          )}
        </div>
        {!isFirst && (
          <span
            className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow ${badgeColor}`}
          >
            {rank}
          </span>
        )}
      </div>
      <p
        className="text-[11px] font-bold text-slate-800 text-center truncate max-w-full px-1"
        title={student.name}
      >
        {student.name}
      </p>
      <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-amber-200 ">
        {student.weeklyScore ?? WEEKLY_BASE_POINTS} đ tuần
      </span>
      <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
        ⭐ {student.stars || 0} tích lũy
      </span>
    </div>
  );
}

export default function AdminStatistics({
  onNavigate,
}: {
  onNavigate?: (sectionId: string, parentGroupId?: string) => void;
}) {
  const toast = useToast();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [latestAnnouncement, setLatestAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // State quản lý Lịch tương tác
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [showAllActivityModal, setShowAllActivityModal] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskSubInput, setTaskSubInput] = useState("");

  // State cho popup xác nhận xóa 1 công việc
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<TaskItem | null>(
    null,
  );
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // State cho popup xác nhận xóa toàn bộ lịch sử hoạt động
  const [confirmClearActivity, setConfirmClearActivity] = useState(false);
  const [clearingActivity, setClearingActivity] = useState(false);

  // Kho lưu trữ toàn bộ các tính năng có trong hệ thống (dùng để chọn hiển thị trong popup)
  const allAvailableFeatures = [
    {
      id: "timetable",
      title: "Thời khóa biểu",
      desc: "Lịch học tuần",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      bg: "bg-sky-100",
      text: "text-sky-700",
      hoverBg: "hover:bg-sky-50/60",
      hoverBorder: "hover:border-sky-300",
      section: "section-timetable",
      group: "section-general-group",
    },
    {
      id: "seating",
      title: "Sơ đồ lớp",
      desc: "Vị trí chỗ ngồi",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="3" width="8" height="6" rx="1" />
          <rect x="14" y="3" width="8" height="6" rx="1" />
          <rect x="2" y="15" width="8" height="6" rx="1" />
          <rect x="14" y="15" width="8" height="6" rx="1" />
        </svg>
      ),
      bg: "bg-blue-100",
      text: "text-blue-700",
      hoverBg: "hover:bg-blue-50/60",
      hoverBorder: "hover:border-blue-300",
      section: "section-seating",
      group: "section-management-group",
    },
    {
      id: "groups",
      title: "Thi đua tổ",
      desc: "Xếp hạng tổ",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0012 0V2z" />
        </svg>
      ),
      bg: "bg-violet-100",
      text: "text-violet-700",
      hoverBg: "hover:bg-violet-50/60",
      hoverBorder: "hover:border-violet-300",
      section: "section-groups",
      group: "section-management-group",
    },
    {
      id: "rewards",
      title: "Trạm quà đổi điểm",
      desc: "Đổi điểm nhận quà",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
        </svg>
      ),
      bg: "bg-fuchsia-100",
      text: "text-fuchsia-700",
      hoverBg: "hover:bg-fuchsia-50/60",
      hoverBorder: "hover:border-fuchsia-300",
      section: "section-rewards",
      group: "section-management-group",
    },
    {
      id: "privileges",
      title: "Thẻ đặc quyền",
      desc: "Đặc quyền học sinh",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      ),
      bg: "bg-amber-100",
      text: "text-amber-700",
      hoverBg: "hover:bg-amber-50/60",
      hoverBorder: "hover:border-amber-300",
      section: "section-privileges",
      group: "section-management-group",
    },
    {
      id: "noise",
      title: "Đo tiếng ồn",
      desc: "Kiểm soát âm lượng",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      ),
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      hoverBg: "hover:bg-emerald-50/60",
      hoverBorder: "hover:border-emerald-300",
      section: "section-noise",
      group: "section-tools-group",
    },
    {
      id: "stopwatch",
      title: "Đồng hồ bấm giờ",
      desc: "Đếm ngược, đếm giờ",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3L2 6" />
          <path d="M19 3l3 3" />
          <path d="M12 2v2" />
        </svg>
      ),
      bg: "bg-orange-100",
      text: "text-orange-700",
      hoverBg: "hover:bg-orange-50/60",
      hoverBorder: "hover:border-orange-300",
      section: "section-stopwatch",
      group: "section-tools-group",
    },
    {
      id: "random",
      title: "Gọi tên may mắn",
      desc: "Quay số ngẫu nhiên",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-ferris-wheel"
        >
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2v4" />
          <path d="m6.8 15-3.5 2" />
          <path d="m20.7 7-3.5 2" />
          <path d="M6.8 9 3.3 7" />
          <path d="m20.7 17-3.5-2" />
          <path d="m9 22 3-8 3 8" />
          <path d="M8 22h8" />
          <path d="M18 18.7a9 9 0 1 0-12 0" />
        </svg>
      ),
      bg: "bg-rose-100",
      text: "text-rose-700",
      hoverBg: "hover:bg-rose-50/60",
      hoverBorder: "hover:border-rose-300",
      section: "section-random",
      group: "section-tools-group",
    },
  ];

  // Danh sách các ID của các tính năng đang được chọn ghim ra ngoài màn hình chính
  // Mới (đầy đủ tất cả các tính năng)
  const [activeShortcutIds, setActiveShortcutIds] = useState<string[]>(
    typeof window !== "undefined" && localStorage.getItem("my_shortcuts")
      ? JSON.parse(localStorage.getItem("my_shortcuts")!)
      : [
          "timetable",
          "seating",
          "groups",
          "rewards",
          "privileges",
          "noise",
          "stopwatch",
          "random",
        ],
  );

  const router = useRouter();

  const SECTION_PATHS: Record<string, string> = {
    "section-messages": "/admin/contact",
    "section-announcements": "/admin/announcements",
    "section-schedule": "/admin/schedule",
    "section-timetable": "/admin/schedule",
    "section-students": "/admin/students",
    "section-seating": "/admin/seating-chart",
    "section-groups": "/admin/competition-groups",
    "section-competition": "/admin/competition-groups",
    "section-criteria": "/admin/criteria",
    "section-rewards": "/admin/rewards",
    "section-honor": "/admin/honor",
    "section-privileges": "/admin/privileges",
    "section-attendance": "/admin/attendance",
    "section-noise": "/admin/noise-meter",
    "section-stopwatch": "/admin/stopwatch",
    "section-random": "/admin/lucky-spin",
    "section-spin": "/admin/lucky-spin",
    "section-drawcard": "/admin/lucky-drawcard",
    "section-flipcard": "/admin/lucky-flipcard",
    "section-games": "/admin/games",
    "section-materials": "/admin/materials",
    "section-gallery": "/admin/gallery",
    "section-settings": "/admin/settings",
  };

  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

  // Hàm bật/tắt chọn tính năng ra ngoài màn hình chính
  const toggleFeatureSelection = (id: string) => {
    if (activeShortcutIds.includes(id)) {
      // Không cho bỏ chọn hết nếu muốn tối thiểu giữ lại (hoặc cho phép bỏ tuỳ ý)
      if (activeShortcutIds.length <= 1) {
        toast.warning("Cần giữ ít nhất 1 lối tắt ngoài màn hình chính!");
        return;
      }
      setActiveShortcutIds(activeShortcutIds.filter((item) => item !== id));
    } else {
      setActiveShortcutIds([...activeShortcutIds, id]);
    }
  };

  // Lấy danh sách object các tính năng đang hiển thị ngoài màn hình chính dựa vào activeShortcutIds
  const currentShortcuts = activeShortcutIds
    .map((id) => allAvailableFeatures.find((f) => f.id === id))
    .filter(Boolean) as typeof allAvailableFeatures;

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(
        snapshot.docs.map((d) => ({
          id: d.id,
          stars: 0,
          status: "present",
          ...d.data(),
        })) as StudentItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ContactItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const first = snapshot.docs[0];
      setLatestAnnouncement(
        first ? ({ id: first.id, ...first.data() } as AnnouncementItem) : null,
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
      // Đã xóa limit(6) ở đây để lấy toàn bộ lịch sử
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivity(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ActivityItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  const [tasksLoaded, setTasksLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "dailyTasks"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(
        snapshot.docs.map((d) => ({
          id: d.id,
          dateKey: formatDateKey(new Date()),
          ...d.data(),
        })) as TaskItem[],
      );
      setTasksLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const total = students.length;
  const countStatus = (s: string) =>
    students.filter((x) => x.status === s).length;
  const unresolvedCount = contacts.filter(
    (c) => c.status !== "resolved",
  ).length;

  // Điểm tuần (Thứ 2 -> CN): mỗi học sinh 100đ + cộng/trừ trong tuần
  const weekMonday = useMemo(() => getMonday(new Date()), []);
  const weekSunday = useMemo(() => getSunday(weekMonday), [weekMonday]);
  const weeklyDeltaMap = useMemo(
    () =>
      buildWeeklyDeltaMap(
        activity as unknown as {
          name: string;
          delta: number;
          createdAt?: { toDate: () => Date } | null;
        }[],
        weekMonday,
        weekSunday,
      ),
    [activity, weekMonday, weekSunday],
  );

  // Điểm thi đua TUẦN NÀY theo tổ = tổng điểm tuần của thành viên + điểm
  // thưởng/phạt tổ trong tuần (không dùng số cộng dồn cũ nữa)
  const groupStars = useMemo(
    () =>
      GROUPS.map((g) => {
        const membersWeekly = students
          .filter((s) => s.group === g)
          .reduce(
            (a, s) => a + WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0),
            0,
          );
        const teamBonusWeekly = weeklyDeltaMap[g] || 0;
        return membersWeekly + teamBonusWeekly;
      }),
    [students, weeklyDeltaMap],
  );

  // Danh sách học sinh đã xếp hạng theo ĐIỂM TUẦN, dùng chung cho bục Top 3
  // và danh sách còn lại (⭐ tích lũy vẫn được giữ kèm theo để tham khảo)
  const rankedStudents = useMemo(
    () =>
      [...students]
        .map((s) => ({
          ...s,
          weeklyDelta: weeklyDeltaMap[s.name] || 0,
          weeklyScore: WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0),
        }))
        .sort((a, b) => b.weeklyScore - a.weeklyScore),
    [students, weeklyDeltaMap],
  );
  const topThreeStudents = rankedStudents.slice(0, 3);
  const remainingStudents = rankedStudents.slice(3);

  // Lọc task theo ngày đang được chọn trên lịch
  const selectedDateKey = formatDateKey(selectedDate);
  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) => (t.dateKey || formatDateKey(new Date())) === selectedDateKey,
    );
  }, [tasks, selectedDateKey]);

  const completedTaskCount = filteredTasks.filter((t) => t.completed).length;
  const totalTaskCount = filteredTasks.length;
  const taskProgressPct = totalTaskCount
    ? (completedTaskCount / totalTaskCount) * 100
    : 0;

  const sortedTasks = useMemo(() => {
    // Thứ tự ưu tiên chuẩn của mảng mặc định
    const fixedOrderTitles = DEFAULT_DAILY_TASKS.map((t) => t.title);

    return [...filteredTasks].sort((a, b) => {
      // 0. QUY TẮC KÉO THẢ: Nếu cả hai task đều đã có vị trí order thủ công rõ ràng, ưu tiên tuyệt đối theo order
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // 1. QUY TẮC 1: Việc chưa hoàn thành luôn đứng trên, hoàn thành xuống dưới
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // 2. QUY TẮC 2: Nếu cả hai cùng trạng thái, ưu tiên task mới thêm bằng tay lên trên cùng
      const isDefaultA = a.isDefault ? 1 : 0;
      const isDefaultB = b.isDefault ? 1 : 0;
      if (isDefaultA !== isDefaultB) {
        return isDefaultA - isDefaultB;
      }

      // 3. QUY TẮC 3: Nếu là các task mặc định với nhau, sắp xếp theo đúng trình tự gốc
      const indexA = fixedOrderTitles.indexOf(a.title);
      const indexB = fixedOrderTitles.indexOf(b.title);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // 4. QUY TẮC 4: Nếu là task tự thêm mới bằng tay, task nào tạo sau sẽ nằm trên
      const getTaskTime = (item: TaskItem): number => {
        const created = item.createdAt;
        if (
          created &&
          typeof created === "object" &&
          "toMillis" in created &&
          typeof (created as { toMillis: () => number }).toMillis === "function"
        ) {
          return (created as { toMillis: () => number }).toMillis();
        }
        return 0;
      };

      const timeA = getTaskTime(a);
      const timeB = getTaskTime(b);
      return timeB - timeA;
    });
  }, [filteredTasks]);
  const toggleTask = async (id: string, currentCompleted: boolean) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === id ? { ...t, completed: !currentCompleted } : t,
      ),
    );

    try {
      await updateDoc(doc(db, "dailyTasks", id), {
        completed: !currentCompleted,
      });
    } catch (error) {
      console.error("Cập nhật thất bại:", error);
      toast.error("Cập nhật trạng thái công việc thất bại!");
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === id ? { ...t, completed: currentCompleted } : t,
        ),
      );
    }
  };

  // Nút làm mới (Reset) trạng thái các task của ngày đã chọn về chưa hoàn thành
  const handleResetTasks = async () => {
    if (filteredTasks.length === 0) return;
    const updated = tasks.map((t) => {
      if ((t.dateKey || formatDateKey(new Date())) === selectedDateKey) {
        return { ...t, completed: false };
      }
      return t;
    });
    setTasks(updated);

    try {
      await Promise.all(
        filteredTasks.map((t) =>
          updateDoc(doc(db, "dailyTasks", t.id), { completed: false }),
        ),
      );
      toast.success("Đã làm mới trạng thái công việc!");
    } catch (error) {
      console.error("Lỗi khi reset task:", error);
      toast.error("Làm mới thất bại, vui lòng thử lại!");
    }
  };

  const handleOpenAddModal = () => {
    setEditingTask(null);
    setTaskTitleInput("");
    setTaskSubInput("");
    setIsTaskModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskTitleInput(task.title);
    setTaskSubInput(task.sub);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitleInput.trim()) return;

    if (editingTask) {
      try {
        await updateDoc(doc(db, "dailyTasks", editingTask.id), {
          title: taskTitleInput.trim(),
          sub: taskSubInput.trim() || "Việc cần làm trong ngày",
        });
        toast.success("Đã lưu thay đổi công việc!");
      } catch (error) {
        console.error("Lỗi khi lưu task:", error);
        toast.error("Lưu thay đổi thất bại, vui lòng thử lại!");
        setTasks(
          tasks.map((t) =>
            t.id === editingTask.id
              ? { ...t, title: taskTitleInput.trim(), sub: taskSubInput.trim() }
              : t,
          ),
        );
      }
    } else {
      try {
        await addDoc(collection(db, "dailyTasks"), {
          title: taskTitleInput.trim(),
          sub: taskSubInput.trim() || "Việc cần làm trong ngày",
          completed: false,
          dateKey: selectedDateKey,
          createdAt: serverTimestamp(),
        });
        toast.success("Đã thêm công việc mới!");
      } catch (error) {
        console.error("Lỗi khi thêm task:", error);
        toast.error("Thêm công việc thất bại, vui lòng thử lại!");
        setTasks([
          ...tasks,
          {
            id: Date.now().toString(),
            title: taskTitleInput.trim(),
            sub: taskSubInput.trim() || "Việc cần làm",
            completed: false,
            dateKey: selectedDateKey,
          },
        ]);
      }
    }

    setIsTaskModalOpen(false);
    setEditingTask(null);
    setTaskTitleInput("");
    setTaskSubInput("");
  };

  // Xóa 1 công việc (được gọi từ popup xác nhận)
  const handleDeleteTask = async () => {
    if (!confirmDeleteTask) return;
    const { id, title } = confirmDeleteTask;
    setDeletingTaskId(id);
    try {
      await deleteDoc(doc(db, "dailyTasks", id));
      toast.success(`Đã xóa công việc "${title}"!`);
    } catch (error) {
      console.error("Lỗi khi xóa task:", error);
      toast.error("Xóa công việc thất bại, vui lòng thử lại!");
    } finally {
      setDeletingTaskId(null);
      setConfirmDeleteTask(null);
    }
  };

  // Xóa toàn bộ lịch sử hoạt động (được gọi từ popup xác nhận)
  const handleClearAllActivity = async () => {
    setClearingActivity(true);
    try {
      const snapshot = await getDocs(collection(db, "activityLog"));
      if (snapshot.empty) {
        setActivity([]);
        toast.info("Không có hoạt động nào để xóa.");
        return;
      }
      const batch = writeBatch(db);
      snapshot.docs.forEach((document) => {
        batch.delete(doc(db, "activityLog", document.id));
      });
      await batch.commit();
      setActivity([]);
      toast.success("Đã xóa toàn bộ lịch sử hoạt động!");
    } catch (error: unknown) {
      toast.error(
        "Không thể xóa dữ liệu: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setClearingActivity(false);
      setConfirmClearActivity(false);
    }
  };

  // Tính toán ma trận ngày cho lịch tháng linh hoạt
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDayOfMonth.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  const calendarDays = [];
  for (let i = startDayOfWeek - 1; i > 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i + 1);
    calendarDays.push({ date: d, isCurrentMonth: false });
  }
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push({ date: d, isCurrentMonth: true });
  }
  const remainingCells =
    calendarDays.length <= 35
      ? 35 - calendarDays.length
      : 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i);
    calendarDays.push({ date: d, isCurrentMonth: false });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goTo = (sectionId: string, parentGroupId?: string) => {
    const path = SECTION_PATHS[sectionId];

    // Luôn cuộn về đầu trang trước khi điều hướng, để trang mới
    // không bị "kế thừa" vị trí cuộn từ trang cũ.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    if (path) {
      router.push(path);
      return;
    }
    if (onNavigate) {
      onNavigate(sectionId, parentGroupId);
    } else {
      toast.info("Tính năng này đang được phát triển, sẽ sớm ra mắt!");
    }
  };

  const [showScrollTop, setShowScrollTop] = useState(false);

  const seededDateRef = useRef<string | null>(null); // Theo dõi ngày đã được seed

  useEffect(() => {
    if (!tasksLoaded) return; // Đợi Firestore tải xong dữ liệu

    // Nếu ngày này đã được seed rồi thì bỏ qua
    if (seededDateRef.current === selectedDateKey) return;

    // Kiểm tra xem trong danh sách đã có task nào thuộc ngày đang chọn (selectedDateKey) chưa
    const hasAnyTaskForSelectedDate = tasks.some(
      (t) => (t.dateKey || formatDateKey(new Date())) === selectedDateKey,
    );

    if (hasAnyTaskForSelectedDate) {
      seededDateRef.current = selectedDateKey; // Đánh dấu ngày này đã có dữ liệu
      return;
    }

    seededDateRef.current = selectedDateKey; // Đánh dấu ngay để tránh gọi lặp

    (async () => {
      try {
        const batch = writeBatch(db);
        DEFAULT_DAILY_TASKS.forEach((task, index) => {
          const ref = doc(collection(db, "dailyTasks"));
          batch.set(ref, {
            title: task.title,
            sub: task.sub,
            completed: false,
            dateKey: selectedDateKey, // Lưu gắn liền với ngày đang chọn
            isDefault: true,
            order: index,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (error) {
        console.error("Lỗi khi tạo công việc mặc định:", error);
        seededDateRef.current = null; // Cho phép thử lại nếu ghi thất bại
      }
    })();
  }, [tasksLoaded, tasks, selectedDateKey]);

  // Thêm useEffect để lắng nghe sự kiện cuộn trang
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="space-y-6">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Banner chào mừng */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl  shadow-xs border border-amber-200  relative overflow-hidden text-slate-800">
        {/* Hoạ tiết trang trí nền nhẹ nhàng - đặt tuyệt đối, không chiếm layout */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 right-1/3 w-52 h-52 bg-orange-50 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-6 flex-wrap">
          {/* Nội dung chính */}
          <div className="flex-1 min-w-60 py-3 sm:py-4 flex flex-col items-start">
            <div className="flex items-center gap-2 mb-3.5">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200/60 inline-flex items-center gap-1">
                <span>
                  {new Date().getHours() < 12
                    ? "☀️"
                    : new Date().getHours() < 18
                      ? "🌤️"
                      : "🌙"}
                </span>
                {new Date().getHours() < 12
                  ? "Buổi sáng tốt lành"
                  : new Date().getHours() < 18
                    ? "Buổi chiều năng động"
                    : "Buổi tối an lành"}
              </span>
            </div>

            <h2
              className="text-2xl sm:text-3xl font-extrabold tracking-tight m-0 mb-3.5"
              style={{ color: "#f0b429" }}
            >
              Chào Cô Trúc trở lại! 👋
            </h2>
            <p className="text-sm text-slate-600 m-0 max-w-xl font-normal leading-relaxed mb-4">
              Tổng quan lớp học hôm nay gồm điểm danh, thi đua, thông báo và
              lịch trình giúp bạn quản lý nhanh chóng.
            </p>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {new Date().toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Niên khóa{" "}
                {new Date().getMonth() >= 7
                  ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
                  : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`}
              </span>
            </div>
          </div>

          {/* Ảnh cô giáo bên phải */}
          <div className="w-52 sm:w-64 shrink-0 hidden sm:flex items-end justify-center">
            <Image
              src="/images/banner-capy.png"
              alt="Cô Trúc"
              width={360}
              height={360}
              className="w-full h-auto object-contain max-h-52.5"
              priority
            />
          </div>
        </div>
      </div>

      {/* Thẻ thống kê điểm danh + ô nổi bật */}
      <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-orange-50/80 border border-orange-100/80 rounded-3xl px-4 py-3.5 text-center transition-all hover:shadow-xs">
            <p className="text-xl font-extrabold text-orange-700 m-0">
              {total}
            </p>
            <p className="text-[11px] font-bold text-orange-700/70 m-0 mt-0.5">
              Sĩ số lớp
            </p>
          </div>
          <div className="bg-emerald-50/80 border border-emerald-100/80 rounded-3xl px-4 py-3.5 text-center transition-all hover:shadow-xs">
            <p className="text-xl font-extrabold text-emerald-700 m-0">
              {countStatus("present")}
            </p>
            <p className="text-[11px] font-bold text-emerald-700/70 m-0 mt-0.5">
              Có mặt
            </p>
          </div>
          <div className="bg-sky-50/80 border border-sky-100/80 rounded-3xl px-4 py-3.5 text-center transition-all hover:shadow-xs">
            <p className="text-xl font-extrabold text-sky-700 m-0">
              {countStatus("excused")}
            </p>
            <p className="text-[11px] font-bold text-sky-700/70 m-0 mt-0.5">
              Nghỉ có phép
            </p>
          </div>
          <div className="bg-rose-50/80 border border-rose-100/80 rounded-3xl px-4 py-3.5 text-center transition-all hover:shadow-xs">
            <p className="text-xl font-extrabold text-rose-700 m-0">
              {countStatus("absent")}
            </p>
            <p className="text-[11px] font-bold text-rose-700/70 m-0 mt-0.5">
              Nghỉ không phép
            </p>
          </div>
          <div className="bg-violet-50/80 border border-violet-100/80 rounded-3xl px-4 py-3.5 text-center transition-all hover:shadow-xs col-span-2 sm:col-span-1">
            <p className="text-xl font-extrabold text-violet-700 m-0">
              {countStatus("late")}
            </p>
            <p className="text-[11px] font-bold text-violet-700/70 m-0 mt-0.5">
              Đi muộn
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            onClick={() => goTo("section-messages", "section-general-group")}
            className="text-left bg-slate-50/70 border border-slate-200/70 rounded-3xl p-4 hover:border-amber-400 hover:bg-amber-50/30 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-100/70 flex items-center justify-center text-base mb-2 group-hover:scale-105 transition-transform">
                <svg
                  className="w-4 h-4 text-amber-500"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-slate-500 m-0">
                Lời nhắn phụ huynh
              </p>
              <p className="text-sm font-extrabold text-slate-800 m-0 mt-0.5">
                {unresolvedCount} chưa giải quyết
              </p>
            </div>
            <p className="text-[11px] font-bold text-amber-600 mt-2 m-0 flex items-center gap-1">
              Xem chi tiết{" "}
              <span className="group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </p>
          </button>

          <button
            onClick={() => goTo("section-attendance", "section-tools-group")}
            className="text-left bg-slate-50/70 border border-slate-200/70 rounded-3xl p-4 hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 flex items-center justify-center text-base mb-2 group-hover:scale-105 transition-transform">
                <svg
                  className="w-4 h-4 text-emerald-500"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-slate-500 m-0">
                Điểm danh hôm nay
              </p>
              <p className="text-sm font-extrabold text-slate-800 m-0 mt-0.5">
                {countStatus("present")}/{total} có mặt
              </p>
            </div>
            <p className="text-[11px] font-bold text-emerald-600 mt-2 m-0 flex items-center gap-1">
              Điểm danh ngay{" "}
              <span className="group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </p>
          </button>

          <button
            onClick={() => goTo("section-students", "section-management-group")}
            className="text-left bg-slate-50/70 border border-slate-200/70 rounded-3xl p-4 hover:border-sky-400 hover:bg-sky-50/30 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-100/70 flex items-center justify-center text-base mb-2 group-hover:scale-105 transition-transform">
                <svg
                  className="w-4 h-4 text-sky-500"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-slate-500 m-0">
                Học sinh
              </p>
              <p className="text-sm font-extrabold text-slate-800 m-0 mt-0.5">
                {total} học sinh
              </p>
            </div>
            <p className="text-[11px] font-bold text-sky-600 mt-2 m-0 flex items-center gap-1">
              Xem danh sách{" "}
              <span className="group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </p>
          </button>

          <button
            onClick={() =>
              goTo("section-announcements", "section-general-group")
            }
            className="text-left bg-slate-50/70 border border-slate-200/70 rounded-3xl p-4 hover:border-purple-400 hover:bg-purple-50/30 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-100/70 flex items-center justify-center text-base mb-2 group-hover:scale-105 transition-transform">
                <svg
                  className="w-4 h-4 text-purple-500"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-slate-500 m-0">
                Thông báo mới nhất
              </p>
              <p className="text-sm font-extrabold text-slate-800 m-0 mt-0.5 truncate">
                {latestAnnouncement?.title || "Chưa có thông báo"}
              </p>
            </div>
            <p className="text-[11px] font-bold text-purple-600 mt-2 m-0 flex items-center gap-1">
              Xem tất cả{" "}
              <span className="group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </p>
          </button>
        </div>
      </div>

      {/* Biểu đồ */}
      <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 m-0">
          <svg
            className="w-4 h-4 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Biểu đồ thống kê lớp học
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          {/* Cột 1: Tỷ lệ điểm danh */}
          <div className="bg-slate-50/60 border border-amber-200  rounded-3xl p-5 flex flex-col justify-between">
            <p className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                />
              </svg>
              Tỷ lệ điểm danh hôm nay
            </p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <Doughnut
                segments={[
                  {
                    value: countStatus("present"),
                    color: "#1F9D6D",
                    label: "Có mặt",
                  },
                  {
                    value: countStatus("excused"),
                    color: "#0EA5E9",
                    label: "Phép",
                  },
                  {
                    value: countStatus("absent"),
                    color: "#E11D48",
                    label: "Vắng",
                  },
                  {
                    value: countStatus("late"),
                    color: "#8B5CF6",
                    label: "Trễ",
                  },
                ]}
              />
            </div>
          </div>

          {/* Cột 2: Tổng hợp điểm thi đua */}
          <div className="bg-slate-50/60 border border-amber-200  rounded-3xl p-5 flex flex-col justify-between">
            <p className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Điểm thi đua tuần này theo tổ
            </p>
            <div className="flex-1 flex items-center justify-center min-h-55 pb-2">
              <BarChart
                labels={GROUPS}
                values={groupStars.map((star) => Math.max(0, star))}
                colors={GROUP_COLORS}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phần Việc cần làm theo ngày & Lịch tương tác */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Việc cần làm theo ngày được chọn */}
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 m-0 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>{" "}
                Việc cần làm ngày{" "}
                {selectedDate.toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 m-0">
                Đã hoàn thành{" "}
                <span className="font-bold text-slate-700">
                  {completedTaskCount}/{totalTaskCount}
                </span>{" "}
                công việc
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalTaskCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetTasks}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
                  title="Làm mới trạng thái các việc của ngày này"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Làm mới
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Thêm việc mới
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-linear-to-r from-amber-400 via-orange-500 to-rose-500 h-full transition-all duration-500"
              style={{ width: `${taskProgressPct}%` }}
            />
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs bg-slate-50/50 rounded-3xl border border-dashed border-transparent">
              Không có công việc nào vào ngày này. Bấm &quot;Thêm việc mới&quot;
              để thêm lịch trình!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto no-scrollbar pr-1">
              {sortedTasks.map((t, index) => (
                <div
                  key={t.id}
                  draggable // Cho phép kéo phần tử này
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", index.toString());
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault(); // Bắt buộc để cho phép thả (drop)
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const draggedIndex = parseInt(
                      e.dataTransfer.getData("text/plain"),
                      10,
                    );
                    if (isNaN(draggedIndex) || draggedIndex === index) return;

                    // Đổi vị trí trong mảng hiển thị hiện tại
                    const updatedTasks = [...sortedTasks];
                    const [movedItem] = updatedTasks.splice(draggedIndex, 1);
                    updatedTasks.splice(index, 0, movedItem);

                    // Cập nhật lại thứ tự `order` mới cho tất cả các task vừa đổi chỗ và lưu lên Firestore
                    try {
                      const batch = writeBatch(db);
                      updatedTasks.forEach((item, newIdx) => {
                        const taskRef = doc(db, "dailyTasks", item.id);
                        batch.update(taskRef, { order: newIdx });
                      });
                      await batch.commit();
                    } catch (error) {
                      console.error("Lỗi khi cập nhật lại thứ tự task:", error);
                      toast.error("Cập nhật thứ tự công việc thất bại!");
                    }
                  }}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between cursor-grab active:cursor-grabbing group transition-all hover:bg-slate-50/60 px-2 rounded-xl"
                >
                  {/* Phần icon kéo thả (tuỳ chọn: thêm icon 6 chấm để người dùng dễ nhận biết) */}
                  <div className="flex items-start gap-3 flex-1 pr-3 pointer-events-none">
                    <span className="text-slate-300 font-bold text-xs select-none mt-1 group-hover:text-slate-500">
                      ⠿
                    </span>

                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Tránh bị xung đột sự kiện click hoàn thành task
                        toggleTask(t.id, t.completed);
                      }}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all pointer-events-auto cursor-pointer ${
                        t.completed
                          ? "bg-emerald-500 text-white shadow-2xs"
                          : "border-2 border-slate-300 bg-white"
                      }`}
                    >
                      {t.completed && (
                        <span className="text-[10px] font-extrabold">✓</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pointer-events-auto">
                      <p
                        className={`text-xs font-bold m-0 wrap-break-word transition-all ${
                          t.completed
                            ? "line-through text-slate-400 font-normal"
                            : "text-slate-800"
                        }`}
                      >
                        {t.title}
                        {t.isDefault && (
                          <span className="ml-1.5 inline-block align-middle text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200  px-1.5 py-0.5 rounded-md">
                            Mặc định
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 m-0 mt-0.5 wrap-break-word">
                        {t.sub}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(e, t)}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs flex items-center gap-1.5"
                      title="Sửa việc"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
                      </svg>
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteTask(t);
                      }}
                      className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5"
                      title="Xóa việc"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lịch tháng tương tác động kèm hiệu ứng bông hoa khi hoàn thành */}
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-800 m-0 capitalize">
              Tháng {month + 1} • {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-8 h-8 rounded-xl border border-slate-200/80 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 rounded-xl border border-slate-200/80 flex items-center justify-center text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 py-1">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span>CN</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {calendarDays.map((item, index) => {
              const dKey = formatDateKey(item.date);
              const isSelected = dKey === selectedDateKey;
              const isToday = dKey === formatDateKey(today);

              const dayTaskList = tasks.filter(
                (t) => (t.dateKey || formatDateKey(new Date())) === dKey,
              );
              const isAllCompleted =
                dayTaskList.length > 0 && dayTaskList.every((t) => t.completed);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  className={`py-2 rounded-xl font-bold transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                    isSelected
                      ? "bg-linear-to-r from-orange-500 to-amber-500 text-white shadow-md scale-105 z-10"
                      : isToday
                        ? "border-2 border-amber-500 text-amber-700 bg-amber-50/50"
                        : item.isCurrentMonth
                          ? "text-slate-800 bg-slate-50/80 hover:bg-slate-100"
                          : "text-slate-300 bg-transparent hover:bg-slate-50"
                  }`}
                >
                  <span>{item.date.getDate()}</span>
                  {isAllCompleted && (
                    <span
                      className="absolute -top-1 -right-1 text-[10px]"
                      title="Đã hoàn thành tất cả công việc!"
                    >
                      🌸
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold text-slate-500 text-center m-0 pt-2">
            {totalTaskCount > 0 && completedTaskCount === totalTaskCount
              ? "🌸 Hoàn tất công việc để thắp sáng ngày hôm nay!"
              : "✨ Hoàn thành mọi mục tiêu để thắp sáng ngày mới!"}
          </p>
        </div>
      </div>

      {/* Hai cột: Hoạt động gần đây + Bảng xếp hạng học sinh đầy đủ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch mb-0">
        {/* Bảng xếp hạng học sinh đầy đủ (có cuộn mượt mà) */}
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 m-0">
              <svg
                className="w-4 h-4 text-amber-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0012 0V2z" />
              </svg>{" "}
              Bảng xếp hạng học sinh
            </h3>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
              {students.length} học sinh
            </span>
          </div>

          {students.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Chưa có dữ liệu học sinh.
            </p>
          ) : (
            <>
              {/* Bục xếp hạng Top 3 - hạng nhất ở giữa có vương miện, hạng 2/3 hai bên */}
              {topThreeStudents.length > 0 && (
                <div className="flex items-end justify-center gap-3 sm:gap-5 pb-5 pt-1 border-b border-slate-100 mb-1">
                  {topThreeStudents[1] && (
                    <PodiumAvatar student={topThreeStudents[1]} rank={2} />
                  )}
                  {topThreeStudents[0] && (
                    <PodiumAvatar student={topThreeStudents[0]} rank={1} />
                  )}
                  {topThreeStudents[2] && (
                    <PodiumAvatar student={topThreeStudents[2]} rank={3} />
                  )}
                </div>
              )}

              {/* Danh sách từ hạng #4 trở đi */}
              {remainingStudents.length > 0 && (
                <div
                  className={`divide-y divide-slate-100 ${
                    remainingStudents.length > 5
                      ? "max-h-72 overflow-y-auto no-scrollbar pr-1"
                      : ""
                  } space-y-2`}
                >
                  {remainingStudents.map((s, i) => (
                    <div
                      key={s.id || i}
                      className="bg-slate-50/80 border border-slate-200/70 rounded-3xl p-3 flex items-center justify-between hover:border-amber-300 hover:shadow-2xs transition-all pt-2.5 first:pt-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs w-7 text-center font-extrabold shrink-0 text-slate-600">
                          #{i + 4}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-800 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-2xs border border-amber-200/50 overflow-hidden">
                          {s.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.avatarUrl}
                              alt={s.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            lastInitial(s.name)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-bold text-slate-800 m-0 truncate"
                            title={s.name}
                          >
                            {s.name}
                          </p>
                          {/* 👇 Thay dòng "Tổ x" chữ thường bằng badge bo tròn có màu */}
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              GROUP_BADGE_STYLES[s.group]?.badgeBg ||
                              "bg-slate-50"
                            } ${GROUP_BADGE_STYLES[s.group]?.badgeText || "text-slate-600"} ${
                              GROUP_BADGE_STYLES[s.group]?.badgeBorder ||
                              "border-slate-200"
                            }`}
                          >
                            {s.group || "Tổ 1"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 pl-2 text-right">
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-xl text-xs font-extrabold border border-amber-200  shadow-2xs">
                          {s.weeklyScore ?? WEEKLY_BASE_POINTS} đ
                        </span>
                        <p className="text-[9px] font-semibold text-slate-400 m-0 mt-0.5">
                          ⭐ {s.stars || 0} tích lũy
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cột trái: Hoạt động gần đây + Lối tắt nhanh */}
        <div className="flex flex-col gap-5">
          {/* 1. Hoạt động gần đây */}
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 m-0">
                <svg
                  className="w-4 h-4 text-amber-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Hoạt động gần đây
              </h3>
              <div className="flex items-center gap-2">
                {activity.length > 0 && (
                  <button
                    onClick={() => setConfirmClearActivity(true)}
                    className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>{" "}
                    Xóa tất cả
                  </button>
                )}
                <button
                  onClick={() => setShowAllActivityModal(true)}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  Xem chi tiết ({activity.length})
                </button>
              </div>
            </div>

            {activity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-amber-200 ">
                Chưa có hoạt động nào được ghi nhận.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-3xl p-4 border border-transparent max-h-75 overflow-y-auto no-scrollbar">
                {activity.slice(0, 5).map((a, index) => (
                  <div
                    key={a.id || index}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-xs"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{
                        background: a.delta >= 0 ? "#1F9D6D" : "#C1443A",
                      }}
                    />
                    <p className="m-0 flex-1 truncate text-slate-700">
                      <b className="font-bold text-slate-900">{a.name}</b> —{" "}
                      {a.label}
                    </p>
                    <span
                      className="font-extrabold px-2 py-0.5 rounded-md text-[11px] shrink-0"
                      style={{
                        color: a.delta >= 0 ? "#1F9D6D" : "#C1443A",
                        background: a.delta >= 0 ? "#E6F4EA" : "#FCE8E6",
                      }}
                    >
                      {a.delta >= 0 ? "+" : ""}
                      {a.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. LỐI TẮT NHANH (Hiển thị các ô đã chọn động) */}
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-amber-200  space-y-3.5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 m-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-600"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Lối tắt nhanh chức năng
                </h3>
                <button
                  onClick={() => setIsShortcutModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
                  title="Tùy chỉnh thêm bớt tính năng"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>{" "}
                  Cài đặt ({currentShortcuts.length})
                </button>
              </div>

              {/* Lưới các ô lối tắt động */}
              <div className="grid grid-cols-2 gap-2.5">
                {currentShortcuts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => goTo(item.section, item.group)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 ${item.hoverBg} border border-slate-200/70 ${item.hoverBorder} transition-all text-left group cursor-pointer`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg ${item.bg} ${item.text} flex items-center justify-center text-sm shrink-0 group-hover:scale-110 transition-transform`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-800 m-0 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 m-0">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP CÀI ĐẶT: Kéo thả trực tiếp & Chọn tính năng */}
      {isShortcutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fadeIn mb-0">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-5 transform transition-all scale-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800 m-0 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>{" "}
                Cài đặt lối tắt chức năng nhanh
              </h3>
              <button
                onClick={() => setIsShortcutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
              {/* PHẦN 1: CÁC TÍNH NĂNG ĐANG HIỂN THỊ (HỖ TRỢ KÉO THẢ) */}
              <div>
                <p className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider mb-2">
                  Đang hiển thị ngoài màn hình (Kéo để sắp xếp)
                </p>
                <div className="space-y-2">
                  {activeShortcutIds.map((id, index) => {
                    const feat = allAvailableFeatures.find((f) => f.id === id);
                    if (!feat) return null;

                    return (
                      <div
                        key={feat.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "text/plain",
                            index.toString(),
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedIndex = parseInt(
                            e.dataTransfer.getData("text/plain"),
                            10,
                          );
                          if (isNaN(draggedIndex) || draggedIndex === index)
                            return;

                          const updated = [...activeShortcutIds];
                          const [movedItem] = updated.splice(draggedIndex, 1);
                          updated.splice(index, 0, movedItem);
                          setActiveShortcutIds(updated);
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-amber-200 shadow-xs cursor-grab active:cursor-grabbing hover:border-amber-400 transition-all duration-150 transform hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                          <span className="text-slate-400 font-bold text-xs select-none">
                            ⠿
                          </span>
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => toggleFeatureSelection(feat.id)}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer pointer-events-auto"
                          />
                          <span
                            className={`w-7 h-7 rounded-lg ${feat.bg} ${feat.text} flex items-center justify-center text-xs shrink-0 font-bold`}
                          >
                            {feat.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-800 m-0 truncate">
                              {feat.title}
                            </p>
                            <p className="text-[10px] text-slate-400 m-0">
                              {feat.desc}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md pointer-events-none">
                          Vị trí #{index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PHẦN 2: CÁC TÍNH NĂNG ĐANG ẨN (BẤM ĐỂ BẬT LÊN) */}
              <div>
                <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  Các tính năng khác (Bấm để thêm ra ngoài)
                </p>
                <div className="space-y-2">
                  {allAvailableFeatures
                    .filter((f) => !activeShortcutIds.includes(f.id))
                    .map((feat) => (
                      <div
                        key={feat.id}
                        onClick={() => toggleFeatureSelection(feat.id)}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all cursor-pointer opacity-75 hover:opacity-100"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-4 h-4 border border-slate-300 rounded flex items-center justify-center text-transparent">
                            ✓
                          </span>
                          <span
                            className={`w-7 h-7 rounded-lg ${feat.bg} ${feat.text} flex items-center justify-center text-xs shrink-0 font-bold`}
                          >
                            {feat.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-800 m-0 truncate">
                              {feat.title}
                            </p>
                            <p className="text-[10px] text-slate-400 m-0">
                              {feat.desc}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-md">
                          + Thêm
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                Đang chọn:{" "}
                <b className="text-amber-700">{activeShortcutIds.length}</b>{" "}
                tính năng hiển thị
              </span>
              <button
                onClick={() => setIsShortcutModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL THÊM / SỬA TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 mb-0">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                {editingTask
                  ? "Chỉnh sửa công việc"
                  : `Thêm công việc (Ngày ${selectedDate.toLocaleDateString("vi-VN")})`}
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tên công việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Soạn giáo án môn Toán..."
                  value={taskTitleInput}
                  onChange={(e) => setTaskTitleInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ghi chú / Mô tả phụ
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tiết 3, chuẩn bị phiếu bài tập..."
                  value={taskSubInput}
                  onChange={(e) => setTaskSubInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  {editingTask ? "Lưu thay đổi" : "Thêm công việc"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA CÔNG VIỆC */}
      {confirmDeleteTask && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 mb-0">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa công việc?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa công việc{" "}
                <strong className="text-slate-800">
                  &quot;{confirmDeleteTask.title}&quot;
                </strong>{" "}
                không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTask(null)}
                disabled={deletingTaskId === confirmDeleteTask.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deletingTaskId === confirmDeleteTask.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingTaskId === confirmDeleteTask.id
                  ? "Đang xóa..."
                  : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA TOÀN BỘ LỊCH SỬ HOẠT ĐỘNG */}
      {confirmClearActivity && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 mb-0">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa toàn bộ lịch sử hoạt động?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{activity.length}</strong>{" "}
                hoạt động sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearActivity(false)}
                disabled={clearingActivity}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClearAllActivity}
                disabled={clearingActivity}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {clearingActivity ? "Đang xóa..." : "Xóa tất cả"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP HIỂN THỊ TẤT CẢ LỊCH SỬ HOẠT ĐỘNG --- */}
      {showAllActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn mb-0">
          <div className="bg-white w-full max-w-lg rounded-3xl  shadow-2xl border border-amber-200  overflow-hidden flex flex-col max-h-[85vh]">
            {/* Tiêu đề Popup */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 m-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-600"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>{" "}
                Lịch sử tất cả hoạt động ({activity.length})
              </h3>
              <button
                onClick={() => setShowAllActivityModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Danh sách toàn bộ hoạt động (Không dùng slice để hiện tất cả) */}
            <div className="p-6 overflow-y-auto space-y-3 divide-y divide-slate-100 flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Chưa có hoạt động nào.
                </p>
              ) : (
                activity.map((a, index) => (
                  <div
                    key={a.id || index}
                    className="flex items-center gap-3 pt-3 first:pt-0 text-xs"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{
                        background: a.delta >= 0 ? "#1F9D6D" : "#C1443A",
                      }}
                    />
                    <p className="m-0 flex-1 text-slate-700">
                      <b className="font-bold text-slate-800">{a.name}</b> —{" "}
                      {a.label}{" "}
                    </p>
                    <span
                      className="font-extrabold px-2 py-0.5 rounded-md text-[11px] shrink-0"
                      style={{
                        color: a.delta >= 0 ? "#1F9D6D" : "#C1443A",
                        background: a.delta >= 0 ? "#E6F4EA" : "#FCE8E6",
                      }}
                    >
                      {a.delta >= 0 ? "+" : ""}
                      {a.delta}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Nút đóng Popup */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAllActivityModal(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nút Về đầu trang */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Về đầu trang"
          className="back-to-top"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 50,
            background: "#b45309",
            color: "#fff",
            fontWeight: "bold",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          ↑
        </button>
      )}
    </div>
  );
}
