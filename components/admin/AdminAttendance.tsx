"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  where,
  setDoc,
} from "firebase/firestore";

interface StudentItem {
  id: string;
  name: string;
  group: string;
  status?: "present" | "excused" | "absent" | "late";
  attendanceDate?: string;
  avatarUrl?: string;
}

interface AttendanceRecord {
  id?: string;
  studentId: string;
  name: string;
  group: string;
  status: "present" | "excused" | "absent" | "late";
  date: string;
  month: string;
  year: string;
}

interface AggregatedReportItem {
  name: string;
  group: string;
  present: number;
  excused: number;
  absent: number;
  late: number;
}

const STATUS_META: Record<
  string,
  { label: string; active: string; icon: string }
> = {
  present: {
    label: "Có mặt",
    active: "bg-emerald-500 text-white border-emerald-500",
    icon: "✅",
  },
  excused: {
    label: "Có phép",
    active: "bg-sky-500 text-white border-sky-500",
    icon: "🟡",
  },
  absent: {
    label: "Vắng",
    active: "bg-rose-500 text-white border-rose-500",
    icon: "🔴",
  },
  late: {
    label: "Đi muộn",
    active: "bg-amber-500 text-white border-amber-500",
    icon: "🕒",
  },
};

const GROUP_STYLES: Record<
  string,
  { badgeBg: string; badgeText: string; badgeBorder: string }
> = {
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
  "Tổ 4": {
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-100",
  },
};

const normalizeGroupName = (groupName?: string) => {
  if (!groupName) return "";
  const match = groupName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 4) return `Tổ ${num}`;
  }
  return groupName.trim();
};

const getTodayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekKey = (date = new Date()) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const getWeekDates = (weekStr: string) => {
  const [yearStr, weekStrNum] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStrNum, 10);

  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }

  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return { start: formatDate(ISOweekStart), end: formatDate(ISOweekEnd) };
};

