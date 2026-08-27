"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";

interface DaySchedule {
  day: string;
  morning: string[];
  afternoon: string[];
}

const initialSchedule: DaySchedule[] = [
  {
    day: "Thứ 2",
    morning: ["", "", "", "", ""],
    afternoon: ["", "", "", "", ""],
  },
  {
    day: "Thứ 3",
    morning: ["", "", "", "", ""],
    afternoon: ["", "", "", "", ""],
  },
  {
    day: "Thứ 4",
    morning: ["", "", "", "", ""],
    afternoon: ["", "", "", "", ""],
  },
  {
    day: "Thứ 5",
    morning: ["", "", "", "", ""],
    afternoon: ["", "", "", "", ""],
  },
  {
    day: "Thứ 6",
    morning: ["", "", "", "", ""],
    afternoon: ["", "", "", "", ""],
  },
];

const COMMON_SUBJECTS = [
  "Toán",
  "Tiếng Việt",
  "Ngoại ngữ (Tiếng Anh)",
  "Tự nhiên & Xã hội",
  "Khoa học",
  "Lịch sử & Địa lý",
  "Đạo đức",
  "Tin học",
  "Công nghệ",
  "Âm nhạc",
  "Mỹ thuật",
  "Thể dục",
  "Hoạt động trải nghiệm",
  "Sinh hoạt lớp",
  "Chào cờ",
  "Kỹ năng sống",
  "Ôn tập Toán",
  "Ôn tập Tiếng Việt",
  "Đọc sách",
  "Bồi dưỡng học sinh",
  "Tự chọn",
];

