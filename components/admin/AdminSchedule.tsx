"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx-js-style";
import { fetchClassInfo, buildTimetableTitle } from "@/lib/classInfo";

interface DaySchedule {
  day: string;
  morning: string[];
  afternoon: string[];
}

const initialSchedule: DaySchedule[] = [
  {
    day: "Thứ 2",
    morning: ["", "", "", ""],
    afternoon: ["", "", ""],
  },
  {
    day: "Thứ 3",
    morning: ["", "", "", ""],
    afternoon: ["", "", ""],
  },
  {
    day: "Thứ 4",
    morning: ["", "", "", ""],
    afternoon: ["", "", ""],
  },
  {
    day: "Thứ 5",
    morning: ["", "", "", ""],
    afternoon: ["", "", ""],
  },
  {
    day: "Thứ 6",
    morning: ["", "", "", ""],
    afternoon: ["", "", ""],
  },
];

const COMMON_SUBJECTS = [
  "Toán",
  "Tiếng Việt",
  "Tiếng Anh",
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
  "HĐTN - Chào cờ",
  "HĐTN - Sinh hoạt lớp",
  "HĐTN",
  "HĐTN - SHL",
  "LS & ĐL",
];

export default function AdminSchedule() {
  const toast = useToast();
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialSchedule);
  const [loading, setLoading] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State cho popup xác nhận xóa toàn bộ thời khóa biểu
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "timetable", "main");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().data) {
        const remoteData: DaySchedule[] = docSnap.data().data;

        // Chuẩn hóa lại: Buổi sáng đúng 4 tiết, buổi chiều đúng 3 tiết
        const sanitizedData = remoteData.map((d) => ({
          day: d.day,
          morning: [
            d.morning[0] || "",
            d.morning[1] || "",
            d.morning[2] || "",
            d.morning[3] || "",
          ],
          afternoon: [
            d.afternoon[0] || "",
            d.afternoon[1] || "",
            d.afternoon[2] || "",
          ],
        }));

        setSchedule(sanitizedData);
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
    try {
      await setDoc(doc(db, "timetable", "main"), {
        data: schedule,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Cập nhật Thời khóa biểu thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật thời khóa biểu.");
    } finally {
      setLoading(false);
    }
  };

  // Xóa toàn bộ nội dung thời khóa biểu (được gọi từ popup xác nhận)
  const handleConfirmClearAll = () => {
    const emptySchedule: DaySchedule[] = schedule.map((d) => ({
      day: d.day,
      morning: ["", "", "", ""],
      afternoon: ["", "", ""],
    }));
    setSchedule(emptySchedule);
    setConfirmClearAll(false);
    toast.success("Đã xóa toàn bộ nội dung thời khóa biểu!");
    toast.info('Đừng quên bấm "Lưu thay đổi" để áp dụng lên hệ thống.');
  };

  const exportToExcel = async () => {
    try {
      const info = await fetchClassInfo();
      const title = [buildTimetableTitle(info)];
      const header = ["Buổi", "Tiết", ...schedule.map((d) => d.day)];

      const morningRows = schedule[0].morning.map((_, pIdx) => [
        pIdx === 0 ? "Sáng" : "",
        `Tiết ${pIdx + 1}`,
        ...schedule.map((d) => d.morning[pIdx] || ""),
      ]);

      const afternoonRows = schedule[0].afternoon.map((_, pIdx) => [
        pIdx === 0 ? "Chiều" : "",
        `Tiết ${pIdx + 1}`,
        ...schedule.map((d) => d.afternoon[pIdx] || ""),
      ]);

      const excelData = [title, header, ...morningRows, ...afternoonRows];
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      const numCols = schedule.length + 1; // chỉ số cột cuối (G)
      const morningLen = schedule[0].morning.length;
      const afternoonLen = schedule[0].afternoon.length;
      const lastRow = 1 + morningLen + afternoonLen; // chỉ số dòng cuối

      // Gộp ô: tiêu đề, "Sáng", "Chiều"
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols } },
        { s: { r: 2, c: 0 }, e: { r: 2 + morningLen - 1, c: 0 } },
        {
          s: { r: 2 + morningLen, c: 0 },
          e: { r: 2 + morningLen + afternoonLen - 1, c: 0 },
        },
      ];

      // Độ rộng cột: Buổi, Tiết, rồi 5 thứ
      worksheet["!cols"] = [
        { wch: 9 },
        { wch: 9 },
        ...schedule.map(() => ({ wch: 20 })),
      ];

      // Chiều cao dòng
      worksheet["!rows"] = Array.from({ length: lastRow + 1 }, (_, r) => ({
        hpt: r === 0 ? 28 : 24,
      }));

      // Style
      const thin = { style: "thin", color: { rgb: "000000" } };
      const border = { top: thin, bottom: thin, left: thin, right: thin };
      const center = {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      };

      // Tiêu đề (dòng 0): căn giữa, in đậm, không viền
      const titleCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
      titleCell.s = {
        font: { bold: true, sz: 14 },
        alignment: center,
      };

      // Bảng (từ dòng 1 đến hết): viền + căn giữa, tạo ô nếu còn thiếu
      for (let r = 1; r <= lastRow; r++) {
        for (let c = 0; c <= numCols; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[addr]) worksheet[addr] = { t: "s", v: "" };
          worksheet[addr].s = {
            border,
            alignment: center,
            font: { bold: r === 1 || c === 0, sz: 12 }, // header + cột Buổi in đậm
          };
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ThoiKhoaBieu");
      XLSX.writeFile(
        workbook,
        `Thoi_Khoa_Bieu_${info.className || "Lop"}.xlsx`,
      );
      toast.success("Đã xuất file Excel thời khóa biểu!");
    } catch (err) {
      console.error(err);
      toast.error("Xuất Excel thất bại, vui lòng thử lại!");
    }
  };

  return (
    <div
      className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6"
      ref={dropdownRef}
    >
      {/* Header card thời khóa biểu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
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
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setConfirmClearAll(true)}
            className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5"
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Xóa tất cả
          </button>
          <button
            onClick={exportToExcel}
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
            </svg>
            Xuất Excel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5"
          >
            {loading ? (
              <svg
                width="16"
                height="16"
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
            )}
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>

      {/* Thêm dòng gợi ý ở đây */}
      <p className="sm:hidden text-center text-[11px] text-slate-400 font-medium m-0">
        ← Vuốt ngang để chuyển ngày (Thứ 2 → Thứ 6) →
      </p>

      {/* Thời khóa biểu theo từng ngày */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
        {schedule.map((dayData, dayIdx) => (
          <div
            key={dayData.day}
            className="w-full min-w-full shrink-0 snap-center sm:w-auto sm:min-w-0 sm:shrink bg-slate-50/70 p-4 rounded-3xl border border-slate-200/80 space-y-4 shadow-2xs"
          >
            <h4 className="text-center font-extrabold text-amber-900 text-sm border-b border-slate-100  pb-2.5 flex items-center justify-center gap-1.5">
              {dayData.day}
            </h4>

            {/* Buổi Sáng (4 tiết) */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-amber-800/70 uppercase tracking-wider flex items-center gap-1 pt-2.5">
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
                        placeholder={`Tiết ${pIdx + 1}`}
                      />

                      {activeDropdown === fieldKey &&
                        filteredSubjects.length > 0 && (
                          <div
                            className={`relative sm:absolute left-0 right-0 mt-1 ${
                              openUpward
                                ? "sm:bottom-full sm:mb-1 sm:mt-0"
                                : "sm:top-full sm:mt-1"
                            } bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none`}
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

            {/* Buổi Chiều (3 tiết) */}
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

                  const openUpward = pIdx >= 2;

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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
                        placeholder={`Tiết ${pIdx + 1}`}
                      />

                      {activeDropdown === fieldKey &&
                        filteredSubjects.length > 0 && (
                          <div
                            className={`relative sm:absolute left-0 right-0 mt-1 ${
                              openUpward
                                ? "sm:bottom-full sm:mb-1 sm:mt-0"
                                : "sm:top-full sm:mt-1"
                            } bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none`}
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

      {/* POPUP XÁC NHẬN XÓA TOÀN BỘ THỜI KHÓA BIỂU */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa toàn bộ thời khóa biểu?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ nội dung các tiết học trong tuần sẽ được xóa trắng. Hành
                động này không thể hoàn tác sau khi bấm{" "}
                <strong className="text-slate-800">
                  &quot;Lưu thay đổi&quot;
                </strong>
                .
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                Xóa tất cả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
