"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import {
  TOTAL_GROUPS,
  getGroupLabel,
  getGroupIndex,
  getSeatGroupIndex,
} from "@/lib/groups";
import { fetchClassInfo, ClassInfo, DEFAULT_CLASS_INFO } from "@/lib/classInfo";

interface Student {
  id: string;
  name: string;
  group?: string;
}

export default function AdminSeatingChart() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [rowsPerDay, setRowsPerDay] = useState(5);
  const [seats, setSeats] = useState<Record<string, string>>({});
  const [teacherBoardText, setTeacherBoardText] = useState(
    "BỤC GIẢNG / BẢNG GIÁO VIÊN",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [groupTitles, setGroupTitles] = useState<string[]>([
    "Tổ 1",
    "Tổ 2",
    "Tổ 3",
  ]);

  const [confirmResetChart, setConfirmResetChart] = useState(false);
  const [classInfo, setClassInfo] = useState<ClassInfo>(DEFAULT_CLASS_INFO);

  // ===== MỚI: dành cho điện thoại =====
  const [activeGroup, setActiveGroup] = useState(0); // tổ đang xem
  const [picked, setPicked] = useState<string | null>(null); // học sinh đang được chọn

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const studentSnap = await getDocs(collection(db, "students"));
        const studentList = studentSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Student[];
        studentList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(studentList);

        try {
          setClassInfo(await fetchClassInfo());
        } catch (err) {
          console.error("Lỗi tải thông tin lớp:", err);
        }

        const configDoc = await getDoc(doc(db, "settings", "seatingChart"));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.rowsPerDay) setRowsPerDay(data.rowsPerDay);
          if (data.teacherBoardText !== undefined) {
            setTeacherBoardText(data.teacherBoardText);
          }

          const titles: string[] = Array.isArray(data.groupTitles)
            ? data.groupTitles.slice(0, TOTAL_GROUPS)
            : groupTitles;
          setGroupTitles(titles);

          const studentById = new Map(studentList.map((s) => [s.id, s]));
          const cleanedSeats: Record<string, string> = {};
          Object.entries((data.seats || {}) as Record<string, string>).forEach(
            ([seatKey, sid]) => {
              const s = studentById.get(sid);
              if (!s) return;
              const gi = getGroupIndex(s.group, titles);
              if (gi !== -1 && gi !== getSeatGroupIndex(seatKey)) return;
              cleanedSeats[seatKey] = sid;
            },
          );
          setSeats(cleanedSeats);
        }
      } catch (err) {
        console.error("Lỗi tải dữ liệu sơ đồ lớp:", err);
        toast.error("Không thể tải dữ liệu sơ đồ lớp.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveChart = async () => {
    try {
      setIsLoading(true);
      await setDoc(doc(db, "settings", "seatingChart"), {
        rowsPerDay,
        cols: TOTAL_GROUPS,
        seats,
        teacherBoardText,
        groupTitles,
      });

      const seatedGroup = new Map<string, number>();
      Object.entries(seats).forEach(([seatKey, sid]) => {
        seatedGroup.set(sid, getSeatGroupIndex(seatKey));
      });

      const updates = students
        .filter((s) => seatedGroup.has(s.id))
        .map(async (s) => {
          const label = getGroupLabel(seatedGroup.get(s.id)!);
          if (s.group !== label) {
            await updateDoc(doc(db, "students", s.id), {
              group: label,
              team: label,
            });
          }
        });

      await Promise.all(updates);

      setStudents((prev) =>
        prev.map((s) =>
          seatedGroup.has(s.id)
            ? { ...s, group: getGroupLabel(seatedGroup.get(s.id)!) }
            : s,
        ),
      );

      toast.success("Đã lưu sơ đồ và đồng bộ thông tin tổ thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu sơ đồ lớp.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmResetChart = () => {
    setSeats({});
    setPicked(null);
    setConfirmResetChart(false);
    toast.success("Đã làm mới sơ đồ. Bạn có thể xếp lại từ đầu!");
    toast.info('Đừng quên bấm "Lưu & Đồng bộ" để áp dụng lên hệ thống.');
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const win = window as unknown as {
        html2pdf?: () => {
          from: (el: HTMLElement) => {
            set: (opt: object) => { save: () => Promise<void> };
          };
        };
      };

      if (!win.html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const element = document.getElementById("printable-area");
      if (!element) {
        toast.error("Không tìm thấy sơ đồ để xuất file.");
        return;
      }

      const opt = {
        margin: [10, 10, 10, 10],
        filename: "So-do-lop-hoc-ngang.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          windowWidth: 1100, // giả lập màn hình rộng để đủ 3 tổ
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      };

      const html2pdfFn = (window as unknown as Record<string, unknown>)
        .html2pdf as () => {
        from: (el: HTMLElement) => {
          set: (opt: object) => { save: () => Promise<void> };
        };
      };

      if (html2pdfFn) {
        // Bảng màu sáng + hiện đủ 3 tổ khi chụp
        element.classList.add("print-light", "show-all-groups");
        try {
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await html2pdfFn().from(element).set(opt).save();
          toast.success("Đã xuất file PDF sơ đồ lớp!");
        } finally {
          element.classList.remove("print-light", "show-all-groups");
        }
      }
    } catch (error) {
      console.error("Lỗi xuất PDF:", error);
      toast.error("Không thể xuất file PDF trực tiếp. Vui lòng thử lại!");
    } finally {
      setIsExporting(false);
    }
  };

  // ===== Kéo thả (máy tính) =====
  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.setData("text/plain", studentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ===== Đặt / gỡ học sinh (dùng chung cho kéo thả và chạm) =====
  const placeStudent = (studentId: string, seatKey: string) => {
    setSeats((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === studentId) delete next[k];
      });
      next[seatKey] = studentId;
      return next;
    });
    setPicked(null);
  };

  const removeStudentFromSeat = (studentId: string) => {
    setSeats((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === studentId) delete next[k];
      });
      return next;
    });
    setPicked(null);
  };

  const handleDropOnSeat = (e: React.DragEvent, targetSeatKey: string) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData("text/plain");
    if (!studentId) return;
    placeStudent(studentId, targetSeatKey);
  };

  const handleDropToRemove = (e: React.DragEvent) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData("text/plain");
    if (!studentId) return;
    removeStudentFromSeat(studentId);
  };

  const unassignedStudents = students.filter(
    (s) => !Object.values(seats).includes(s.id),
  );
  const pickedStudent = picked
    ? students.find((s) => s.id === picked)
    : undefined;

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Thanh công cụ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
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
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Sơ đồ lớp học
        </h2>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span>Số bàn mỗi tổ:</span>
            <input
              type="number"
              min={1}
              max={15}
              value={rowsPerDay}
              onChange={(e) => setRowsPerDay(parseInt(e.target.value) || 1)}
              className="w-11 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={() => setConfirmResetChart(true)}
            className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
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
            </svg>{" "}
            Reset
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {isExporting ? (
              <>
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
                  className="lucide lucide-hourglass animate-spin"
                >
                  <path d="M5 22h14" />
                  <path d="M5 2h14" />
                  <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                  <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                </svg>
                Đang tạo PDF...
              </>
            ) : (
              <>
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
                Xuất PDF
              </>
            )}
          </button>

          <button
            onClick={handleSaveChart}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
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
            </svg>{" "}
            Lưu & Đồng bộ
          </button>
        </div>
      </div>

      {isLoading && students.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          Đang tải dữ liệu...
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Khu vực sơ đồ */}
          <div
            id="printable-area"
            style={{
              backgroundColor: "var(--sc-bg)",
              padding: "16px",
              borderRadius: "12px",
              width: "100%",
              boxSizing: "border-box",
            }}
            className="lg:col-span-3 space-y-3"
          >
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <h1
                style={{
                  fontSize: "16px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  color: "var(--sc-title)",
                  margin: 0,
                }}
              >
                SƠ ĐỒ LỚP HỌC {classInfo.className}
              </h1>
              {classInfo.schoolYear && (
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--sc-sub)",
                    marginTop: "2px",
                  }}
                >
                  Năm học {classInfo.schoolYear}
                </div>
              )}
            </div>

            {/* MỚI: tab chọn tổ, chỉ hiện trên điện thoại, không đưa vào PDF */}
            <div data-html2canvas-ignore className="sm:hidden flex gap-1.5">
              {groupTitles.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveGroup(i)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    activeGroup === i
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-3"
              style={{
                gap: "12px",
                padding: "12px",
                backgroundColor: "var(--sc-panel)",
                border: "1px solid var(--sc-panel-border)",
                borderRadius: "10px",
              }}
            >
              {groupTitles.map((title, groupIndex) => (
                <div
                  key={groupIndex}
                  className={`flex-col ${
                    groupIndex === activeGroup ? "flex" : "hidden sm:flex"
                  }`}
                  style={{
                    gap: "6px",
                    backgroundColor: "var(--sc-group-bg)",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid var(--sc-group-border)",
                  }}
                >
                  <div
                    style={{
                      paddingBottom: "4px",
                      borderBottom: "1px solid var(--sc-group-line)",
                    }}
                  >
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        const newTitles = [...groupTitles];
                        newTitles[groupIndex] = e.target.value;
                        setGroupTitles(newTitles);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "center",
                        fontWeight: "800",
                        fontSize: "12px",
                        color: "var(--sc-group-title)",
                        textTransform: "uppercase",
                        border: "1px dashed #f59e0b",
                        borderRadius: "4px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    {Array.from({ length: rowsPerDay }).map((_, rowIndex) => {
                      const leftSeatKey = `${groupIndex}-${rowIndex}-0`;
                      const rightSeatKey = `${groupIndex}-${rowIndex}-1`;
                      const leftStudent = students.find(
                        (s) => s.id === seats[leftSeatKey],
                      );
                      const rightStudent = students.find(
                        (s) => s.id === seats[rightSeatKey],
                      );

                      const renderSeat = (
                        seatKey: string,
                        student: Student | undefined,
                      ) => (
                        <div
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropOnSeat(e, seatKey)}
                          draggable={!!student}
                          onDragStart={(e) =>
                            student && handleDragStart(e, student.id)
                          }
                          // MỚI: chạm để chọn / đặt
                          onClick={() => {
                            if (picked) placeStudent(picked, seatKey);
                            else if (student) setPicked(student.id);
                          }}
                          style={{
                            height: "34px",
                            padding: "0 6px",
                            borderRadius: "4px",
                            border:
                              student && picked === student.id
                                ? "2px solid #f59e0b"
                                : student
                                  ? "1px solid var(--sc-seat-border)"
                                  : "1px dashed var(--sc-empty-border)",
                            backgroundColor: student
                              ? "var(--sc-seat-bg)"
                              : "var(--sc-empty-bg)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            cursor: "pointer",
                          }}
                        >
                          {student ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                color: "var(--sc-name)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                              }}
                              title={student.name}
                            >
                              {student.name}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "9px",
                                color: "var(--sc-empty-text)",
                                fontStyle: "italic",
                              }}
                            >
                              Trống
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <div
                          key={rowIndex}
                          style={{
                            padding: "3px",
                            backgroundColor: "var(--sc-desk-bg)",
                            borderRadius: "4px",
                            border: "1px solid var(--sc-group-line)",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: "4px",
                            }}
                          >
                            {renderSeat(leftSeatKey, leftStudent)}
                            {renderSeat(rightSeatKey, rightStudent)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bục giảng / Bảng giáo viên */}
            <div
              style={{
                width: "100%",
                backgroundColor: "var(--sc-board-bg)",
                border: "1px solid var(--sc-panel-border)",
                borderRadius: "8px",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <input
                type="text"
                value={teacherBoardText}
                onChange={(e) => setTeacherBoardText(e.target.value)}
                placeholder="Nhập nội dung bảng..."
                style={{
                  width: "100%",
                  textAlign: "center",
                  border: "none",
                  outline: "none",
                  fontSize: "11px",
                  fontWeight: "800",
                  color: "var(--sc-board-text)",
                  textTransform: "uppercase",
                }}
              />
            </div>
          </div>

          {/* Danh sách học sinh chưa xếp chỗ */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropToRemove}
            className="bg-slate-50 border border-slate-200 rounded-3xl p-2.5 flex flex-col space-y-2 h-fit lg:sticky lg:top-3"
          >
            <h3 className="flex items-center justify-center font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Danh sách học sinh
            </h3>

            {/* MỚI: hướng dẫn khi đang chọn một bạn */}
            {pickedStudent ? (
              <div className="space-y-1.5">
                <p className="text-center text-[11px] font-semibold text-amber-700 m-0">
                  Đang chọn: {pickedStudent.name}. Chạm vào ghế để đặt.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="py-2 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-xl"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStudentFromSeat(pickedStudent.id)}
                    className="py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl"
                  >
                    Gỡ khỏi chỗ
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-1.5 text-center">
                <p className="text-[9px] font-semibold text-amber-800 leading-snug m-0">
                  💡 Kéo thả, hoặc chạm vào một bạn rồi chạm vào ghế để xếp chỗ.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto max-h-125 space-y-3 pr-1 no-scrollbar">
              {groupTitles.map((groupName, gIdx) => {
                const displayList = unassignedStudents.filter((s) => {
                  const gi = getGroupIndex(s.group, groupTitles);
                  return gi === gIdx || (gi === -1 && gIdx === 0);
                });

                return (
                  <div
                    key={gIdx}
                    className="bg-white border border-slate-200 rounded-lg p-2 space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                      <span className="text-[10px] font-extrabold text-amber-700 uppercase">
                        {groupName}
                      </span>
                      <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                        {displayList.length}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 no-scrollbar">
                      {displayList.length === 0 ? (
                        <p className="text-[9px] text-slate-400 italic text-center py-1">
                          Đã xếp hết chỗ
                        </p>
                      ) : (
                        displayList.map((s) => (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, s.id)}
                            onClick={() =>
                              setPicked(picked === s.id ? null : s.id)
                            }
                            className={`p-1.5 rounded border text-[11px] font-medium cursor-pointer active:cursor-grabbing transition-all truncate ${
                              picked === s.id
                                ? "border-amber-500 bg-amber-100 text-amber-900"
                                : "border-slate-100 bg-slate-50 hover:border-amber-400"
                            }`}
                          >
                            {s.name}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN RESET SƠ ĐỒ */}
      {confirmResetChart && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Reset sơ đồ lớp?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ vị trí ngồi hiện tại sẽ được xóa để sắp xếp lại từ đầu.
                Hành động này không thể hoàn tác sau khi bấm{" "}
                <strong className="text-slate-800">
                  &quot;Lưu &amp; Đồng bộ&quot;
                </strong>
                .
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetChart(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetChart}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer flex items-center justify-center"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
