"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  buildWeeklyDeltaMap,
  getMonday,
  getSunday,
  WEEKLY_BASE_POINTS,
} from "@/lib/weeklyScore";

interface StudentItem {
  id: string;
  name: string;
  group?: string;
  stars?: number;
  avatarUrl?: string;
}

type PrivilegeTarget = "student" | "team" | "both";

interface PrivilegeItem {
  id: string;
  title: string;
  description: string;
  targetType: PrivilegeTarget;
}

/**
 * Người/tổ đang được chọn để trao đặc quyền.
 * kind = "student" -> trao cho 1 học sinh cụ thể (top 3 hoặc bất kỳ)
 * kind = "team"    -> trao cho 1 tổ bất kỳ (dẫn đầu hoặc không)
 */
interface Recipient {
  kind: "student" | "team";
  id: string;
  name: string;
  subtitle: string;
  avatar: string; // chữ cái viết tắt (chỉ dùng cho học sinh khi không có ảnh)
  avatarUrl?: string; // ảnh đại diện thật của học sinh (nếu có)
}

interface ActivityLogItem {
  name: string;
  label: string;
  delta: number;
  createdAt?: { toDate: () => Date } | null;
}

/* ---------- BỘ ICON SVG (cùng phong cách với menu bên cạnh) ---------- */
type IconProps = { className?: string; size?: number };

const Svg = ({
  children,
  className = "",
  size = 16,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </Svg>
);
const HistoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </Svg>
);
const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
);
const TrophyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0012 0V2z" />
  </Svg>
);
const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </Svg>
);
const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </Svg>
);
const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Svg>
);
const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
  </Svg>
);

// Chỉ có 3 tổ thi đua, khớp với tab "Thi đua tổ"
const GROUPS = ["Tổ 1", "Tổ 2", "Tổ 3"];

// Nhãn hiển thị cho đối tượng áp dụng của 1 thẻ đặc quyền
const TARGET_LABELS: Record<
  PrivilegeTarget,
  { label: string; Icon: (p: IconProps) => React.ReactElement }
> = {
  student: { label: "Học sinh", Icon: UserIcon },
  team: { label: "Tổ", Icon: UsersIcon },
  both: { label: "Học sinh & Tổ", Icon: TargetIcon },
};

const normalizeGroupName = (groupName?: string) => {
  if (!groupName) return "Tổ 1";
  const match = groupName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0]);
    if (num >= 1 && num <= 3) {
      return `Tổ ${num}`;
    }
  }
  return "Tổ 1";
};

// Dữ liệu cũ có thể chưa có targetType (trước đây dùng minRank) -> mặc định "both"
const normalizeTargetType = (value: unknown): PrivilegeTarget => {
  if (value === "student" || value === "team" || value === "both") return value;
  return "both";
};

const getInitials = (name: string) => {
  const clean = name.replace(/[0-9]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (
      words[words.length - 2][0] + words[words.length - 1][0]
    ).toUpperCase();
  }
  return (words[0]?.[0] || "HS").toUpperCase();
};

const getRandomItem = (list: PrivilegeItem[]): PrivilegeItem => {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
};

