"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx-js-style";
import { fetchClassInfo, buildTimetableTitle } from "@/lib/classInfo";

interface DaySchedule {
  day: string;
  morning: string[];
  afternoon: string[];
}

const defaultSchedule: DaySchedule[] = [
  { day: "Thứ 2", morning: ["", "", "", ""], afternoon: ["", "", ""] },
  { day: "Thứ 3", morning: ["", "", "", ""], afternoon: ["", "", ""] },
  { day: "Thứ 4", morning: ["", "", "", ""], afternoon: ["", "", ""] },
  { day: "Thứ 5", morning: ["", "", "", ""], afternoon: ["", "", ""] },
  { day: "Thứ 6", morning: ["", "", "", ""], afternoon: ["", "", ""] },
];

export default function Schedule() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);

  useEffect(() => {
    const docRef = doc(db, "timetable", "main");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().data) {
        const remoteData: DaySchedule[] = docSnap.data().data;

        // Chuẩn hóa: Buổi sáng đúng 4 tiết, buổi chiều đúng 3 tiết
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

      const numCols = schedule.length + 1;
      const morningLen = schedule[0].morning.length;
      const afternoonLen = schedule[0].afternoon.length;
      const lastRow = 1 + morningLen + afternoonLen;

      // Gộp ô: tiêu đề, "Sáng", "Chiều"
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols } },
        { s: { r: 2, c: 0 }, e: { r: 2 + morningLen - 1, c: 0 } },
        {
          s: { r: 2 + morningLen, c: 0 },
          e: { r: 2 + morningLen + afternoonLen - 1, c: 0 },
        },
      ];

      worksheet["!cols"] = [
        { wch: 9 },
        { wch: 9 },
        ...schedule.map(() => ({ wch: 20 })),
      ];

      worksheet["!rows"] = Array.from({ length: lastRow + 1 }, (_, r) => ({
        hpt: r === 0 ? 28 : 24,
      }));

      const thin = { style: "thin", color: { rgb: "000000" } };
      const border = { top: thin, bottom: thin, left: thin, right: thin };
      const center = {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      };

      const titleCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
      titleCell.s = {
        font: { bold: true, sz: 14 },
        alignment: center,
      };

      for (let r = 1; r <= lastRow; r++) {
        for (let c = 0; c <= numCols; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[addr]) worksheet[addr] = { t: "s", v: "" };
          worksheet[addr].s = {
            border,
            alignment: center,
            font: { bold: r === 1 || c === 0, sz: 12 },
          };
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ThoiKhoaBieu");
      XLSX.writeFile(
        workbook,
        `Thoi_Khoa_Bieu_${info.className || "Lop"}.xlsx`,
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section id="schedule">
      <div className="section-head" style={{ textAlign: "center" }}>
        <span className="kicker">Thời khóa biểu</span>
        <h2>Lịch dạy lớp 4A4</h2>
        <p>
          Cập nhật theo tuần — phụ huynh có thể theo dõi để chuẩn bị đồ dùng học
          tập cho con.
        </p>
      </div>

      {/* Bảng buổi sáng (4 tiết) */}
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
            {[0, 1, 2, 3].map((periodIndex) => (
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

      {/* Bảng buổi chiều (3 tiết) */}
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
            {[0, 1, 2].map((periodIndex) => (
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