export default function AdminSchedule() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialSchedule);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const docRef = doc(db, "timetable", "main");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().data) {
        setSchedule(docSnap.data().data);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubjectChange = (
    dayIndex: number,
    session: "morning" | "afternoon",
    periodIndex: number,
    value: string,
  ) => {
    setSchedule((prev) =>
      prev.map((day, dIdx) =>
        dIdx !== dayIndex
          ? day
          : {
              ...day,
              [session]: day[session].map((v, pIdx) =>
                pIdx === periodIndex ? value : v,
              ),
            },
      ),
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage("");
    try {
      await setDoc(doc(db, "timetable", "main"), {
        data: schedule,
        updatedAt: new Date().toISOString(),
      });
      setMessage("✅ Cập nhật Thời khóa biểu thành công!");
    } catch (err) {
      console.error(err);
      setMessage("❌ Lỗi khi cập nhật thời khóa biểu.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn xóa toàn bộ thời khóa biểu hiện tại không?",
      )
    ) {
      const emptySchedule: DaySchedule[] = schedule.map((d) => ({
        day: d.day,
        morning: ["", "", "", "", ""],
        afternoon: ["", "", "", "", ""],
      }));
      setSchedule(emptySchedule);
      setMessage("🧹 Đã xóa toàn bộ nội dung thời khóa biểu.");
    }
  };

  const exportToExcel = () => {
    const excelData = [
      ["Buổi", "Tiết", ...schedule.map((d) => d.day)],
      ["Sáng", "Tiết 1", ...schedule.map((d) => d.morning[0] || "")],
      ["Sáng", "Tiết 2", ...schedule.map((d) => d.morning[1] || "")],
      ["Sáng", "Tiết 3", ...schedule.map((d) => d.morning[2] || "")],
      ["Sáng", "Tiết 4", ...schedule.map((d) => d.morning[3] || "")],
      ["Sáng", "Tiết 5", ...schedule.map((d) => d.morning[4] || "")],
      ["Chiều", "Tiết 1", ...schedule.map((d) => d.afternoon[0] || "")],
      ["Chiều", "Tiết 2", ...schedule.map((d) => d.afternoon[1] || "")],
      ["Chiều", "Tiết 3", ...schedule.map((d) => d.afternoon[2] || "")],
      ["Chiều", "Tiết 4", ...schedule.map((d) => d.afternoon[3] || "")],
      ["Chiều", "Tiết 5", ...schedule.map((d) => d.afternoon[4] || "")],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThoiKhoaBieu");
    XLSX.writeFile(workbook, "Thoi_Khoa_Bieu_Lop_Hoc.xlsx");
  };

  return (
    <div
      className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6"
      ref={dropdownRef}
    >
      {/* Header card thời khóa biểu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-amber-100">
        <h3 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Cập nhật thời khóa biểu lớp học
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleClearAll}
            className="px-3 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-2xs flex items-center gap-1.5"
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
            </svg>
            Xóa tất cả
          </button>
          <button
            onClick={exportToExcel}
            className="px-3 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-2xs flex items-center gap-1.5"
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
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Xuất Excel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
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
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
          {message}
        </div>
      )}

      {/* Thời khóa biểu theo từng ngày */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {schedule.map((dayData, dayIdx) => (
          <div
            key={dayData.day}
            className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-4 shadow-2xs"
          >
            <h4 className="text-center font-extrabold text-amber-900 text-sm border-b border-amber-100 pb-2.5 flex items-center justify-center gap-1.5">
              {dayData.day}
            </h4>

            {/* Buổi Sáng */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-amber-800/70 uppercase tracking-wider flex items-center gap-1">
                <span>☀️</span> Buổi Sáng
              </p>
              <div className="space-y-1.5">
                {dayData.morning.map((subject, pIdx) => {
                  const fieldKey = `morning-${dayIdx}-${pIdx}`;
                  const filteredSubjects = COMMON_SUBJECTS.filter((sub) =>
                    sub.toLowerCase().includes((subject || "").toLowerCase()),
                  );

                  const openUpward = pIdx >= 3;

                  return (
                    <div key={pIdx} className="relative">
                      <input
                        type="text"
                        value={subject}
                        onFocus={() => setActiveDropdown(fieldKey)}
                        onChange={(e) => {
                          handleSubjectChange(
                            dayIdx,
                            "morning",
                            pIdx,
                            e.target.value,
                          );
                          setActiveDropdown(fieldKey);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
                        placeholder={`Tiết ${pIdx + 1}`}
                      />

                      {activeDropdown === fieldKey &&
                        filteredSubjects.length > 0 && (
                          <div
                            className={`absolute left-0 right-0 ${
                              openUpward ? "bottom-full mb-1" : "top-full mt-1"
                            } bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50`}
                          >
                            {filteredSubjects.map((sub) => (
                              <div
                                key={sub}
                                onClick={() => {
                                  handleSubjectChange(
                                    dayIdx,
                                    "morning",
                                    pIdx,
                                    sub,
                                  );
                                  setActiveDropdown(null);
                                }}
                                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 cursor-pointer font-medium transition-colors border-b border-slate-50 last:border-none"
                              >
                                {sub}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buổi Chiều */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-amber-800/70 uppercase tracking-wider flex items-center gap-1">
                <span>🌤️</span> Buổi Chiều
              </p>
              <div className="space-y-1.5">
                {dayData.afternoon.map((subject, pIdx) => {
                  const fieldKey = `afternoon-${dayIdx}-${pIdx}`;
                  const filteredSubjects = COMMON_SUBJECTS.filter((sub) =>
                    sub.toLowerCase().includes((subject || "").toLowerCase()),
                  );

                  const openUpward = pIdx >= 3;

                  return (
                    <div key={pIdx} className="relative">
                      <input
                        type="text"
                        value={subject}
                        onFocus={() => setActiveDropdown(fieldKey)}
                        onChange={(e) => {
                          handleSubjectChange(
                            dayIdx,
                            "afternoon",
                            pIdx,
                            e.target.value,
                          );
                          setActiveDropdown(fieldKey);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
                        placeholder={`Tiết ${pIdx + 1}`}
                      />

                      {activeDropdown === fieldKey &&
                        filteredSubjects.length > 0 && (
                          <div
                            className={`absolute left-0 right-0 ${
                              openUpward ? "bottom-full mb-1" : "top-full mt-1"
                            } bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50`}
                          >
                            {filteredSubjects.map((sub) => (
                              <div
                                key={sub}
                                onClick={() => {
                                  handleSubjectChange(
                                    dayIdx,
                                    "afternoon",
                                    pIdx,
                                    sub,
                                  );
                                  setActiveDropdown(null);
                                }}
                                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 cursor-pointer font-medium transition-colors border-b border-slate-50 last:border-none"
                              >
                                {sub}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
