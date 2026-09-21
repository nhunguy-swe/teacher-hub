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
import {
  buildWeeklyDeltaMap,
  getMonday,
  getSunday,
  WEEKLY_BASE_POINTS,
} from "@/lib/weeklyScore";
import { GROUPS, normalizeGroupName, getSeatGroupIndex } from "@/lib/groups";

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
  const [weeklyActivityLogs, setWeeklyActivityLogs] = useState<
    { name: string; delta: number; createdAt?: { toDate: () => Date } | null }[]
  >([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWeeklyActivityLogs(
        snapshot.docs.map((docSnap) => docSnap.data()) as {
          name: string;
          delta: number;
          createdAt?: { toDate: () => Date } | null;
        }[],
      );
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

        {/* Grid điều chỉnh hiển thị 3 cột thay vì 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          {GROUPS.map((g) => {
            const style = GROUP_STYLES[g];
            const studentsInGroup = students.filter(
              (s) => normalizeGroupName(s.group) === g,
            );

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