const formatLogDate = (log: ActivityLogItem) => {
  if (!log.createdAt || typeof log.createdAt.toDate !== "function")
    return "Vừa xong";
  return log.createdAt.toDate().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Thẻ hiển thị 1 đặc quyền, dùng chung cho khu vực preview và modal "Xem tất cả"
function PrivilegeCard({
  item,
  onEdit,
  onDelete,
}: {
  item: PrivilegeItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = TARGET_LABELS[item.targetType];
  return (
    <div className="p-4 rounded-3xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between relative transition-all hover:border-amber-300 hover:shadow-2xs">
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          title="Chỉnh sửa thẻ"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-100 transition-all cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Xóa thẻ"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
      <div className="pr-20">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
          <meta.Icon size={11} /> {meta.label}
        </span>
        <h4 className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5 m-0">
          {item.title}
        </h4>
        <p className="text-xs text-slate-500 mt-1 m-0 line-clamp-2">
          {item.description}
        </p>
      </div>
    </div>
  );
}

export default function AdminPrivileges() {
  const toast = useToast();

  // ===== DỮ LIỆU THẬT TỪ FIRESTORE =====
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [bonus, setBonus] = useState<Record<string, number>>({
    "Tổ 1": 0,
    "Tổ 2": 0,
    "Tổ 3": 0,
  });
  const [privileges, setPrivileges] = useState<PrivilegeItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        stars: 0,
        ...docSnap.data(),
      })) as StudentItem[];
      setStudents(data);
      setStudentsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const ref = doc(db, "settings", "groupBonus");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setBonus((prev) => ({
          ...prev,
          ...(snap.data() as Record<string, number>),
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "privileges"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          title: (raw.title as string) || "",
          description: (raw.description as string) || "",
          targetType: normalizeTargetType(raw.targetType),
        } as PrivilegeItem;
      });
      setPrivileges(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) =>
        docSnap.data(),
      ) as ActivityLogItem[];
      setActivityLogs(data.filter((log) => log.label?.includes("đặc quyền")));
    });
    return () => unsubscribe();
  }, []);

  // Toàn bộ activityLog (không lọc), dùng để tính điểm tuần (100đ/hs + cộng/trừ)
  const [allActivityLogs, setAllActivityLogs] = useState<ActivityLogItem[]>([]);
  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllActivityLogs(
        snapshot.docs.map((docSnap) => docSnap.data()) as ActivityLogItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  const weekMonday = useMemo(() => getMonday(new Date()), []);
  const weekSunday = useMemo(() => getSunday(weekMonday), [weekMonday]);
  const weeklyDeltaMap = useMemo(
    () => buildWeeklyDeltaMap(allActivityLogs, weekMonday, weekSunday),
    [allActivityLogs, weekMonday, weekSunday],
  );

  // ===== TÍNH TOÁN TỪ DỮ LIỆU THẬT =====

  // Top 3 học sinh có ĐIỂM TUẦN cao nhất lớp (100đ + cộng/trừ trong tuần)
  const topStudents = useMemo(() => {
    return [...students]
      .map((s) => ({
        ...s,
        weeklyDelta: weeklyDeltaMap[s.name] || 0,
        weeklyScore: WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0),
      }))
      .sort((a, b) => b.weeklyScore - a.weeklyScore)
      .slice(0, 3);
  }, [students, weeklyDeltaMap]);

  // Xếp hạng 3 tổ theo ĐIỂM TUẦN (tổng điểm tuần thành viên + điểm thưởng/phạt
  // tổ ghi trong tuần). Điểm cộng dồn cũ vẫn được tính kèm để tham khảo.
  const teamStandings = useMemo(() => {
    return GROUPS.map((g) => {
      const cumulativeTotal =
        students
          .filter((s) => normalizeGroupName(s.group) === g)
          .reduce((a, s) => a + (s.stars || 0), 0) + (bonus[g] || 0);
      const weeklyMembersTotal = students
        .filter((s) => normalizeGroupName(s.group) === g)
        .reduce(
          (a, s) => a + WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0),
          0,
        );
      const weeklyTeamBonus = weeklyDeltaMap[g] || 0;
      return {
        name: g,
        total: Math.max(0, cumulativeTotal),
        weeklyTotal: weeklyMembersTotal + weeklyTeamBonus,
      };
    }).sort((a, b) => b.weeklyTotal - a.weeklyTotal);
  }, [students, bonus, weeklyDeltaMap]);

  const buildStudentRecipient = (
    s: StudentItem & { weeklyScore?: number },
    rank?: number,
  ): Recipient => ({
    kind: "student",
    id: s.id,
    name: s.name,
    subtitle: `${normalizeGroupName(s.group)}${rank ? ` • Hạng ${rank}` : ""} • ${
      s.weeklyScore ?? WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0)
    } đ tuần (⭐ ${s.stars || 0} tích lũy)`,
    avatar: getInitials(s.name),
    avatarUrl: s.avatarUrl,
  });

  // Tổ nào cũng có thể được chọn để trao đặc quyền, không chỉ tổ dẫn đầu
  const buildTeamRecipient = (
    teamName: string,
    weeklyTotal: number,
    rank: number,
  ): Recipient => ({
    kind: "team",
    id: teamName,
    name: teamName,
    subtitle:
      rank === 1
        ? `Tổ dẫn đầu tuần này • ${weeklyTotal} đ`
        : `Tổ hạng ${rank} tuần này • ${weeklyTotal} đ`,
    avatar: "", // tổ dùng icon SVG, không dùng chữ/emoji
  });

  // Người/tổ đang được chọn để trao đặc quyền (mặc định là học sinh Top 1 khi có dữ liệu)
  const [activeRecipient, setActiveRecipient] = useState<Recipient | null>(
    null,
  );

  useEffect(() => {
    if (!activeRecipient && topStudents.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveRecipient(buildStudentRecipient(topStudents[0], 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topStudents]);

  // Chỉ những đặc quyền phù hợp với loại đối tượng đang chọn (học sinh / tổ / cả hai)
  const eligiblePrivileges = useMemo(() => {
    if (!activeRecipient) return [];
    return privileges.filter(
      (p) => p.targetType === "both" || p.targetType === activeRecipient.kind,
    );
  }, [privileges, activeRecipient]);

  // States Modal
  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [searchStudentKeyword, setSearchStudentKeyword] = useState("");

  const [showDrawModal, setShowDrawModal] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [wonPrivilege, setWonPrivilege] = useState<PrivilegeItem | null>(null);
  const [finalWinningIndex, setFinalWinningIndex] = useState<number | null>(
    null,
  );
  const [isFlipped, setIsFlipped] = useState(false);

  const [showAllModal, setShowAllModal] = useState(false);

  // Modal Thêm / Chỉnh sửa thẻ đặc quyền (dùng chung 1 modal cho cả 2 chế độ)
  const [showPrivilegeModal, setShowPrivilegeModal] = useState(false);
  const [editingPrivilege, setEditingPrivilege] =
    useState<PrivilegeItem | null>(null);
  const [privilegeForm, setPrivilegeForm] = useState<{
    title: string;
    description: string;
    targetType: PrivilegeTarget;
  }>({ title: "", description: "", targetType: "both" });
  const [savingPrivilege, setSavingPrivilege] = useState(false);

  // Xác nhận xóa thẻ đặc quyền
  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<PrivilegeItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenDrawModal = () => {
    setHighlightedIndex(null);
    setWonPrivilege(null);
    setFinalWinningIndex(null);
    setIsFlipped(false);
    setIsSpinning(false);
    setShowDrawModal(true);
  };

  const handleStartSpin = () => {
    if (isSpinning || eligiblePrivileges.length === 0 || !activeRecipient)
      return;

    setIsSpinning(true);
    setWonPrivilege(null);
    setFinalWinningIndex(null);
    setIsFlipped(false);

    let currentStep = 0;
    const totalSteps = 24 + Math.floor(Math.random() * 8);
    let speed = 50;

    const runSpin = () => {
      const randomIdx = Math.floor(Math.random() * 8);
      setHighlightedIndex(randomIdx);
      currentStep++;

      if (currentStep < totalSteps) {
        speed += 12;
        setTimeout(runSpin, speed);
      } else {
        const finalIdx = randomIdx;
        setFinalWinningIndex(finalIdx);
        setHighlightedIndex(finalIdx);

        const finalPrize = getRandomItem(eligiblePrivileges);
        setWonPrivilege(finalPrize);
        setIsSpinning(false);

        setTimeout(() => {
          setIsFlipped(true);
        }, 150);

        // Ghi lịch sử thật vào activityLog (dùng chung với lịch sử điểm sao/tổ)
        addDoc(collection(db, "activityLog"), {
          name: activeRecipient.name,
          label:
            activeRecipient.kind === "team"
              ? `🎁 Tổ nhận đặc quyền: ${finalPrize.title}`
              : `🎁 Trúng đặc quyền: ${finalPrize.title}`,
          delta: 0,
          createdAt: serverTimestamp(),
        }).catch(() => {
          toast.error("Không thể lưu lịch sử bốc thăm");
        });
      }
    };

    runSpin();
  };

  const openAddPrivilegeModal = () => {
    setEditingPrivilege(null);
    setPrivilegeForm({ title: "", description: "", targetType: "both" });
    setShowPrivilegeModal(true);
  };

  const openEditPrivilegeModal = (item: PrivilegeItem) => {
    setEditingPrivilege(item);
    setPrivilegeForm({
      title: item.title,
      description: item.description,
      targetType: item.targetType,
    });
    setShowPrivilegeModal(true);
  };

  const handleSavePrivilege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privilegeForm.title.trim()) return;

    setSavingPrivilege(true);
    try {
      if (editingPrivilege) {
        await updateDoc(doc(db, "privileges", editingPrivilege.id), {
          title: privilegeForm.title.trim(),
          description:
            privilegeForm.description.trim() || "Không có mô tả chi tiết.",
          targetType: privilegeForm.targetType,
        });
        toast.success("Đã cập nhật thẻ đặc quyền thành công!");
      } else {
        await addDoc(collection(db, "privileges"), {
          title: privilegeForm.title.trim(),
          description:
            privilegeForm.description.trim() || "Không có mô tả chi tiết.",
          targetType: privilegeForm.targetType,
          createdAt: serverTimestamp(),
        });
        toast.success(`Đã thêm thẻ đặc quyền "${privilegeForm.title.trim()}"!`);
      }
      setShowPrivilegeModal(false);
      setEditingPrivilege(null);
      setPrivilegeForm({ title: "", description: "", targetType: "both" });
    } catch (error) {
      console.error("Lỗi khi lưu thẻ đặc quyền:", error);
      toast.error(
        editingPrivilege
          ? "Không thể cập nhật thẻ đặc quyền"
          : "Không thể thêm đặc quyền mới",
      );
    } finally {
      setSavingPrivilege(false);
    }
  };

  const handleDeletePrivilege = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteDoc(doc(db, "privileges", confirmDeleteItem.id));
      toast.success(`Đã xóa thẻ đặc quyền "${confirmDeleteItem.title}"!`);
      setConfirmDeleteItem(null);
    } catch (error) {
      console.error("Lỗi khi xóa thẻ đặc quyền:", error);
      toast.error("Không thể xóa thẻ đặc quyền");
    } finally {
      setDeletingId(null);
    }
  };

  // Toàn bộ học sinh thật trong lớp — dùng cho modal "Chọn học sinh bất kỳ"
  const filteredStudentsForModal = useMemo(() => {
    const kw = searchStudentKeyword.toLowerCase().trim();
    if (!kw) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        normalizeGroupName(s.group).toLowerCase().includes(kw),
    );
  }, [students, searchStudentKeyword]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <span className="text-amber-600 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </span>
          Đặc Quyền & Bốc Thẻ Bí Mật
        </h2>
        <button
          onClick={openAddPrivilegeModal}
          className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <svg
            width="16"
            height="16"
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
          Thêm Đặc Quyền Mới
        </button>
      </div>

      {/* THANH THÔNG TIN NGƯỜI/TỔ ĐANG ĐƯỢC CHỌN */}
      <div className="p-5 rounded-3xl bg-amber-50/40 border border-amber-100/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-lg font-black text-amber-700 border border-amber-100 shrink-0 overflow-hidden">
            {activeRecipient?.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeRecipient.avatarUrl}
                alt={activeRecipient.name}
                className="w-full h-full object-cover"
              />
            ) : activeRecipient?.kind === "team" ? (
              <TrophyIcon size={22} className="text-amber-600" />
            ) : activeRecipient ? (
              activeRecipient.avatar
            ) : (
              "…"
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-0.5 rounded-full">
              {activeRecipient?.kind === "team"
                ? "Đang chọn trao thưởng cho Tổ"
                : "Đang chọn trao thưởng cho Học sinh"}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 mt-1 m-0">
              {activeRecipient ? (
                <>
                  {activeRecipient.name}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({activeRecipient.subtitle})
                  </span>
                </>
              ) : (
                <span className="text-slate-400 text-xs font-semibold">
                  Đang tải danh sách học sinh...
                </span>
              )}
            </h3>
          </div>
        </div>
        <button
          onClick={() => setShowAllStudentsModal(true)}
          className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-search"
          >
            <path d="m21 21-4.34-4.34" />
            <circle cx="11" cy="11" r="8" />
          </svg>{" "}
          Chọn học sinh bất kỳ trong lớp
        </button>
      </div>

      {/* BẢNG VÀNG TOP HỌC SINH */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-800 mb-3 m-0 flex items-center gap-2">
          <StarIcon className="text-amber-600" /> Bảng Vàng Top Học Sinh Xuất
          Sắc
        </h3>
        {studentsLoaded && topStudents.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Chưa có học sinh nào trong hệ thống.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topStudents.map((student, idx) => {
              const isSelected =
                activeRecipient?.kind === "student" &&
                activeRecipient.id === student.id;
              const rank = idx + 1;
              return (
                <div
                  key={student.id}
                  onClick={() =>
                    setActiveRecipient(buildStudentRecipient(student, rank))
                  }
                  className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20"
                      : "border-slate-100 bg-slate-50/60 hover:border-amber-300 hover:shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-black w-10 h-10 rounded-full bg-white shadow-xs flex items-center justify-center border border-slate-100 text-amber-700 overflow-hidden">
                      {student.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={student.avatarUrl}
                          alt={student.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(student.name)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                          Top {rank}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full">
                          {normalizeGroupName(student.group)}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-1 m-0">
                        {student.name}
                      </h4>
                      <p className="text-[11px] font-semibold text-amber-700 m-0">
                        {student.weeklyScore} đ tuần
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 m-0">
                        ⭐ {student.stars || 0} tích lũy
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* XẾP HẠNG TỔ — tất cả các tổ đều có thể được chọn để trao đặc quyền */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-800 mb-3 m-0 flex items-center gap-2">
          <TrophyIcon className="text-amber-600" /> Xếp Hạng Tổ (theo tổng điểm)
        </h3>
        <div className="space-y-2.5">
          {teamStandings.map((entry, idx) => {
            const isLeading = idx === 0;
            const rank = idx + 1;
            const isSelected =
              activeRecipient?.kind === "team" &&
              activeRecipient.id === entry.name;

            return (
              <div
                key={entry.name}
                onClick={() =>
                  setActiveRecipient(
                    buildTeamRecipient(entry.name, entry.weeklyTotal, rank),
                  )
                }
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20"
                    : "border-slate-100 bg-slate-50/60 hover:border-amber-300 hover:shadow-2xs"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white shadow-xs flex items-center justify-center border border-slate-100 text-lg">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isLeading
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-500 border border-slate-200/60"
                        }`}
                      >
                        {isLeading ? "Hạng 1 - Tổ dẫn đầu" : `Hạng ${rank}`}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-1 m-0">
                      {entry.name}
                    </h4>
                    <p className="text-[11px] font-semibold text-amber-700 m-0">
                      {entry.weeklyTotal} đ tuần này
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 m-0">
                      Cộng dồn: {entry.total} điểm
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
                  {isSelected ? "✔ Đang chọn" : "Bấm để chọn"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* KHU VỰC BẤM MỞ THẺ */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-amber-500 to-orange-500 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md shadow-amber-500/20">
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-[11px] font-bold bg-white/25 px-2.5 py-1 rounded-full text-white">
            Trạm bốc thăm phần thưởng
          </span>
          <h3 className="text-lg sm:text-xl font-black mt-2 m-0">
            {activeRecipient?.kind === "team" ? "Tổ" : "Học sinh"}:{" "}
            <span className="underline">
              {activeRecipient?.name || "Chưa chọn"}
            </span>
          </h3>
          <p className="text-xs text-amber-50 m-0">
            {activeRecipient &&
            eligiblePrivileges.length === 0 &&
            privileges.length > 0
              ? "Chưa có thẻ đặc quyền nào phù hợp với đối tượng này."
              : "Sẵn sàng mở ô thẻ bí mật để nhận các phần quà và đặc quyền hấp dẫn."}
          </p>
        </div>
        <button
          onClick={handleOpenDrawModal}
          disabled={!activeRecipient || eligiblePrivileges.length === 0}
          className="px-6 py-3 bg-white text-amber-700 hover:bg-amber-50 font-black rounded-xl shadow-md transition-all text-xs tracking-wide shrink-0 transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center gap-2"
        >
          <GiftIcon size={16} /> MỞ THẺ BÍ MẬT NGAY
        </button>
      </div>

      {/* KHO THẺ ĐẶC QUYỀN */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-extrabold text-slate-800 m-0 flex items-center gap-2">
            <TagIcon className="text-amber-600" /> Kho thẻ đặc quyền hệ thống (
            {privileges.length})
          </h3>
          <button
            onClick={() => setShowAllModal(true)}
            className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Xem tất cả</span>
            <span>→</span>
          </button>
        </div>

        {privileges.length === 0 ? (
          <div className="p-6 bg-slate-50/60 rounded-3xl border border-slate-100 text-center text-slate-400 text-xs">
            Chưa có thẻ đặc quyền nào. Bấm &quot;Thêm Đặc Quyền Mới&quot; để tạo
            thẻ đầu tiên.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {privileges.slice(0, 3).map((item) => (
              <PrivilegeCard
                key={item.id}
                item={item}
                onEdit={() => openEditPrivilegeModal(item)}
                onDelete={() => setConfirmDeleteItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* LỊCH SỬ BỐC THẺ (đọc thật từ activityLog) */}
      <div className="pt-4 border-t border-slate-100">
        <h3 className="text-sm font-extrabold text-slate-800 mb-3 m-0 flex items-center gap-2">
          <HistoryIcon className="text-amber-600" /> Lịch sử bốc thăm đặc quyền
        </h3>

        {activityLogs.length === 0 ? (
          <div className="p-6 bg-slate-50/60 rounded-3xl border border-slate-100 text-center text-slate-400 text-xs">
            Chưa có lượt bốc thăm nào diễn ra.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
            {activityLogs.slice(0, 30).map((log, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-slate-800">{log.name}</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                    {log.label}
                  </span>
                </div>
                <span className="text-slate-400 font-mono font-medium">
                  {formatLogDate(log)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CHỌN HỌC SINH BẤT KỲ (toàn bộ học sinh thật) */}
      {showAllStudentsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-xl border border-[#EFE8D8] relative max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Chọn Học Sinh Bất Kỳ Trong Lớp ({students.length})
              </h3>
              <button
                onClick={() => setShowAllStudentsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên học sinh hoặc tên tổ..."
                value={searchStudentKeyword}
                onChange={(e) => setSearchStudentKeyword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
              {filteredStudentsForModal.length === 0 ? (
                <div className="col-span-2 text-center text-slate-400 text-xs py-8">
                  {students.length === 0
                    ? "Chưa có học sinh nào trong hệ thống."
                    : "Không tìm thấy học sinh phù hợp."}
                </div>
              ) : (
                filteredStudentsForModal.map((st) => {
                  const isChosen =
                    activeRecipient?.kind === "student" &&
                    activeRecipient.id === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setActiveRecipient(buildStudentRecipient(st));
                        setShowAllStudentsModal(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChosen
                          ? "bg-amber-50/80 border-amber-300"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white shadow-xs flex items-center justify-center text-[11px] font-black text-amber-700 border border-slate-100 overflow-hidden">
                          {st.avatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={st.avatarUrl}
                              alt={st.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(st.name)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                              {normalizeGroupName(st.group)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {WEEKLY_BASE_POINTS +
                                (weeklyDeltaMap[st.name] || 0)}{" "}
                              đ tuần · ⭐ {st.stars || 0}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-xs mt-0.5 m-0">
                            {st.name}
                          </h4>
                        </div>
                      </div>
                      {isChosen && (
                        <span className="text-amber-700 font-bold text-xs">
                          ✔
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3 flex justify-end">
              <button
                onClick={() => setShowAllStudentsModal(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUAY THẺ 3D */}
      {showDrawModal && activeRecipient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-xl border border-[#EFE8D8] text-center relative">
            <button
              onClick={() => setShowDrawModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="inline-block px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold mb-2">
              KHO BÁU ĐẶC QUYỀN
            </div>

            <div className="flex items-center justify-center gap-2.5 mb-1">
              {activeRecipient.avatarUrl && (
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-200 shadow-xs shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeRecipient.avatarUrl}
                    alt={activeRecipient.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 m-0">
                {activeRecipient.kind === "team" ? "Tổ" : "Học sinh"}:{" "}
                <span className="text-amber-700">{activeRecipient.name}</span>
              </h3>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mb-6">
              {isSpinning
                ? "⚡ Đang quay và chọn ngẫu nhiên đặc quyền..."
                : wonPrivilege && isFlipped
                  ? `🎉 Chúc mừng! Đã trúng đặc quyền: "${wonPrivilege.title}"`
                  : eligiblePrivileges.length === 0
                    ? "Không có thẻ đặc quyền nào phù hợp với đối tượng này."
                    : "Bấm nút 'QUAY THẺ NGAY' để hệ thống random và lật thẻ!"}
            </p>

            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6"
              style={{ perspective: "1000px" }}
            >
              {Array.from({ length: 8 }).map((_, index) => {
                const isCurrentHighlight = highlightedIndex === index;
                const isWinningCard =
                  finalWinningIndex === index && wonPrivilege !== null;

                return (
                  <div
                    key={index}
                    className="h-32 w-full relative"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      className={`w-full h-full rounded-3xl transition-transform duration-700 relative shadow-xs ${
                        isWinningCard && isFlipped
                          ? "transform-[rotateY(180deg)]"
                          : "transform-[rotateY(0deg)]"
                      }`}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* Mặt trước */}
                      <div
                        className={`absolute inset-0 w-full h-full rounded-3xl p-3 flex flex-col items-center justify-center text-center border backface-hidden ${
                          isCurrentHighlight
                            ? "bg-amber-500 text-white border-amber-500 shadow-md scale-102"
                            : "bg-slate-50 text-slate-600 border-slate-200/80"
                        }`}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-base mb-1.5 ${
                            isCurrentHighlight
                              ? "bg-white/20 text-white"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isCurrentHighlight ? <StarIcon size={16} /> : "?"}
                        </div>
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase ${isCurrentHighlight ? "text-white" : "text-slate-500"}`}
                        >
                          {isCurrentHighlight ? "ĐANG CHỌN" : "THẺ BÍ MẬT"}
                        </span>
                      </div>

                      {/* Mặt sau */}
                      {wonPrivilege && (
                        <div
                          className="absolute inset-0 w-full h-full rounded-3xl p-3 flex flex-col items-center justify-center text-center bg-linear-to-br from-amber-500 to-orange-500 text-white border-2 border-white shadow-lg transform-[rotateY(180deg)] backface-hidden"
                          style={{ backfaceVisibility: "hidden" }}
                        >
                          <span className="text-[8px] font-extrabold uppercase tracking-widest bg-white/25 px-2 py-0.5 rounded-full mb-1">
                            TRÚNG THẺ
                          </span>
                          <h4 className="text-[11px] font-black text-white leading-tight line-clamp-2 m-0">
                            {wonPrivilege.title}
                          </h4>
                          <p className="text-[9px] text-amber-50 line-clamp-2 leading-tight mt-0.5 m-0">
                            {wonPrivilege.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={handleStartSpin}
                disabled={isSpinning || eligiblePrivileges.length === 0}
                className={`px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all text-xs cursor-pointer ${
                  isSpinning || eligiblePrivileges.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSpinning ? "⏳ ĐANG QUAY..." : "🎲 QUAY THẺ NGAY"}
              </button>

              <button
                onClick={() => setShowDrawModal(false)}
                disabled={isSpinning}
                className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs cursor-pointer"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM TẤT CẢ KHO THẺ */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-xl border border-[#EFE8D8] relative max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Kho Thẻ Đặc Quyền ({privileges.length})
              </h3>
              <button
                onClick={() => setShowAllModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
              {privileges.length === 0 ? (
                <div className="col-span-2 text-center text-slate-400 text-xs py-8">
                  Chưa có thẻ đặc quyền nào.
                </div>
              ) : (
                privileges.map((item) => (
                  <PrivilegeCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEditPrivilegeModal(item)}
                    onDelete={() => setConfirmDeleteItem(item)}
                  />
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3 flex justify-end">
              <button
                onClick={() => setShowAllModal(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / CHỈNH SỬA ĐẶC QUYỀN */}
      {showPrivilegeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-[#EFE8D8] relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                {editingPrivilege
                  ? "Chỉnh Sửa Thẻ Đặc Quyền"
                  : "Thêm Thẻ Đặc Quyền Mới"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPrivilegeModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSavePrivilege}
              className="space-y-3 text-xs text-left"
            >
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Tiêu đề thẻ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Được miễn bài tập về nhà..."
                  value={privilegeForm.title}
                  onChange={(e) =>
                    setPrivilegeForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors placeholder:text-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Mô tả đặc quyền
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả chi tiết quyền lợi..."
                  value={privilegeForm.description}
                  onChange={(e) =>
                    setPrivilegeForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors placeholder:text-slate-300 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Đối tượng áp dụng
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["student", "team", "both"] as const).map((t) => {
                    const meta = TARGET_LABELS[t];
                    const selected = privilegeForm.targetType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setPrivilegeForm((f) => ({ ...f, targetType: t }))
                        }
                        className={`py-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          selected
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                        }`}
                      >
                        <meta.Icon size={18} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 m-0">
                  Quyết định thẻ này sẽ xuất hiện khi bốc thăm cho học sinh (bất
                  kỳ, kể cả không thuộc Top 3), cho tổ (dẫn đầu hoặc không), hay
                  cả hai.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrivilegeModal(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPrivilege}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingPrivilege
                    ? "Đang lưu..."
                    : editingPrivilege
                      ? "Lưu Thay Đổi"
                      : "Lưu Thẻ Bài"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA THẺ ĐẶC QUYỀN */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa thẻ đặc quyền?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa thẻ{" "}
                <strong className="text-slate-800">
                  &quot;{confirmDeleteItem.title}&quot;
                </strong>{" "}
                khỏi kho? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={deletingId === confirmDeleteItem.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeletePrivilege}
                disabled={deletingId === confirmDeleteItem.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingId === confirmDeleteItem.id ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
