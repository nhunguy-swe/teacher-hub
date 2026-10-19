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
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { GROUPS, normalizeGroupName, getSeatGroupIndex } from "@/lib/groups";
import * as XLSX from "xlsx";
import {
  getMonday,
  getSunday,
  buildWeeklyDeltaMap,
  WEEKLY_BASE_POINTS,
} from "@/lib/weeklyScore";

interface StudentItem {
  id: string;
  name: string;
  group?: string;
  stars?: number;
}

const GROUP_STYLES: Record<
  string,
  {
    dot: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    btnPlusBg: string;
    btnPlusText: string;
    btnPlusBorder: string;
    btnPlusHover: string;
    btnMinusBg: string;
    btnMinusText: string;
    btnMinusBorder: string;
    btnMinusHover: string;
    btnResetBg: string;
    btnResetText: string;
    btnResetBorder: string;
    btnResetHover: string;
  }
> = {
  "Tổ 1": {
    dot: "text-blue-500",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-100",
    btnPlusBg: "bg-blue-50",
    btnPlusText: "text-blue-700",
    btnPlusBorder: "border-blue-200",
    btnPlusHover: "hover:bg-blue-600 hover:text-white",
    btnMinusBg: "bg-indigo-50",
    btnMinusText: "text-indigo-700",
    btnMinusBorder: "border-indigo-200",
    btnMinusHover: "hover:bg-indigo-600 hover:text-white",
    btnResetBg: "bg-sky-50",
    btnResetText: "text-sky-700",
    btnResetBorder: "border-sky-200",
    btnResetHover: "hover:bg-sky-600 hover:text-white",
  },
  "Tổ 2": {
    dot: "text-emerald-500",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-100",
    btnPlusBg: "bg-emerald-50",
    btnPlusText: "text-emerald-700",
    btnPlusBorder: "border-emerald-200",
    btnPlusHover: "hover:bg-emerald-600 hover:text-white",
    btnMinusBg: "bg-teal-50",
    btnMinusText: "text-teal-700",
    btnMinusBorder: "border-teal-200",
    btnMinusHover: "hover:bg-teal-600 hover:text-white",
    btnResetBg: "bg-green-50",
    btnResetText: "text-green-700",
    btnResetBorder: "border-green-200",
    btnResetHover: "hover:bg-green-600 hover:text-white",
  },
  "Tổ 3": {
    dot: "text-amber-500",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-100",
    btnPlusBg: "bg-amber-50",
    btnPlusText: "text-amber-700",
    btnPlusBorder: "border-amber-200",
    btnPlusHover: "hover:bg-amber-600 hover:text-white",
    btnMinusBg: "bg-orange-50",
    btnMinusText: "text-orange-700",
    btnMinusBorder: "border-orange-200",
    btnMinusHover: "hover:bg-orange-600 hover:text-white",
    btnResetBg: "bg-yellow-50",
    btnResetText: "text-yellow-700",
    btnResetBorder: "border-yellow-200",
    btnResetHover: "hover:bg-yellow-600 hover:text-white",
  },
};

type WeeklyLog = {
  name: string;
  delta: number;
  label?: string;
  createdAt?: { toDate: () => Date } | null;
};

type ReportRange =
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

const SIGNED_KEYS = ["Điểm", "Cộng/trừ", "Thưởng/phạt tổ"];

const formatDMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AdminCompetitionGroups({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [bonus, setBonus] = useState<Record<string, number>>({
    "Tổ 1": 0,
    "Tổ 2": 0,
    "Tổ 3": 0,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasGroupChanged, setHasGroupChanged] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        stars: 0,
        ...docSnap.data(),
      })) as StudentItem[];
      setStudents(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const ref = doc(db, "settings", "groupBonus");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) setBonus((prev) => ({ ...prev, ...snap.data() }));
    });
    return () => unsubscribe();
  }, []);

  // Toàn bộ activityLog, dùng để tính điểm THI ĐUA TUẦN NÀY (100đ/hs + cộng/trừ)
  const [weeklyActivityLogs, setWeeklyActivityLogs] = useState<WeeklyLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWeeklyActivityLogs(snapshot.docs.map((d) => d.data()) as WeeklyLog[]);
    });
    return () => unsubscribe();
  }, []);

  const weekMonday = useMemo(() => getMonday(new Date()), []);
  const weekSunday = useMemo(() => getSunday(weekMonday), [weekMonday]);
  const weeklyDeltaMap = useMemo(
    () => buildWeeklyDeltaMap(weeklyActivityLogs, weekMonday, weekSunday),
    [weeklyActivityLogs, weekMonday, weekSunday],
  );

  // Điểm thi đua TUẦN NÀY theo tổ = tổng điểm tuần của thành viên
  // (100đ + cộng/trừ) + điểm thưởng/phạt tổ ghi trong tuần
  const weeklyGroupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    GROUPS.forEach((g) => {
      const membersWeekly = students
        .filter((s) => normalizeGroupName(s.group) === g)
        .reduce(
          (a, s) => a + WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0),
          0,
        );
      const teamBonusWeekly = weeklyDeltaMap[g] || 0;
      totals[g] = membersWeekly + teamBonusWeekly;
    });
    return totals;
  }, [students, weeklyDeltaMap]);

  const groupStars = useMemo(() => {
    const totals: Record<string, number> = {};
    GROUPS.forEach((g) => {
      const total =
        students
          .filter((s) => normalizeGroupName(s.group) === g)
          .reduce((a, s) => a + (s.stars || 0), 0) + (bonus[g] || 0);
      totals[g] = Math.max(0, total);
    });
    return totals;
  }, [students, bonus]);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTab, setReportTab] = useState<"summary" | "members" | "bonus">(
    "summary",
  );
  const [reportRange, setReportRange] = useState<ReportRange>("thisWeek");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ===== Mốc thời gian của báo cáo =====
  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  const reportBounds = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const mon0 = getMonday(new Date());
    const mon = new Date(mon0.getFullYear(), mon0.getMonth(), mon0.getDate());

    switch (reportRange) {
      case "thisWeek":
        return {
          start: mon,
          end: endOfDay(
            new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6),
          ),
        };
      case "lastWeek": {
        const s = new Date(
          mon.getFullYear(),
          mon.getMonth(),
          mon.getDate() - 7,
        );
        return {
          start: s,
          end: endOfDay(
            new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6),
          ),
        };
      }
      case "thisMonth":
        return {
          start: new Date(y, m, 1),
          end: endOfDay(new Date(y, m + 1, 0)),
        };
      case "lastMonth":
        return {
          start: new Date(y, m - 1, 1),
          end: endOfDay(new Date(y, m, 0)),
        };
      case "custom":
        return {
          start: customFrom ? parseLocalDate(customFrom) : null,
          end: customTo ? endOfDay(parseLocalDate(customTo)) : null,
        };
      default:
        return { start: null, end: null };
    }
  }, [reportRange, customFrom, customTo]);

  const reportRangeLabel = useMemo(() => {
    const { start, end } = reportBounds;
    if (!start && !end) return "Toàn bộ thời gian";
    return `${start ? formatDMY(start) : "..."} – ${end ? formatDMY(end) : "..."}`;
  }, [reportBounds]);

  // Log nằm trong mốc đã chọn
  const rangeLogs = useMemo(() => {
    const { start, end } = reportBounds;
    if (!start && !end) return weeklyActivityLogs;
    return weeklyActivityLogs.filter((l) => {
      const d = l.createdAt?.toDate?.();
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [weeklyActivityLogs, reportBounds]);

  // Tổng cộng/trừ của từng học sinh / từng tổ trong mốc đã chọn
  const rangeDeltaMap = useMemo(() => {
    const map: Record<string, number> = {};
    rangeLogs.forEach((l) => {
      map[l.name] = (map[l.name] || 0) + (l.delta || 0);
    });
    return map;
  }, [rangeLogs]);

  // Số tuần trong mốc (mỗi tuần mỗi học sinh có 100đ nền)
  const weeksCount = useMemo(() => {
    const now = new Date();
    let earliest: Date | null = null;
    weeklyActivityLogs.forEach((l) => {
      const d = l.createdAt?.toDate?.();
      if (d && (!earliest || d < earliest)) earliest = d;
    });
    const effStart = reportBounds.start ?? earliest ?? now;
    const effEnd =
      reportBounds.end && reportBounds.end < now ? reportBounds.end : now;

    let cursor = getMonday(new Date(effStart));
    let count = 0;
    while (cursor <= effEnd && count < 520) {
      count++;
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 7,
      );
    }
    return Math.max(1, count);
  }, [reportBounds, weeklyActivityLogs]);

  const rangeGroupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    GROUPS.forEach((g) => {
      const members = students
        .filter((s) => normalizeGroupName(s.group) === g)
        .reduce(
          (a, s) =>
            a + WEEKLY_BASE_POINTS * weeksCount + (rangeDeltaMap[s.name] || 0),
          0,
        );
      totals[g] = members + (rangeDeltaMap[g] || 0);
    });
    return totals;
  }, [students, rangeDeltaMap, weeksCount]);

  // Sheet 1: Tổng hợp theo tổ
  const reportSummaryRows = useMemo(() => {
    const rows = GROUPS.map((g) => {
      const members = students.filter((s) => normalizeGroupName(s.group) === g);
      return {
        Tổ: g,
        "Số học sinh": members.length,
        "Điểm của tổ": rangeGroupTotals[g] || 0,
        "Thưởng/phạt tổ": rangeDeltaMap[g] || 0,
        "Điểm TB/hs": members.length
          ? Number(((rangeGroupTotals[g] || 0) / members.length).toFixed(1))
          : 0,
        "Sao cộng dồn": groupStars[g] || 0,
      };
    }).sort((a, b) => b["Điểm của tổ"] - a["Điểm của tổ"]);

    return rows.map((r, i) => ({ Hạng: i + 1, ...r }));
  }, [students, rangeGroupTotals, rangeDeltaMap, groupStars]);

  // Sheet 2: Chi tiết thành viên
  const reportMemberRows = useMemo(() => {
    const rows: Record<string, string | number>[] = [];
    GROUPS.forEach((g) => {
      students
        .filter((s) => normalizeGroupName(s.group) === g)
        .sort(
          (a, b) =>
            (rangeDeltaMap[b.name] || 0) - (rangeDeltaMap[a.name] || 0) ||
            (b.stars || 0) - (a.stars || 0) ||
            a.name.localeCompare(b.name, "vi"),
        )
        .forEach((s, i) => {
          rows.push({
            Tổ: g,
            STT: i + 1,
            "Họ và tên": s.name,
            "Tổng điểm":
              WEEKLY_BASE_POINTS * weeksCount + (rangeDeltaMap[s.name] || 0),
            "Cộng/trừ": rangeDeltaMap[s.name] || 0,
            "Sao tích lũy": s.stars || 0,
          });
        });
    });
    return rows;
  }, [students, rangeDeltaMap, weeksCount]);

  // Sheet 3: Lịch sử thưởng/phạt ghi cho tổ
  const reportBonusRows = useMemo(
    () =>
      rangeLogs
        .filter((l) => GROUPS.includes(l.name))
        .map((l) => ({
          "Thời gian": l.createdAt?.toDate
            ? l.createdAt.toDate().toLocaleString("vi-VN")
            : "",
          Tổ: l.name,
          "Nội dung": l.label || "",
          Điểm: l.delta,
        })),
    [rangeLogs],
  );

  const reportPreviewRows: Record<string, string | number>[] =
    reportTab === "summary"
      ? reportSummaryRows
      : reportTab === "members"
        ? reportMemberRows
        : reportBonusRows;

  const reportCellClass = (key: string, value: string | number) => {
    if (typeof value !== "number") return "text-slate-700";
    if (SIGNED_KEYS.includes(key)) {
      if (value > 0) return "text-emerald-600 font-bold";
      if (value < 0) return "text-rose-600 font-bold";
      return "text-slate-400";
    }
    return "text-slate-700";
  };

  const handleExportReport = () => {
    try {
      const makeSheet = (rows: Record<string, unknown>[], widths: number[]) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = widths.map((wch) => ({ wch }));
        return ws;
      };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        makeSheet(reportSummaryRows, [6, 8, 12, 18, 22, 12, 14]),
        "Tổng hợp tổ",
      );
      XLSX.utils.book_append_sheet(
        wb,
        makeSheet(reportMemberRows, [8, 6, 26, 12, 14, 13]),
        "Chi tiết thành viên",
      );
      XLSX.utils.book_append_sheet(
        wb,
        makeSheet(reportBonusRows, [20, 8, 50, 8]),
        "Thưởng phạt tổ",
      );
      XLSX.writeFile(
        wb,
        `Bao-cao-thi-dua-to-${reportRange}-${getTodayKey()}.xlsx`,
      );
      toast.success("Xuất file Excel thành công!");
      setReportOpen(false);
    } catch (error) {
      console.error("Lỗi xuất Excel:", error);
      toast.error("Không thể xuất file Excel.");
    }
  };

  const handleOpenAddModal = () => {
    setSearchTerm("");
    setShowAddModal(true);
  };

  const handleUpdateStudentGroup = async (
    studentId: string,
    newGroup: string,
  ) => {
    const student = students.find((s) => s.id === studentId);
    if (student && normalizeGroupName(student.group) === newGroup) return;

    try {
      await updateDoc(doc(db, "students", studentId), {
        group: newGroup,
        team: newGroup,
      });

      // Gỡ học sinh khỏi ghế cũ nếu ghế đó thuộc cột của tổ khác
      const chartRef = doc(db, "settings", "seatingChart");
      const chartSnap = await getDoc(chartRef);
      if (chartSnap.exists()) {
        const oldSeats = (chartSnap.data().seats || {}) as Record<
          string,
          string
        >;
        const newIdx = GROUPS.indexOf(newGroup);

        const cleaned = Object.fromEntries(
          Object.entries(oldSeats).filter(
            ([seatKey, sid]) =>
              sid !== studentId || getSeatGroupIndex(seatKey) === newIdx,
          ),
        );

        if (Object.keys(cleaned).length !== Object.keys(oldSeats).length) {
          await updateDoc(chartRef, { seats: cleaned });
        }
      }

      toast.success(
        student
          ? `Đã chuyển "${student.name}" sang ${newGroup}!`
          : `Đã chuyển học sinh sang ${newGroup}!`,
      );

      setHasGroupChanged(true);
      localStorage.setItem("needsSeatingUpdate", "true");
    } catch (error) {
      console.error("Lỗi khi chuyển tổ học sinh:", error);
      toast.error("Không thể chuyển tổ học sinh");
    }
  };

  const filteredStudentsForModal = useMemo(() => {
    if (!searchTerm.trim()) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );
  }, [students, searchTerm]);

  return (
    <>
      <div className="w-full h-full flex flex-col bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
        {(hasGroupChanged ||
          localStorage.getItem("needsSeatingUpdate") === "true") && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">
                  Thông báo đồng bộ sơ đồ lớp
                </p>
                <p className="text-xs text-amber-800">
                  Vừa có thay đổi về tổ của học sinh. Vui lòng cập nhật lại Sơ
                  đồ lớp để khớp vị trí chỗ ngồi!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Gọi trực tiếp hàm chuyển tab từ component cha truyền xuống
                  setActiveTab("seating-chart");
                  localStorage.removeItem("needsSeatingUpdate");
                  setHasGroupChanged(false);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-all cursor-pointer"
              >
                Đi đến Sơ đồ lớp ngay
              </button>
              <button
                onClick={() => {
                  setHasGroupChanged(false);
                  localStorage.removeItem("needsSeatingUpdate");
                }}
                className="text-amber-700 hover:text-amber-900 text-xs font-semibold px-2 py-1 cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
              <svg
                className="text-amber-600"
                width="20"
                height="20"
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
              Thi đua tổ
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
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
              >
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
              </svg>
              Xuất Excel báo cáo
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
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
                className="lucide lucide-list-sort-descending preview-icon"
              >
                <path d="M15 12H3" />
                <path d="M3 5h18" />
                <path d="M9 19H3" />
              </svg>
              Sắp xếp tổ
            </button>
          </div>
        </div>

        {/* Grid điều chỉnh hiển thị 3 cột thay vì 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          {GROUPS.map((g) => {
            const style = GROUP_STYLES[g];
            const studentsInGroup = students
              .filter((s) => normalizeGroupName(s.group) === g)
              .sort((a, b) => {
                // 1. Điểm tuần cao xuống thấp
                const diff =
                  (weeklyDeltaMap[b.name] || 0) - (weeklyDeltaMap[a.name] || 0);
                if (diff !== 0) return diff;
                // 2. Bằng điểm tuần: so sao tích lũy
                const starsDiff = (b.stars || 0) - (a.stars || 0);
                if (starsDiff !== 0) return starsDiff;
                // 3. Vẫn bằng: theo tên A-Z
                return a.name.localeCompare(b.name, "vi");
              });

            return (
              <div
                key={g}
                className="bg-slate-50/7 rounded-3xl p-4 flex flex-col justify-between space-y-3 border border-amber-200"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm m-0 flex items-center gap-1.5">
                    <span className={`${style.dot} text-base`}>●</span> {g}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-extrabold ${style.badgeText} ${style.badgeBg} border ${style.badgeBorder} rounded-full px-2.5 py-1`}
                    >
                      {weeklyGroupTotals[g] || 0} đ tuần này
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400">
                      Cộng dồn: {groupStars[g] || 0} điểm
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {studentsInGroup.map((s) => {
                    const wDelta = weeklyDeltaMap[s.name] || 0;
                    const wScore = WEEKLY_BASE_POINTS + wDelta;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs border-b border-dashed border-slate-200/60 py-1.5"
                      >
                        <span className="text-slate-700 font-medium truncate pr-2 flex-1">
                          {s.name}
                        </span>
                        <span className="text-right whitespace-nowrap">
                          <span className="text-amber-600 font-bold">
                            {wScore} đ
                          </span>
                          <span className="block text-[9px] text-slate-400 font-semibold">
                            ⭐ {s.stars || 0}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  {studentsInGroup.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-6">
                      Chưa có học sinh
                    </p>
                  )}
                </div>

                <div
                  className={`flex items-center justify-center gap-1.5 pt-1 pb-0.5 text-xs font-bold ${style.badgeText} ${style.badgeBg} border ${style.badgeBorder} rounded-lg py-1.5`}
                >
                  <span>Điểm TB cả tổ:</span>
                  <span>
                    {studentsInGroup.length > 0
                      ? (
                          (weeklyGroupTotals[g] || 0) / studentsInGroup.length
                        ).toFixed(1)
                      : 0}{" "}
                    đ/hs
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base m-0">
                  Xem &amp; xuất báo cáo thi đua tổ
                </h3>
                <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                  {reportRangeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0 w-20">
                  Nội dung:
                </span>
                <select
                  value={reportTab}
                  onChange={(e) =>
                    setReportTab(
                      e.target.value as "summary" | "members" | "bonus",
                    )
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="summary">Tổng hợp theo tổ</option>
                  <option value="members">Chi tiết thành viên</option>
                  <option value="bonus">Lịch sử thưởng/phạt tổ</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0 w-20">
                  Thời gian:
                </span>
                <select
                  value={reportRange}
                  onChange={(e) =>
                    setReportRange(e.target.value as ReportRange)
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="thisWeek">Tuần này</option>
                  <option value="lastWeek">Tuần trước</option>
                  <option value="thisMonth">Tháng này</option>
                  <option value="lastMonth">Tháng trước</option>
                  <option value="all">Tất cả</option>
                  <option value="custom">Tùy chọn khoảng ngày...</option>
                </select>
              </div>

              {reportRange === "custom" && (
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0" />
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-slate-400">đến</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400 m-0 pl-22">
                Đang xem: {reportRangeLabel}
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl flex-1 overflow-auto">
              {reportPreviewRows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Chưa có dữ liệu trong mục này.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100! text-slate-700! border-b border-slate-200">
                      {Object.keys(reportPreviewRows[0]).map((key) => (
                        <th
                          key={key}
                          className="p-2.5 font-bold bg-slate-100! text-slate-700! dark:bg-indigo-950! dark:text-indigo-200!"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportPreviewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        {Object.entries(row).map(([key, value]) => (
                          <td
                            key={key}
                            className={`p-2.5 ${reportCellClass(key, value)}`}
                          >
                            {typeof value === "number" &&
                            value > 0 &&
                            SIGNED_KEYS.includes(key)
                              ? `+${value}`
                              : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={handleExportReport}
                disabled={reportSummaryRows.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
              >
                Tải file Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all shadow-2xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐƯỢC ĐẶT Ở NGOÀI HOÀN TOÀN ĐỂ KHÔNG BỊ KẸT KHUNG */}
      {showAddModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Quản lý & Thêm học sinh vào tổ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body Modal */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700">
                  Danh sách học sinh hiện có
                </span>
                <span className="text-[11px] text-slate-400">
                  ({filteredStudentsForModal.length} học sinh)
                </span>
              </div>

              <input
                type="text"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:border-amber-400 focus:outline-none shadow-2xs shrink-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nhập tên học sinh để tìm nhanh..."
              />

              <div className="overflow-y-auto flex-1 border border-slate-100 rounded-xl divide-y divide-slate-100 pr-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredStudentsForModal.map((s) => {
                  const studentNormalizedGroup = normalizeGroupName(s.group);
                  return (
                    <div
                      key={s.id}
                      className="py-2.5 px-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-medium text-slate-700 truncate pr-2">
                        {s.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {GROUPS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleUpdateStudentGroup(s.id, g)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                              studentNormalizedGroup === g
                                ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {filteredStudentsForModal.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Không tìm thấy học sinh phù hợp
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
