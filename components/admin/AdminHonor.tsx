"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";

interface StudentItem {
  id: string;
  name: string;
  group: string;
  stars: number;
  avatarUrl?: string;
}

interface ActivityLogItem {
  id: string;
  name: string;
  label: string;
  delta: number;
  createdAt?: { toDate: () => Date } | null;
}

interface WeeklyStudentRow {
  id: string;
  name: string;
  group: string;
  delta: number;
  weeklyScore: number;
  rank: number;
  avatarUrl?: string;
}

interface WeeklyReportDoc {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  savedAt?: { toDate: () => Date } | null;
  students: WeeklyStudentRow[];
}

interface AggregatedRow {
  name: string;
  group: string;
  totalDelta: number;
  weeksCounted: number;
  rank: number;
}

interface CriteriaItem {
  id: string;
  title: string;
  type: "plus" | "minus";
  points: number;
}

interface PreviewRow {
  rank: number;
  name: string;
  group: string;
  delta: number;
  total: number;
}

const WEEKLY_BASE_POINTS = 100;

const GROUP_TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  "Tổ 1": { bg: "#EFF6FF", fg: "#1D4ED8" }, // blue-50 / blue-700
  "Tổ 2": { bg: "#ECFDF5", fg: "#047857" }, // emerald-50 / emerald-700
  "Tổ 3": { bg: "#FFFBEB", fg: "#B45309" }, // amber-50 / amber-700
  "Tổ 4": { bg: "#FAF5FF", fg: "#7E22CE" }, // purple-50 / purple-700
};

function lastInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.charAt(0).toUpperCase() || "?";
}

function avatarFallbackUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=random&bold=true`;
}

function normalizeGroupName(groupName?: string) {
  if (!groupName) return "Tổ 1";
  const match = groupName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 4) return `Tổ ${num}`;
  }
  return groupName.trim();
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatShort(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatShortWithYear(date: Date) {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function monthKeyOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-");
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

function aggregateWeeks(weeks: WeeklyReportDoc[]): AggregatedRow[] {
  const map: Record<string, AggregatedRow> = {};
  weeks.forEach((w) => {
    w.students.forEach((s) => {
      if (!map[s.name]) {
        map[s.name] = {
          name: s.name,
          group: s.group,
          totalDelta: 0,
          weeksCounted: 0,
          rank: 0,
        };
      }
      map[s.name].totalDelta += s.delta;
      map[s.name].weeksCounted += 1;
      map[s.name].group = s.group;
    });
  });
  const list = Object.values(map).sort((a, b) => b.totalDelta - a.totalDelta);
  return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// Lấy danh sách các ngày từ Thứ 2 đến Thứ 7 trong tuần được chọn
function getDaysOfWeek(monday: Date) {
  const days = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d); // Thứ 2 tới Thứ 7
  }
  return days;
}

export default function AdminHonor() {
  const toast = useToast();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportDoc[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"week" | "total">("week");
  const [selectedMonday, setSelectedMonday] = useState<Date>(() =>
    getMonday(new Date()),
  );
  const [saving, setSaving] = useState(false);

  // Thêm state vào trong component AdminHonor
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [, setCriteriaLoaded] = useState(false);

  // State cho popup xác nhận xóa báo cáo tuần
  const [confirmDeleteReport, setConfirmDeleteReport] =
    useState<WeeklyReportDoc | null>(null);
  const [deletingReportKey, setDeletingReportKey] = useState<string | null>(
    null,
  );

  // Thêm useEffect để lắng nghe collection 'criteria'
  useEffect(() => {
    const q = query(collection(db, "criteria"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CriteriaItem[];
      setCriteriaList(data);
      setCriteriaLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Modal báo cáo
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<
    | "week"
    | "month"
    | "year"
    | "mid_term_1"
    | "end_term_1"
    | "mid_term_2"
    | "end_term_2"
    | "year_summary"
  >("week");
  const [reportWeekKey, setReportWeekKey] = useState("");
  const [reportMonthValue, setReportMonthValue] = useState("");
  const [reportYearValue, setReportYearValue] = useState("");

  const archivedOnceRef = useRef(false);

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
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ActivityLogItem[];
      setActivityLogs(data);
      setLogsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "weeklyReports"),
      orderBy("weekKey", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(
        (docSnap) => docSnap.data() as WeeklyReportDoc,
      );
      setWeeklyReports(data);
      setReportsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const computeWeeklyScores = (
    monday: Date,
    sunday: Date,
  ): WeeklyStudentRow[] => {
    const deltaMap: Record<string, number> = {};
    activityLogs.forEach((log) => {
      if (!log.createdAt || typeof log.createdAt.toDate !== "function") return;
      const d = log.createdAt.toDate();
      if (d < monday || d > sunday) return;
      deltaMap[log.name] = (deltaMap[log.name] || 0) + (log.delta || 0);
    });

    const list = students.map((s) => {
      const delta = deltaMap[s.name] || 0;
      return {
        id: s.id,
        name: s.name,
        group: normalizeGroupName(s.group),
        delta,
        weeklyScore: WEEKLY_BASE_POINTS + delta,
        avatarUrl: s.avatarUrl,
      };
    });

    list.sort((a, b) => b.weeklyScore - a.weeklyScore);
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  };

  const saveWeeklyReport = async (monday: Date) => {
    const sunday = getSunday(monday);
    const weekKey = formatDateKey(monday);
    const scored = computeWeeklyScores(monday, sunday);
    try {
      await setDoc(doc(db, "weeklyReports", weekKey), {
        weekKey,
        weekStart: monday.toISOString(),
        weekEnd: sunday.toISOString(),
        savedAt: serverTimestamp(),
        students: scored,
      });
      return true;
    } catch (error) {
      console.error("Lỗi khi lưu báo cáo tuần:", error);
      return false;
    }
  };

  useEffect(() => {
    if (!studentsLoaded || !logsLoaded || !reportsLoaded) return;
    if (archivedOnceRef.current) return;
    archivedOnceRef.current = true;

    const logDates = activityLogs
      .map((l) =>
        l.createdAt && typeof l.createdAt.toDate === "function"
          ? l.createdAt.toDate()
          : null,
      )
      .filter((d): d is Date => d !== null);

    if (logDates.length === 0) return;

    const currentMonday = getMonday(new Date());
    const earliestMonday = getMonday(
      new Date(Math.min(...logDates.map((d) => d.getTime()))),
    );
    const existingKeys = new Set(weeklyReports.map((r) => r.weekKey));

    const mondaysToArchive: Date[] = [];
    let cursor = new Date(earliestMonday);
    while (cursor < currentMonday) {
      const key = formatDateKey(cursor);
      if (!existingKeys.has(key)) mondaysToArchive.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }

    if (mondaysToArchive.length === 0) return;

    (async () => {
      for (const monday of mondaysToArchive) {
        await saveWeeklyReport(monday);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsLoaded, logsLoaded, reportsLoaded]);

  const selectedSunday = useMemo(
    () => getSunday(selectedMonday),
    [selectedMonday],
  );
  const selectedKey = formatDateKey(selectedMonday);
  const currentMondayKey = formatDateKey(getMonday(new Date()));
  const isCurrentWeek = selectedKey === currentMondayKey;

  const savedReport = useMemo(
    () => weeklyReports.find((r) => r.weekKey === selectedKey) || null,
    [weeklyReports, selectedKey],
  );

  const liveScored = useMemo(
    () => computeWeeklyScores(selectedMonday, selectedSunday),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedMonday, selectedSunday, students, activityLogs],
  );

  const weekRows: WeeklyStudentRow[] = isCurrentWeek
    ? liveScored
    : savedReport
      ? savedReport.students
      : liveScored;

  const filteredWeekRows = weekRows.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const weekPodium = weekRows.slice(0, 3);
  const weekOrder = [1, 0, 2];

  const handlePrevWeek = () => setSelectedMonday((d) => addDays(d, -7));
  const handleNextWeek = () =>
    setSelectedMonday((d) => {
      const next = addDays(d, 7);
      const currentMonday = getMonday(new Date());
      return next > currentMonday ? currentMonday : next;
    });
  const handleThisWeek = () => setSelectedMonday(getMonday(new Date()));

  const handleManualSave = async () => {
    setSaving(true);
    const ok = await saveWeeklyReport(selectedMonday);
    setSaving(false);
    if (ok) {
      toast.success(
        `Đã lưu báo cáo tuần ${formatShort(selectedMonday)} - ${formatShortWithYear(selectedSunday)}!`,
      );
    } else {
      toast.error("Không thể lưu báo cáo tuần này.");
    }
  };

  // Xóa báo cáo tuần (được gọi từ popup xác nhận)
  const handleConfirmDeleteReport = async () => {
    if (!confirmDeleteReport) return;
    setDeletingReportKey(confirmDeleteReport.weekKey);
    try {
      await deleteDoc(doc(db, "weeklyReports", confirmDeleteReport.weekKey));
      toast.success("Đã xóa báo cáo tuần thành công!");
    } catch (error) {
      console.error("Lỗi khi xóa báo cáo:", error);
      toast.error("Không thể xóa báo cáo này.");
    } finally {
      setDeletingReportKey(null);
      setConfirmDeleteReport(null);
    }
  };

  const currentWeekLive = useMemo(
    () =>
      computeWeeklyScores(
        getMonday(new Date()),
        getSunday(getMonday(new Date())),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, activityLogs],
  );

  const combinedWeeks: WeeklyReportDoc[] = useMemo(() => {
    const hasCurrent = weeklyReports.some(
      (r) => r.weekKey === currentMondayKey,
    );
    const list = [...weeklyReports];
    if (!hasCurrent) {
      const cMonday = getMonday(new Date());
      const cSunday = getSunday(cMonday);
      list.push({
        weekKey: currentMondayKey,
        weekStart: cMonday.toISOString(),
        weekEnd: cSunday.toISOString(),
        students: currentWeekLive,
      });
    }
    return list.sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
  }, [weeklyReports, currentMondayKey, currentWeekLive]);

  const availableMonths = useMemo(() => {
    const set = new Set(combinedWeeks.map((w) => monthKeyOf(w.weekStart)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [combinedWeeks]);

  const availableYears = useMemo(() => {
    const set = new Set(
      combinedWeeks.map((w) => String(new Date(w.weekStart).getFullYear())),
    );
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [combinedWeeks]);

  const weekReportData = useMemo(
    () => combinedWeeks.find((w) => w.weekKey === reportWeekKey) || null,
    [combinedWeeks, reportWeekKey],
  );

  const monthAggregated = useMemo(
    () =>
      aggregateWeeks(
        combinedWeeks.filter(
          (w) => monthKeyOf(w.weekStart) === reportMonthValue,
        ),
      ),
    [combinedWeeks, reportMonthValue],
  );

  const handleOpenReportModal = () => {
    setReportPeriod("week");
    setReportWeekKey(combinedWeeks[0]?.weekKey || currentMondayKey);
    setReportMonthValue(
      availableMonths[0] || monthKeyOf(getMonday(new Date()).toISOString()),
    );
    setReportYearValue(
      availableYears[0] || String(getMonday(new Date()).getFullYear()),
    );
    setReportModalOpen(true);
  };

  const isTermPeriod = [
    "mid_term_1",
    "end_term_1",
    "mid_term_2",
    "end_term_2",
    "year_summary",
  ].includes(reportPeriod);

  const termWeekRanges = useMemo(() => {
    if (!isTermPeriod) return [] as Date[];
    const firstWeekMonday = new Date(2026, 8, 7);
    const sortedMondays: Date[] = [];
    for (let i = 0; i < 36; i++) {
      const nextMonday = new Date(firstWeekMonday);
      nextMonday.setDate(firstWeekMonday.getDate() + i * 7);
      sortedMondays.push(nextMonday);
    }
    let startWeekIdx = 0;
    let endWeekIdx = 36;
    if (reportPeriod === "mid_term_1") {
      startWeekIdx = 0;
      endWeekIdx = 9;
    } else if (reportPeriod === "end_term_1") {
      startWeekIdx = 9;
      endWeekIdx = 18;
    } else if (reportPeriod === "mid_term_2") {
      startWeekIdx = 18;
      endWeekIdx = 27;
    } else if (reportPeriod === "end_term_2") {
      startWeekIdx = 27;
      endWeekIdx = 36;
    }
    return sortedMondays.slice(
      startWeekIdx,
      reportPeriod === "year_summary" ? sortedMondays.length : endWeekIdx,
    );
  }, [isTermPeriod, reportPeriod]);

  const termPreviewRows = useMemo<PreviewRow[]>(() => {
    if (!isTermPeriod || termWeekRanges.length === 0) return [];
    const start = termWeekRanges[0];
    const end = new Date(termWeekRanges[termWeekRanges.length - 1]);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const rows = students.map((s) => {
      const logs = activityLogs.filter((l) => {
        if (l.name !== s.name) return false;
        if (!l.createdAt || typeof l.createdAt.toDate !== "function")
          return false;
        const d = l.createdAt.toDate();
        return d >= start && d <= end;
      });
      const delta = logs.reduce((sum, cur) => sum + (cur.delta || 0), 0);
      return {
        name: s.name,
        group: normalizeGroupName(s.group),
        delta,
        total: 100 + delta,
      };
    });
    rows.sort((a, b) => b.total - a.total);
    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [isTermPeriod, termWeekRanges, students, activityLogs]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (reportPeriod === "week") {
      if (!weekReportData) return [];
      return [...weekReportData.students]
        .sort((a, b) => b.weeklyScore - a.weeklyScore)
        .map((s, idx) => ({
          rank: idx + 1,
          name: s.name,
          group: s.group,
          delta: s.delta,
          total: s.weeklyScore,
        }));
    }
    if (reportPeriod === "month") {
      return monthAggregated.map((s) => ({
        rank: s.rank,
        name: s.name,
        group: s.group,
        delta: s.totalDelta,
        total: 100 + s.totalDelta,
      }));
    }
    return termPreviewRows;
  }, [reportPeriod, weekReportData, monthAggregated, termPreviewRows]);

  const previewDeltaLabel =
    reportPeriod === "week"
      ? "Cộng/trừ tuần"
      : reportPeriod === "month"
        ? "Cộng/trừ tháng"
        : "Cộng/trừ kỳ";
  const previewTotalLabel =
    reportPeriod === "week"
      ? "Điểm tuần"
      : reportPeriod === "month"
        ? "Điểm tháng"
        : "Điểm kỳ";

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      if (reportPeriod === "week") {
        const monday = selectedMonday;
        const days = getDaysOfWeek(monday);
        const sunday = getSunday(monday);

        const logsInWeek = activityLogs.filter((log) => {
          if (!log.createdAt || typeof log.createdAt.toDate !== "function")
            return false;
          const d = log.createdAt.toDate();
          return d >= monday && d <= sunday;
        });

        const weeklyDataRows = students.map((s, idx) => {
          const studentLogs = logsInWeek.filter((l) => l.name === s.name);
          const row: Record<string, string | number> = {
            STT: idx + 1,
            "Danh sách": s.name,
          };

          days.forEach((day, dIdx) => {
            const dayStr = formatDateKey(day);
            const dayLogs = studentLogs.filter((l) => {
              const ld = l.createdAt?.toDate();
              return ld ? formatDateKey(ld) === dayStr : false;
            });

            const dayDelta = dayLogs.reduce(
              (acc, curr) => acc + (curr.delta || 0),
              0,
            );
            const dayLabels = dayLogs
              .map(
                (l) => `${l.label} (${l.delta > 0 ? "+" + l.delta : l.delta})`,
              )
              .join(", ");

            row[`Thứ ${dIdx + 2}`] =
              dayDelta !== 0 ? (dayDelta > 0 ? `+${dayDelta}` : dayDelta) : "";
            if (dIdx === 5) {
              row["Ghi chú (điểm cộng, điểm trừ trong ngày)"] = dayLabels;
            }
          });

          const currentWeekScored = computeWeeklyScores(monday, sunday);
          const found = currentWeekScored.find((item) => item.name === s.name);
          row["Tổng điểm tuần"] = found ? found.weeklyScore : 100;

          return row;
        });

        const headerInfo = [
          ["TRƯỜNG .................................."],
          [`LỚP .........................`],
          ["BẢNG THEO DÕI NỀ NẾP TUẦN"],
          [
            `(Từ ngày ${formatShortWithYear(monday)} đến ngày ${formatShortWithYear(sunday)})`,
          ],
          [],
        ];

        const ws = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: "A1" });
        XLSX.utils.sheet_add_json(ws, weeklyDataRows, { origin: "A6" });

        XLSX.utils.book_append_sheet(wb, ws, "BangTheoDoiTuan");
        XLSX.writeFile(wb, `Bang_Theo_Doi_Tuan_${formatDateKey(monday)}.xlsx`);
      } else if (
        [
          "mid_term_1",
          "end_term_1",
          "mid_term_2",
          "end_term_2",
          "year_summary",
        ].includes(reportPeriod)
      ) {
        let startWeekIdx = 0;
        let endWeekIdx = 36;
        let titleReport = "BẢNG TỔNG HỢP NỀ NẾP CẢ NĂM";

        if (reportPeriod === "mid_term_1") {
          startWeekIdx = 0;
          endWeekIdx = 9;
          titleReport = "BẢNG TỔNG HỢP NỀ NẾP - GIỮA HỌC KỲ 1 (9 Tuần đầu)";
        } else if (reportPeriod === "end_term_1") {
          startWeekIdx = 9;
          endWeekIdx = 18;
          titleReport =
            "BẢNG TỔNG HỢP NỀ NẾP - CUỐI HỌC KỲ 1 (9 Tuần tiếp theo)";
        } else if (reportPeriod === "mid_term_2") {
          startWeekIdx = 18;
          endWeekIdx = 27;
          titleReport =
            "BẢNG TỔNG HỢP NỀ NẾP - GIỮA HỌC KỲ 2 (9 Tuần tiếp theo)";
        } else if (reportPeriod === "end_term_2") {
          startWeekIdx = 27;
          endWeekIdx = 36;
          titleReport = "BẢNG TỔNG HỢP NỀ NẾP - CUỐI HỌC KỲ 2 (9 Tuần cuối)";
        }

        const firstWeekMonday = new Date(2026, 8, 7);

        const sortedMondays: Date[] = [];
        for (let i = 0; i < 36; i++) {
          const nextMonday = new Date(firstWeekMonday);
          nextMonday.setDate(firstWeekMonday.getDate() + i * 7);
          sortedMondays.push(nextMonday);
        }

        const allLogs = activityLogs.filter((l) => {
          if (!l.createdAt || typeof l.createdAt?.toDate !== "function")
            return false;
          return true;
        });

        const targetMondays = sortedMondays.slice(
          startWeekIdx,
          reportPeriod === "year_summary" ? sortedMondays.length : endWeekIdx,
        );

        const periodDataRows = students.map((s, idx) => {
          const rowData: Record<string, string | number> = {
            STT: idx + 1,
            "Danh sách": s.name,
          };

          targetMondays.forEach((monday, wIdx) => {
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const weekLogs = allLogs.filter((l) => {
              if (l.name !== s.name) return false;
              const d = l.createdAt?.toDate ? l.createdAt.toDate() : null;
              if (!d) return false;
              return d >= monday && d <= sunday;
            });

            const weekDelta = weekLogs.reduce(
              (sum, curr) => sum + (curr.delta || 0),
              0,
            );
            const weekScore = 100 + weekDelta;

            const actualWeekNum = startWeekIdx + wIdx + 1;
            rowData[`Tuần ${actualWeekNum}`] = weekScore;
          });

          return rowData;
        });

        const headerInfo = [
          ["TRƯỜNG .................................."],
          [`LỚP .........................`],
          [titleReport],
          [`Năm học: 2026 - 2027`],
          [],
        ];

        const ws = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: "A1" });
        XLSX.utils.sheet_add_json(ws, periodDataRows, { origin: "A6" });

        XLSX.utils.book_append_sheet(wb, ws, "TongHopKy");
        XLSX.writeFile(wb, `Bao_Cao_${reportPeriod}_2026.xlsx`);
      } else {
        const aggregatedRows = monthAggregated;

        const periodLogs = activityLogs.filter((l) => {
          if (!l.createdAt || typeof l.createdAt.toDate !== "function")
            return false;
          const d = l.createdAt.toDate();
          return monthKeyOf(d.toISOString()) === reportMonthValue;
        });

        const cleanTitle = (str: string) => {
          if (!str) return "";
          return str
            .replace(/[⭐🌟✨👑🏆🎁]/g, "")
            .trim()
            .toLowerCase();
        };

        const isPrivilegeLabel = (str: string) => {
          const lower = str.toLowerCase();
          return (
            lower.includes("đặc quyền") ||
            lower.includes("trúng") ||
            lower.includes("nhận đặc quyền")
          );
        };

        const plusCriteria: string[] = [];
        const minusCriteria: string[] = [];
        const seenCleanTitles = new Set<string>();

        criteriaList.forEach((c) => {
          if (c?.title && typeof c.title === "string") {
            const titleStr = c.title.trim();
            if (!isPrivilegeLabel(titleStr)) {
              const cleaned = cleanTitle(titleStr);
              if (cleaned && !seenCleanTitles.has(cleaned)) {
                seenCleanTitles.add(cleaned);
                if (c.type === "minus") {
                  minusCriteria.push(titleStr);
                } else {
                  plusCriteria.push(titleStr);
                }
              }
            }
          }
        });

        periodLogs.forEach((l) => {
          if (l?.label && typeof l.label === "string") {
            const labelStr = l.label.trim();
            if (!isPrivilegeLabel(labelStr)) {
              const cleaned = cleanTitle(labelStr);
              if (cleaned && !seenCleanTitles.has(cleaned)) {
                seenCleanTitles.add(cleaned);
                if ((l.delta || 0) < 0) {
                  minusCriteria.push(labelStr);
                } else {
                  plusCriteria.push(labelStr);
                }
              }
            }
          }
        });

        const monthDataRows = students.map((s, idx) => {
          const studentLogs = periodLogs.filter((l) => {
            if (l.name !== s.name) return false;
            const label = l?.label || "";
            return !isPrivilegeLabel(label);
          });

          const rowData: Record<string, string | number> = {
            STT: idx + 1,
            "Họ và tên": s.name,
          };

          plusCriteria.forEach((title) => {
            const matchedLogs = studentLogs.filter(
              (l) => cleanTitle(l?.label || "") === cleanTitle(title),
            );
            const totalScore = matchedLogs.reduce(
              (sum, curr) => sum + (curr.delta || 0),
              0,
            );
            rowData[title] =
              totalScore !== 0
                ? totalScore > 0
                  ? `+${totalScore}`
                  : totalScore
                : "";
          });

          minusCriteria.forEach((title) => {
            const matchedLogs = studentLogs.filter(
              (l) => cleanTitle(l?.label || "") === cleanTitle(title),
            );
            const totalScore = matchedLogs.reduce(
              (sum, curr) => sum + (curr.delta || 0),
              0,
            );
            rowData[title] = totalScore !== 0 ? totalScore : "";
          });

          const foundAgg = aggregatedRows.find((item) => item.name === s.name);
          const totalDelta = foundAgg ? foundAgg.totalDelta : 0;
          const tongDiem = 100 + totalDelta;

          rowData["Cộng trừ điểm"] =
            totalDelta > 0 ? `+${totalDelta}` : totalDelta;
          rowData["Tổng"] = tongDiem;
          rowData["Tốt"] = tongDiem >= 100 ? "X" : "";
          rowData["Kém"] = tongDiem < 80 ? "X" : "";

          return rowData;
        });

        const headerInfo = [
          ["THEO DÕI CỦA LỚP TRƯỞNG - BÁO CÁO THÁNG"],
          [`Thời gian: ${reportMonthValue}`],
          [],
        ];

        const ws = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: "A1" });
        XLSX.utils.sheet_add_json(ws, monthDataRows, { origin: "A4" });

        XLSX.utils.book_append_sheet(wb, ws, "BaoCaoThang");
        XLSX.writeFile(wb, `Bao_Cao_Nen_Nep_Thang_${reportMonthValue}.xlsx`);
      }

      toast.success("Xuất file Excel thành công!");
      setReportModalOpen(false);
    } catch (error) {
      console.error("Lỗi xuất Excel:", error);
      toast.error("Không thể xuất file Excel.");
    }
  };

  const ranked = [...students].sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const filteredRanked = ranked.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalPodium = ranked.slice(0, 3);

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <span className="text-amber-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-podium"
            >
              <path d="M12 6V2h-1" />
              <path d="M9 15a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1" />
              <path d="M9 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10" />
            </svg>
          </span>
          Bảng vàng
        </h2>

        {/* Chuyển tab: Theo tuần / Tích lũy toàn thời gian + nút xem/xuất báo cáo */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Thanh chuyển tab với hiệu ứng trượt mượt mà và chữ căn giữa tuyệt đối */}
          <div className="relative flex bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200/65 w-85">
            {/* Lớp nền trượt (Slider background) */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-2xs transition-all duration-300 ease-in-out ${
                activeTab === "week" ? "left-1" : "left-[calc(50%+2px)]"
              }`}
            />

            <button
              type="button"
              onClick={() => setActiveTab("week")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer text-center ${
                activeTab === "week"
                  ? "text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Theo tuần (100đ)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("total")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer text-center ${
                activeTab === "total"
                  ? "text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Tích lũy toàn thời gian
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenReportModal}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all duration-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
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
              className="lucide lucide-download"
            >
              <path d="M12 15V3" />
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
            </svg>{" "}
            Xuất Excel báo cáo
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          Chưa có dữ liệu học sinh.
        </p>
      ) : activeTab === "week" ? (
        <>
          {/* Thanh điều hướng tuần */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/40 rounded-3xl p-4 border border-amber-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Tuần trước"
              >
                ‹
              </button>
              <div className="text-center px-1">
                <p className="text-xs font-extrabold text-slate-800 m-0">
                  Tuần {formatShort(selectedMonday).replace(/-/g, "/")} –{" "}
                  {formatShortWithYear(selectedSunday)}
                </p>
                <p className="text-[10px] text-slate-500 m-0 mt-0.5">
                  {isCurrentWeek ? (
                    <span className="text-emerald-600 font-bold">
                      ● Tuần hiện tại (đang cộng dồn)
                    </span>
                  ) : savedReport ? (
                    <span className="text-sky-600 font-bold">
                      ✅ Đã lưu báo cáo
                    </span>
                  ) : (
                    <span className="text-slate-400 font-bold">
                      Chưa có báo cáo lưu — đang tính tạm thời
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextWeek}
                disabled={isCurrentWeek}
                className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Tuần sau"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={handleThisWeek}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs cursor-pointer"
                >
                  Về tuần này
                </button>
              )}
              <button
                type="button"
                onClick={handleManualSave}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving
                  ? "Đang lưu..."
                  : savedReport
                    ? "Lưu lại báo cáo"
                    : "Lưu báo cáo tuần này"}
              </button>
            </div>
          </div>

          {/* Bục xếp hạng tuần */}
          <div className="flex items-end justify-center gap-6 flex-wrap py-4">
            {weekOrder.map((i) => {
              const s = weekPodium[i];
              if (!s) return <div key={i} className="w-32" />;
              const rank = i + 1;
              const avatarBg =
                rank === 1
                  ? "bg-linear-to-br from-amber-400 to-orange-500 w-20 h-20 text-2xl"
                  : "bg-linear-to-br from-amber-300 to-amber-400 w-16 h-16 text-lg";
              const boxBg =
                rank === 1
                  ? "bg-linear-to-b from-amber-200 to-amber-300 h-32"
                  : rank === 2
                    ? "bg-linear-to-b from-violet-100 to-slate-50 h-24"
                    : "bg-linear-to-b from-rose-100 to-slate-50 h-24";
              return (
                <div key={s.id} className="flex flex-col items-center w-32">
                  <div className="h-8 flex items-center justify-center mb-1">
                    {rank === 1 ? (
                      <span className="text-2xl">👑</span>
                    ) : (
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold ${
                          rank === 2 ? "bg-slate-400" : "bg-amber-700"
                        }`}
                      >
                        {rank}
                      </span>
                    )}
                  </div>
                  <div
                    className={`relative rounded-full overflow-hidden flex items-center justify-center font-extrabold text-white border-4 border-white shadow-lg mb-2 ${avatarBg}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {lastInitial(s.name)}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        s.avatarUrl ? s.avatarUrl : avatarFallbackUrl(s.name)
                      }
                      alt={s.name}
                      className="relative w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          avatarFallbackUrl(s.name);
                      }}
                    />
                  </div>
                  <p className="text-xs font-extrabold text-slate-800 text-center m-0 mb-1">
                    {s.name}
                  </p>
                  <p className="text-[10px] font-bold m-0 mb-2">
                    <span
                      className={
                        s.delta > 0
                          ? "text-emerald-600"
                          : s.delta < 0
                            ? "text-rose-600"
                            : "text-slate-400"
                      }
                    >
                      {s.delta > 0 ? `+${s.delta}` : s.delta} điểm tuần
                    </span>
                  </p>
                  <div
                    className={`w-full rounded-3xl border border-amber-100/60 flex items-center justify-center font-extrabold text-slate-800 text-sm ${boxBg}`}
                  >
                    {s.weeklyScore} đ
                  </div>
                </div>
              );
            })}
          </div>

          {/* Danh sách đầy đủ theo tuần */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-800 m-0">
                Toàn bộ điểm tuần này
              </h3>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors placeholder:text-slate-400"
                  placeholder="Tìm kiếm học sinh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredWeekRows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Không tìm thấy học sinh phù hợp.
                </p>
              ) : (
                filteredWeekRows.map((s) => {
                  const tag = GROUP_TAG_STYLE[s.group] || {
                    bg: "#EEE",
                    fg: "#666",
                  };
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-all"
                    >
                      <span className="w-8 text-xs font-extrabold text-slate-700">
                        #{s.rank}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">
                        {s.name}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: tag.bg, color: tag.fg }}
                      >
                        {s.group}
                      </span>
                      <span
                        className={`text-[11px] font-bold w-14 text-right ${
                          s.delta > 0
                            ? "text-emerald-600"
                            : s.delta < 0
                              ? "text-rose-600"
                              : "text-slate-400"
                        }`}
                      >
                        {s.delta > 0 ? `+${s.delta}` : s.delta}
                      </span>
                      <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full w-16 text-center">
                        {s.weeklyScore} đ
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Lịch sử báo cáo tuần đã lưu */}
          {weeklyReports.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-800 m-0">
                Lịch sử báo cáo đã lưu ({weeklyReports.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {weeklyReports.map((r) => {
                  const monday = new Date(r.weekStart);
                  const sunday = new Date(r.weekEnd);
                  const isSel = r.weekKey === selectedKey;
                  return (
                    <div
                      key={r.weekKey}
                      className={`inline-flex items-center rounded-xl text-[11px] font-bold border transition-all ${
                        isSel
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      {/* Nút chọn tuần để xem */}
                      <button
                        type="button"
                        onClick={() => setSelectedMonday(getMonday(monday))}
                        className="px-3 py-1.5 cursor-pointer focus:outline-none"
                      >
                        {formatShort(monday).replace(/-/g, "/")} -{" "}
                        {formatShortWithYear(sunday)}
                      </button>

                      {/* Nút xóa báo cáo tuần */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Ngăn sự kiện click nhầm sang chọn tuần
                          setConfirmDeleteReport(r);
                        }}
                        title="Xóa báo cáo này"
                        className={`pr-2.5 py-1.5 pl-1 rounded-r-xl hover:bg-black/10 transition-colors cursor-pointer flex items-center ${
                          isSel
                            ? "text-white"
                            : "text-slate-400 hover:text-rose-600"
                        }`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Bục xếp hạng tích lũy (giữ nguyên như trước) */}
          <div className="flex items-end justify-center gap-6 flex-wrap py-4">
            {weekOrder.map((i) => {
              const s = totalPodium[i];
              if (!s) return <div key={i} className="w-32" />;
              const rank = i + 1;
              const avatarBg =
                rank === 1
                  ? "bg-linear-to-br from-amber-400 to-orange-500 w-20 h-20 text-2xl"
                  : "bg-linear-to-br from-amber-300 to-amber-400 w-16 h-16 text-lg";
              const boxBg =
                rank === 1
                  ? "bg-linear-to-b from-amber-200 to-amber-300 h-32"
                  : rank === 2
                    ? "bg-linear-to-b from-violet-100 to-slate-50 h-24"
                    : "bg-linear-to-b from-rose-100 to-slate-50 h-24";
              return (
                <div key={s.id} className="flex flex-col items-center w-32">
                  <div className="h-8 flex items-center justify-center mb-1">
                    {rank === 1 ? (
                      <span className="text-2xl">👑</span>
                    ) : (
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold ${
                          rank === 2 ? "bg-slate-400" : "bg-amber-700"
                        }`}
                      >
                        {rank}
                      </span>
                    )}
                  </div>
                  <div
                    className={`relative rounded-full overflow-hidden flex items-center justify-center font-extrabold text-white border-4 border-white shadow-lg mb-2 ${avatarBg}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {lastInitial(s.name)}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        s.avatarUrl ? s.avatarUrl : avatarFallbackUrl(s.name)
                      }
                      alt={s.name}
                      className="relative w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          avatarFallbackUrl(s.name);
                      }}
                    />
                  </div>
                  <p className="text-xs font-extrabold text-slate-800 text-center m-0 mb-2">
                    {s.name}
                  </p>
                  <div
                    className={`w-full rounded-3xl border border-amber-100/60 flex items-center justify-center font-extrabold text-slate-800 text-sm ${boxBg}`}
                  >
                    ⭐ {s.stars || 0}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-800 m-0">
                Toàn bộ bảng xếp hạng
              </h3>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors placeholder:text-slate-400"
                  placeholder="Tìm kiếm học sinh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredRanked.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Không tìm thấy học sinh phù hợp.
                </p>
              ) : (
                filteredRanked.map((s) => {
                  const originalIndex = ranked.findIndex(
                    (item) => item.id === s.id,
                  );
                  const tag = GROUP_TAG_STYLE[s.group] || {
                    bg: "#EEE",
                    fg: "#666",
                  };
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-all"
                    >
                      <span className="w-8 text-xs font-extrabold text-slate-700">
                        #{originalIndex + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">
                        {s.name}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: tag.bg, color: tag.fg }}
                      >
                        {s.group}
                      </span>
                      <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full w-16 text-center">
                        ⭐ {s.stars || 0}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= MODAL XEM & XUẤT BÁO CÁO (đồng bộ giao diện với modal Điểm danh) ================= */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">
                Xem &amp; xuất báo cáo thi đua
              </h3>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">
                  Loại báo cáo:
                </span>
                <select
                  value={reportPeriod}
                  onChange={(e) =>
                    setReportPeriod(
                      e.target.value as
                        | "week"
                        | "month"
                        | "mid_term_1"
                        | "end_term_1"
                        | "mid_term_2"
                        | "end_term_2"
                        | "year_summary",
                    )
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="week">Theo tuần</option>
                  <option value="month">Theo tháng</option>
                  <option value="mid_term_1">Giữa HK1 (9 tuần)</option>
                  <option value="end_term_1">Cuối HK1 (9 tuần)</option>
                  <option value="mid_term_2">Giữa HK2 (9 tuần)</option>
                  <option value="end_term_2">Cuối HK2 (9 tuần)</option>
                  <option value="year_summary">Tổng kết năm</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">
                  Thời gian:
                </span>

                {reportPeriod === "week" && (
                  <select
                    value={reportWeekKey}
                    onChange={(e) => setReportWeekKey(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    {combinedWeeks.map((w) => (
                      <option key={w.weekKey} value={w.weekKey}>
                        Tuần từ {formatShort(new Date(w.weekStart))} đến{" "}
                        {formatShortWithYear(new Date(w.weekEnd))}
                      </option>
                    ))}
                  </select>
                )}

                {reportPeriod === "month" && (
                  <select
                    value={reportMonthValue}
                    onChange={(e) => setReportMonthValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                    {availableMonths.length === 0 && (
                      <option value="">Chưa có dữ liệu tháng</option>
                    )}
                  </select>
                )}

                {isTermPeriod && (
                  <select
                    value={reportYearValue}
                    onChange={(e) => setReportYearValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        Năm học / Năm {y}
                      </option>
                    ))}
                    {availableYears.length === 0 && (
                      <option value="">Chưa có dữ liệu năm</option>
                    )}
                  </select>
                )}
              </div>
            </div>

            {/* Bảng xem trước dữ liệu — cùng phong cách với modal Điểm danh */}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
              {previewRows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Không có dữ liệu thi đua trong khoảng thời gian này.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 font-bold w-12 text-center">Hạng</th>
                      <th className="p-2.5 font-bold">Họ và tên</th>
                      <th className="p-2.5 font-bold w-20">Tổ</th>
                      <th className="p-2.5 font-bold w-28 text-center">
                        {previewDeltaLabel}
                      </th>
                      <th className="p-2.5 font-bold w-24 text-center">
                        {previewTotalLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((r) => (
                      <tr key={r.name} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center text-slate-500">
                          {r.rank}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">
                          {r.name}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {r.group || "-"}
                        </td>
                        <td
                          className={`p-2.5 text-center font-bold ${
                            r.delta > 0
                              ? "text-emerald-600"
                              : r.delta < 0
                                ? "text-rose-600"
                                : "text-slate-400"
                          }`}
                        >
                          {r.delta > 0 ? `+${r.delta}` : r.delta}
                        </td>
                        <td className="p-2.5 text-center font-bold text-amber-700">
                          {r.total} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={previewRows.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
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
                  className="lucide lucide-download"
                >
                  <path d="M12 15V3" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                </svg>{" "}
                Tải file Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA BÁO CÁO TUẦN */}
      {confirmDeleteReport && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa báo cáo tuần này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa báo cáo tuần{" "}
                <strong className="text-slate-800">
                  {formatShort(new Date(confirmDeleteReport.weekStart)).replace(
                    /-/g,
                    "/",
                  )}{" "}
                  - {formatShortWithYear(new Date(confirmDeleteReport.weekEnd))}
                </strong>{" "}
                không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteReport(null)}
                disabled={deletingReportKey === confirmDeleteReport.weekKey}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReport}
                disabled={deletingReportKey === confirmDeleteReport.weekKey}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingReportKey === confirmDeleteReport.weekKey
                  ? "Đang xóa..."
                  : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
