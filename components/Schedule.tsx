"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";

interface DaySchedule {
  day: string;
  morning: string[];
  afternoon: string[];
}

const defaultSchedule: DaySchedule[] = [
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

export default function Schedule() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);

  useEffect(() => {
    const docRef = doc(db, "timetable", "main");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().data) {
        setSchedule(docSnap.data().data);
      }
    });

    return () => unsubscribe();
  }, []);

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
    <section id="schedule">
      <div className="section-head" style={{ textAlign: "center" }}>
        <span className="kicker">Thời khóa biểu</span>
        <h2>Lịch dạy lớp 3A</h2>
        <p>
          Cập nhật theo tuần — phụ huynh có thể theo dõi để chuẩn bị đồ dùng học
          tập cho con.
        </p>
      </div>

      {/* Bảng buổi sáng (5 tiết) */}
      <div className="timetable-wrap">
        <div className="timetable-label">☀️ Buổi sáng</div>
        <table>
          <thead>
            <tr>
              <th>Tiết</th>
              {schedule.map((d) => (
                <th key={d.day}>{d.day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((periodIndex) => (
              <tr key={periodIndex}>
                <td>{periodIndex + 1}</td>
                {schedule.map((dayData) => {
                  const subject = dayData.morning[periodIndex];
                  return (
                    <td key={dayData.day}>
                      {subject ? (
                        <span className="tag-subject">{subject}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="timetable-gap"></div>

      {/* Bảng buổi chiều (5 tiết) */}
      <div className="timetable-wrap">
        <div className="timetable-label">🌤️ Buổi chiều</div>
        <table>
          <thead>
            <tr>
              <th>Tiết</th>
              {schedule.map((d) => (
                <th key={d.day}>{d.day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((periodIndex) => (
              <tr key={periodIndex}>
                <td>{periodIndex + 1}</td>
                {schedule.map((dayData) => {
                  const subject = dayData.afternoon[periodIndex];
                  return (
                    <td key={dayData.day}>
                      {subject ? (
                        <span className="tag-subject">{subject}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "30px" }}
      >
        <button
          onClick={exportToExcel}
          className="btn-primary schedule-export-btn"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          📥 Tải File Excel Thời Khóa Biểu
        </button>
      </div>
    </section>
  );
}