export default function AdminAttendance() {
  const toast = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  const [reportType, setReportType] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("daily");
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey());

  const [dailyReportData, setDailyReportData] = useState<AttendanceRecord[]>(
    [],
  );
  const [aggregatedReportData, setAggregatedReportData] = useState<
    AggregatedReportItem[]
  >([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const todayKey = getTodayKey();

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const today = getTodayKey();
      const batch = writeBatch(db);
      let needCommit = false;

      const data = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data();
        const studentId = docSnap.id;

        if (docData.attendanceDate !== today) {
          needCommit = true;
          batch.update(doc(db, "students", studentId), {
            status: "present",
            attendanceDate: today,
          });

          const recordId = `${studentId}_${today}`;
          batch.set(
            doc(db, "attendanceRecords", recordId),
            {
              studentId: studentId,
              name: docData.name || "",
              group: docData.group || "",
              status: "present",
              date: today,
              month: today.slice(0, 7),
              year: today.slice(0, 4),
            },
            { merge: true },
          );

          return {
            id: studentId,
            status: "present",
            attendanceDate: today,
            ...docData,
          } as StudentItem;
        }

        return {
          id: studentId,
          status: docData.status || "present",
          ...docData,
        } as StudentItem;
      });

      setStudents(data);

      if (needCommit) {
        try {
          await batch.commit();
        } catch (err) {
          console.error("Lỗi tự động reset điểm danh ngày mới:", err);
          toast.error("Không thể tự động khởi tạo điểm danh ngày mới.");
        }
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { present: 0, excused: 0, absent: 0, late: 0 };
    students.forEach((s) => {
      if (s.status && s.status in c) c[s.status as keyof typeof c]++;
    });
    return c;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );
  }, [students, searchTerm]);

  const handleSetStatus = async (id: string, status: string) => {
    try {
      const studentObj = students.find((s) => s.id === id);
      const studentName = studentObj ? studentObj.name : "";
      const studentGroup = studentObj ? studentObj.group : "";

      await updateDoc(doc(db, "students", id), {
        status,
        attendanceDate: todayKey,
      });

      const recordId = `${id}_${todayKey}`;
      await setDoc(
        doc(db, "attendanceRecords", recordId),
        {
          studentId: id,
          name: studentName,
          group: studentGroup,
          status,
          date: todayKey,
          month: todayKey.slice(0, 7),
          year: todayKey.slice(0, 4),
        },
        { merge: true },
      );

      toast.success(
        `Đã điểm danh "${studentName}": ${STATUS_META[status]?.label || status}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Không thể cập nhật điểm danh");
    }
  };

  const processAggregatedData = useCallback(
    (docsData: AttendanceRecord[]) => {
      const aggregatedMap: Record<string, AggregatedReportItem> = {};
      students.forEach((s) => {
        aggregatedMap[s.id] = {
          name: s.name,
          group: s.group,
          present: 0,
          excused: 0,
          absent: 0,
          late: 0,
        };
      });

      docsData.forEach((item) => {
        if (!aggregatedMap[item.studentId]) {
          aggregatedMap[item.studentId] = {
            name: item.name,
            group: item.group,
            present: 0,
            excused: 0,
            absent: 0,
            late: 0,
          };
        }
        if (item.status && item.status in aggregatedMap[item.studentId]) {
          aggregatedMap[item.studentId][item.status]++;
        }
      });

      const aggregatedList = Object.values(aggregatedMap);
      aggregatedList.sort((a, b) => a.name.localeCompare(b.name));
      setAggregatedReportData(aggregatedList);
      setDailyReportData([]);
    },
    [students],
  );

  useEffect(() => {
    if (!showReportModal) return;

    const fetchReport = async () => {
      setIsLoadingReport(true);
      try {
        const recordsRef = collection(db, "attendanceRecords");
        let docsData: AttendanceRecord[] = [];

        if (reportType === "daily") {
          const q = query(recordsRef, where("date", "==", selectedDate));
          const snapshot = await getDocs(q);

          const uniqueMap = new Map<string, AttendanceRecord>();
          snapshot.docs.forEach((d) => {
            const data = d.data() as AttendanceRecord;
            uniqueMap.set(data.studentId, { ...data, id: d.id });
          });

          // === THÊM ĐOẠN NÀY: TỰ ĐỘNG KHỞI TẠO NẾU NGÀY ĐÓ CHƯA CÓ BẢN GHI NÀO ===
          if (uniqueMap.size === 0 && students.length > 0) {
            const batch = writeBatch(db);
            students.forEach((student) => {
              const recordId = `${student.id}_${selectedDate}`;
              const defaultRecord: AttendanceRecord = {
                studentId: student.id,
                name: student.name,
                group: student.group || "",
                status: "present",
                date: selectedDate,
                month: selectedDate.slice(0, 7),
                year: selectedDate.slice(0, 4),
              };
              batch.set(doc(db, "attendanceRecords", recordId), defaultRecord, {
                merge: true,
              });
              uniqueMap.set(student.id, defaultRecord);
            });
            await batch.commit();
          }
          // =======================================================================

          docsData = Array.from(uniqueMap.values());
          docsData.sort((a, b) => a.name.localeCompare(b.name));

          setDailyReportData(docsData);
          setAggregatedReportData([]);
        } else if (reportType === "weekly") {
          const { start, end } = getWeekDates(selectedWeek);
          const snapshot = await getDocs(recordsRef);
          docsData = snapshot.docs
            .map((d) => d.data() as AttendanceRecord)
            .filter((item) => item.date >= start && item.date <= end);

          processAggregatedData(docsData);
        } else if (reportType === "monthly") {
          const monthKey = selectedDate.slice(0, 7);
          const q = query(recordsRef, where("month", "==", monthKey));
          const snapshot = await getDocs(q);
          docsData = snapshot.docs.map((d) => d.data() as AttendanceRecord);

          processAggregatedData(docsData);
        } else {
          const yearKey = selectedDate.slice(0, 4);
          const q = query(recordsRef, where("year", "==", yearKey));
          const snapshot = await getDocs(q);
          docsData = snapshot.docs.map((d) => d.data() as AttendanceRecord);

          processAggregatedData(docsData);
        }
      } catch (err) {
        console.error("Lỗi tải báo cáo:", err);
        toast.error("Không thể tải dữ liệu báo cáo.");
      } finally {
        setIsLoadingReport(false);
      }
    };

    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showReportModal,
    reportType,
    selectedDate,
    selectedWeek,
    students,
    processAggregatedData,
  ]);

  const handleExportExcel = () => {
    try {
      let csvContent = "\ufeff";
      let fileName = "";

      if (reportType === "daily") {
        csvContent += `STT,Họ và Tên,Tổ,Ngày,Trạng thái\n`;
        dailyReportData.forEach((item, index) => {
          const label = STATUS_META[item.status]?.label || item.status;
          csvContent += `${index + 1},"${item.name}","${item.group || ""}","${item.date}","${label}"\n`;
        });
        fileName = `Bao_Cao_Ngay_${selectedDate}.csv`;
      } else {
        csvContent += `STT,Họ và Tên,Tổ,Có mặt,Có phép,Vắng,Đi muộn,Tổng buổi\n`;
        aggregatedReportData.forEach((item, index) => {
          const total = item.present + item.excused + item.absent + item.late;
          csvContent += `${index + 1},"${item.name}","${item.group || ""}",${item.present},${item.excused},${item.absent},${item.late},${total}\n`;
        });
        fileName = `Bao_Cao_${reportType.toUpperCase()}_${reportType === "weekly" ? selectedWeek : selectedDate.slice(0, 7)}.csv`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Đã xuất file báo cáo điểm danh!");
    } catch (error) {
      console.error("Lỗi khi xuất báo cáo:", error);
      toast.error("Không thể xuất file báo cáo.");
    }
  };

  const hasData =
    reportType === "daily"
      ? dailyReportData.length > 0
      : aggregatedReportData.length > 0;

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 ">
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            Điểm danh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kiểm diện sĩ số học sinh đầu giờ ngày{" "}
            {new Date().toLocaleDateString("vi-VN")}
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs flex items-center gap-1.5"
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl  px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-emerald-700 m-0">
            {counts.present}
          </p>
          <p className="text-[11px] font-semibold text-emerald-700/70 m-0">
            Có mặt
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-3xl  px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-sky-700 m-0">
            {counts.excused}
          </p>
          <p className="text-[11px] font-semibold text-sky-700/70 m-0">
            Có phép
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-3xl  px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-rose-700 m-0">
            {counts.absent}
          </p>
          <p className="text-[11px] font-semibold text-rose-700/70 m-0">Vắng</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-3xl  px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-amber-700 m-0">
            {counts.late}
          </p>
          <p className="text-[11px] font-semibold text-amber-700/70 m-0">
            Đi muộn
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          className="w-full px-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nhập tên học sinh để tìm kiếm..."
        />

        <div className="space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Không tìm thấy học sinh phù hợp.
            </p>
          ) : (
            filteredStudents.map((s) => {
              const normalizedGroup = normalizeGroupName(s.group);
              const groupStyle = GROUP_STYLES[normalizedGroup] || {
                badgeBg: "bg-slate-50",
                badgeText: "text-slate-700",
                badgeBorder: "border-slate-200",
              };
              return (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/70 border border-slate-200/80 rounded-3xl px-4 py-3"
                >
                  {/* Tầng trên: avatar + tên + tổ */}
                  <div className="flex items-center gap-3 sm:flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                      {s.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={s.avatarUrl}
                          alt={s.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        s.name
                          .trim()
                          .split(" ")
                          .slice(-1)[0]
                          ?.charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                    <span className="font-bold text-slate-800 text-sm flex-1 min-w-0 wrap-break-word">
                      {s.name}
                    </span>
                    {normalizedGroup && (
                      <span
                        className={`text-[10px] font-bold ${groupStyle.badgeText} ${groupStyle.badgeBg} border ${groupStyle.badgeBorder} rounded-full px-2 py-0.5 shrink-0`}
                      >
                        {normalizedGroup}
                      </span>
                    )}
                  </div>

                  {/* Tầng dưới: 4 nút chia đều */}
                  <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 sm:justify-end">
                    {Object.entries(STATUS_META).map(([key, m]) => (
                      <button
                        key={key}
                        onClick={() => handleSetStatus(s.id, key)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-[10.5px] font-bold px-1 sm:px-2.5 py-2 sm:py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                          s.status === key
                            ? m.active
                            : "bg-white text-slate-500 border-slate-200 hover:border-amber-300"
                        }`}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl  max-w-3xl w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100  pb-3">
              <h3 className="font-bold text-slate-800 text-base">
                Trung tâm Báo cáo & Tổng kết
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
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
                  value={reportType}
                  onChange={(e) =>
                    setReportType(
                      e.target.value as
                        | "daily"
                        | "weekly"
                        | "monthly"
                        | "yearly",
                    )
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="daily">Báo cáo theo Ngày</option>
                  <option value="weekly">Báo cáo tổng hợp Tuần</option>
                  <option value="monthly">Báo cáo tổng hợp Tháng</option>
                  <option value="yearly">Báo cáo tổng hợp Năm</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">
                  Thời gian:
                </span>
                {reportType === "weekly" ? (
                  <input
                    type="week"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                ) : (
                  <input
                    type={reportType === "daily" ? "date" : "month"}
                    value={
                      reportType === "daily"
                        ? selectedDate
                        : selectedDate.slice(0, 7)
                    }
                    onChange={(e) => {
                      const val = e.target.value; // Giá trị từ input type="date" luôn là YYYY-MM-DD
                      if (reportType === "daily") {
                        setSelectedDate(val); // val chuẩn YYYY-MM-DD (VD: 2026-09-19)
                      } else {
                        setSelectedDate(val + "-01");
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
              {isLoadingReport ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Đang tổng hợp dữ liệu báo cáo...
                </p>
              ) : !hasData ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  Không có dữ liệu điểm danh trong khoảng thời gian này.
                </p>
              ) : reportType === "daily" ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 font-bold w-12 text-center">STT</th>
                      <th className="p-2.5 font-bold">Họ và tên</th>
                      <th className="p-2.5 font-bold w-20">Tổ</th>
                      <th className="p-2.5 font-bold w-32 text-center">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyReportData.map((item, idx) => {
                      const meta = STATUS_META[item.status];
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-center text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-medium text-slate-800">
                            {item.name}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {item.group || "-"}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {meta?.icon} {meta?.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 font-bold w-12 text-center">STT</th>
                      <th className="p-2.5 font-bold">Họ và tên</th>
                      <th className="p-2.5 font-bold w-20">Tổ</th>
                      <th className="p-2.5 font-bold text-center text-emerald-700">
                        Có mặt
                      </th>
                      <th className="p-2.5 font-bold text-center text-sky-700">
                        Có phép
                      </th>
                      <th className="p-2.5 font-bold text-center text-rose-700">
                        Vắng
                      </th>
                      <th className="p-2.5 font-bold text-center text-amber-700">
                        Đi muộn
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aggregatedReportData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {item.group || "-"}
                        </td>
                        <td className="p-2.5 text-center font-bold text-emerald-600">
                          {item.present}
                        </td>
                        <td className="p-2.5 text-center font-bold text-sky-600">
                          {item.excused}
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-600">
                          {item.absent}
                        </td>
                        <td className="p-2.5 text-center font-bold text-amber-600">
                          {item.late}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                onClick={handleExportExcel}
                disabled={!hasData}
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
                Xuất Excel báo cáo
              </button>

              <button
                onClick={() => setShowReportModal(false)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
