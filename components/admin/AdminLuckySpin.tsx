"use client";

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import confetti from "canvas-confetti";
import {
  StudentItem,
  DEFAULT_SUBJECTS,
  COLORS,
  PRIVILEGES_LIST,
  getRandomItem,
  randomInRange,
} from "@/lib/types";
import { useLuckyDraw } from "@/components/admin/AdminLuckyDrawContext";

const WheelIcon = () => (
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
    className="lucide lucide-ferris-wheel"
  >
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4" />
    <path d="m6.8 15-3.5 2" />
    <path d="m20.7 7-3.5 2" />
    <path d="M6.8 9 3.3 7" />
    <path d="m20.7 17-3.5-2" />
    <path d="m9 22 3-8 3 8" />
    <path d="M8 22h8" />
    <path d="M18 18.7a9 9 0 1 0-12 0" />
  </svg>
);

export default function AdminLuckySpin() {
  const toast = useToast();
  const meta = {
    icon: <WheelIcon />,
    title: "Vòng quay may mắn",
    desc: "Quay vòng may mắn để chọn học sinh trả bài",
  };

  const {
    subjectsList,
    setSubjectsList,
    selectedSubject,
    setSelectedSubject,
    renameSubject,
    deleteSubject,
    activeStudents,
    removeStudentFromActive,
    addManualNames,
    fetchDbStudents,
    resetList,
    winnerHistories,
    addWinnerToHistory,
    clearHistoryForSelectedSubject,
    beginDraw,
    endDraw,
  } = useLuckyDraw();

  const [manualNames, setManualNames] = useState("");

  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [isCustomSubject, setIsCustomSubject] = useState(false);

  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editSubjectNameInput, setEditSubjectNameInput] = useState("");

  const [spinning, setSpinning] = useState(false);
  const [wheelMessage, setWheelMessage] = useState("Sẵn sàng chọn một bạn!");
  const [currentRotation, setCurrentRotation] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [winnerPopup, setWinnerPopup] = useState<StudentItem | null>(null);
  const [showPrivilegeScreen, setShowPrivilegeScreen] = useState(false);
  const [activePrivileges, setActivePrivileges] = useState<string[]>([]);
  const [revealedPrivileges, setRevealedPrivileges] = useState<Set<number>>(
    new Set(),
  );
  const [currentPrivilegeWinner, setCurrentPrivilegeWinner] =
    useState<StudentItem | null>(null);

  // State cho popup xác nhận xóa lịch sử trúng thưởng của môn đang chọn
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // State cho popup xác nhận xóa môn học
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState(false);

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
  };

  const handleSaveEditedSubjectName = () => {
    const ok = renameSubject(selectedSubject, editSubjectNameInput);
    if (!ok) {
      toast.warning("Tên môn học này đã tồn tại trong danh sách!");
      return;
    }
    toast.success("Đã cập nhật tên môn học!");
    setIsEditingSubject(false);
  };

  // Xóa lịch sử trúng thưởng của môn đang chọn (được gọi từ popup xác nhận)
  const handleConfirmClearHistory = () => {
    clearHistoryForSelectedSubject();
    setConfirmClearHistory(false);
    toast.success(`Đã xóa lịch sử trúng thưởng môn "${selectedSubject}"!`);
  };

  // Xóa môn học (được gọi từ popup xác nhận)
  const handleConfirmDeleteSubject = () => {
    const subjectName = selectedSubject;
    deleteSubject(subjectName);
    setConfirmDeleteSubject(false);
    toast.success(`Đã xóa môn "${subjectName}"!`);
  };

  const handleContinueSpin = useCallback(() => {
    if (winnerPopup) {
      setWinnerPopup(null);
      setWheelMessage("Sẵn sàng chọn một bạn!");
    }
  }, [winnerPopup]);

  const handleOpenPrivilege = (student: StudentItem) => {
    setCurrentPrivilegeWinner(student);
    setWinnerPopup(null);
    const shuffledPrivs = [...PRIVILEGES_LIST]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setActivePrivileges(shuffledPrivs);
    setRevealedPrivileges(new Set());
    setShowPrivilegeScreen(true);
  };

  const handleSelectPrivilegeCard = (index: number) => {
    if (revealedPrivileges.has(index)) return;
    setRevealedPrivileges((prev) => new Set([...prev, index]));
    triggerFireworks();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (winnerPopup) {
          handleContinueSpin();
        } else if (showPrivilegeScreen) {
          setShowPrivilegeScreen(false);
          setCurrentPrivilegeWinner(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else if (isEditingSubject) {
          setIsEditingSubject(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFullscreen,
    winnerPopup,
    showPrivilegeScreen,
    isEditingSubject,
    handleContinueSpin,
  ]);

  const handleAddManualNames = () => {
    if (!manualNames.trim()) return;
    const count = manualNames
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean).length;
    addManualNames(manualNames);
    setManualNames("");
    toast.success(`Đã thêm ${count} tên vào danh sách!`);
  };

  const handleUseDbStudents = () => {
    fetchDbStudents();
    toast.success("Đã đồng bộ danh sách học sinh từ hệ thống!");
  };

  const handleResetList = () => {
    resetList();
    toast.success("Đã đặt lại danh sách tham gia!");
  };

  const triggerFireworks = () => {
    const duration = 2.5 * 1000;
    const animationEnd = new Date().getTime() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
    };

    const interval: NodeJS.Timeout = setInterval(() => {
      const timeLeft = animationEnd - new Date().getTime();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  const spinWheel = () => {
    if (activeStudents.length === 0) return;
    if (!beginDraw()) return; // another draw already in progress (this tool or another)

    const total = activeStudents.length;
    const { item: selectedStudent, index: randomIndex } =
      getRandomItem(activeStudents);

    const sliceAngle = 360 / total;
    const targetSliceAngle = 360 - (randomIndex * sliceAngle + sliceAngle / 2);
    const currentMod = currentRotation % 360;
    const extraSpins = 360 * 8;

    const newRotation =
      currentRotation +
      (extraSpins + ((((targetSliceAngle - currentMod) % 360) + 360) % 360));

    setSpinning(true);
    setWheelMessage("Đang quay...");
    setCurrentRotation(newRotation);

    setTimeout(() => {
      setWheelMessage(`🎉 Chúc mừng: ${selectedStudent.name}!`);
      setSpinning(false);

      setWinnerPopup(selectedStudent);

      addWinnerToHistory(selectedStudent, "spin");
      triggerFireworks();

      removeStudentFromActive(selectedStudent.id);
      endDraw();
    }, 3000);
  };

  const renderWheelSvg = (size: number = 96) => {
    const total = activeStudents.length;
    if (total === 0) {
      return <circle cx="100" cy="100" r={size} fill="#E2E8F0" />;
    }

    const angleStep = 360 / total;
    const dynamicFontSize = Math.max(3.0, Math.min(5.2, 90 / total));

    return activeStudents.map((student, index) => {
      const startAngle = index * angleStep;
      const endAngle = (index + 1) * angleStep;

      const x1 = 100 + size * Math.cos((Math.PI * (startAngle - 90)) / 180);
      const y1 = 100 + size * Math.sin((Math.PI * (startAngle - 90)) / 180);
      const x2 = 100 + size * Math.cos((Math.PI * (endAngle - 90)) / 180);
      const y2 = 100 + size * Math.sin((Math.PI * (endAngle - 90)) / 180);

      const largeArcFlag = angleStep > 180 ? 1 : 0;
      const pathData = `M100,100 L${x1},${y1} A${size},${size} 0 ${largeArcFlag},1 ${x2},${y2} Z`;

      const midAngle = startAngle + angleStep / 2;

      const textRadius = size * 0.65;
      const tx = 100 + textRadius * Math.cos((Math.PI * (midAngle - 90)) / 180);
      const ty = 100 + textRadius * Math.sin((Math.PI * (midAngle - 90)) / 180);

      let textRotation = midAngle + 90;
      if (midAngle > 90 && midAngle < 270) {
        textRotation += 180;
      }

      return (
        <g key={student.id + index}>
          <path
            d={pathData}
            fill={COLORS[index % COLORS.length]}
            stroke="#ffffff"
            strokeWidth="0.8"
          />
          <text
            x={tx}
            y={ty}
            fill="#ffffff"
            fontSize={dynamicFontSize}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${textRotation}, ${tx}, ${ty})`}
            style={{ textShadow: "0px 1px 3px rgba(0,0,0,0.9)" }}
          >
            {student.name}
          </text>
        </g>
      );
    });
  };

  const fullscreenGameContent = (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto py-8">
      <div className="flex items-center justify-between w-full mb-6 px-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 flex items-center justify-center scale-125">
            {meta.icon}
          </span>
          <div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              {meta.title} —{" "}
              <span className="text-amber-400">{selectedSubject}</span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => setIsFullscreen(false)}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-white/20 shadow-lg"
        >
          ✕ Thu nhỏ
        </button>
      </div>

      {activeStudents.length === 0 ? (
        <p className="text-lg text-slate-300 text-center py-20">
          Chưa còn học sinh nào trong danh sách môn {selectedSubject}.
        </p>
      ) : (
        <div className="flex flex-col items-center py-4">
          <div className="relative w-120 h-120 sm:w-135 sm:h-135 flex items-center justify-center my-4">
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-30 w-0 h-0 border-l-14 border-l-transparent border-r-14 border-r-transparent border-t-30 border-t-emerald-500 drop-shadow-2xl" />

            <div className="w-full h-full rounded-full overflow-hidden shadow-2xl relative bg-white border-4 border-amber-400">
              <div
                className="w-full h-full rounded-full relative"
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                  transition: spinning
                    ? "transform 3s cubic-bezier(0.15, 0.85, 0.15, 1)"
                    : "none",
                }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {renderWheelSvg(96)}
                </svg>
              </div>

              <button
                onClick={spinWheel}
                disabled={spinning}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-24 h-24 bg-white hover:bg-slate-50 text-slate-800 rounded-full border-4 border-slate-300 shadow-2xl flex flex-col items-center justify-center font-black hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-80"
              >
                <span className="text-emerald-600 leading-none text-base font-black">
                  SPIN
                </span>
                <span className="text-xs text-slate-400 font-bold mt-1">
                  Click
                </span>
              </button>
            </div>
          </div>

          <div className="mt-6 px-8 py-3.5 bg-amber-500/20 border-2 border-amber-400/60 rounded-3xl text-center min-w-85 shadow-xl backdrop-blur-md">
            <p className="text-xl font-black text-amber-300 m-0 tracking-wide">
              {wheelMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isFullscreen ? (
        <div className="fixed inset-0 z-50 bg-slate-950 backdrop-blur-xl p-6 overflow-y-auto flex items-center justify-center">
          {fullscreenGameContent}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-lg shadow-amber-950/5 border border-amber-200 flex flex-col justify-between relative">
            <div>
              <div className="flex flex-col gap-2.5 bg-amber-50/60 border border-amber-200  px-4 py-3 rounded-xl mb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-800 shrink-0">
                    Chọn môn học:
                  </span>
                  <div className="flex items-center gap-1.5 w-full max-w-70">
                    <select
                      value={isCustomSubject ? "Khác" : selectedSubject}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "Khác") {
                          setIsCustomSubject(true);
                          setCustomSubjectInput("");
                        } else {
                          setIsCustomSubject(false);
                          handleSubjectChange(val);
                        }
                      }}
                      className="w-full text-xs font-bold text-slate-700 bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs truncate"
                    >
                      {subjectsList.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="Khác">Khác (Tự nhập)...</option>
                    </select>

                    <button
                      onClick={() => {
                        setEditSubjectNameInput(selectedSubject);
                        setIsEditingSubject(true);
                      }}
                      title="Chỉnh sửa tên môn học này"
                      className="p-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-700 rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {isCustomSubject && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      placeholder="Nhập tên môn học mới..."
                      className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => {
                        const trimmed = customSubjectInput.trim();
                        if (!trimmed) return;
                        if (!subjectsList.includes(trimmed)) {
                          setSubjectsList((prev) => [...prev, trimmed]);
                        }
                        handleSubjectChange(trimmed);
                        setIsCustomSubject(false);
                        toast.success(`Đã thêm môn "${trimmed}"!`);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>

              <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 flex items-center justify-center">
                    {meta.icon}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
                      {meta.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsFullscreen(true)}
                  title="Phóng to toàn màn hình cho học sinh xem"
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
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Phòng học lớn</span>
                </button>
              </div>

              <div className="bg-amber-50/40 p-5 rounded-3xl border border-amber-100/60">
                {activeStudents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-16">
                    Chưa còn học sinh nào trong danh sách môn {selectedSubject}.
                    Hãy bấm &quot;Đặt lại&quot; ở cột phải.
                  </p>
                ) : (
                  <div className="flex flex-col items-center py-2">
                    <div className="relative w-85 h-85 sm:w-95 sm:h-95 flex items-center justify-center my-2">
                      <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 z-30 w-0 h-0 border-l-10 border-l-transparent border-r-10 border-r-transparent border-t-22 border-t-emerald-600 drop-shadow-md" />

                      <div className="w-full h-full rounded-full overflow-hidden shadow-2xl relative bg-white">
                        <div
                          className="w-full h-full rounded-full relative"
                          style={{
                            transform: `rotate(${currentRotation}deg)`,
                            transition: spinning
                              ? "transform 3s cubic-bezier(0.15, 0.85, 0.15, 1)"
                              : "none",
                          }}
                        >
                          <svg viewBox="0 0 200 200" className="w-full h-full">
                            {renderWheelSvg(96)}
                          </svg>
                        </div>

                        <button
                          onClick={spinWheel}
                          disabled={spinning}
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-white hover:bg-slate-50 text-slate-800 rounded-full border-4 border-slate-200 shadow-xl flex flex-col items-center justify-center font-black text-[11px] hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-80"
                        >
                          <span className="text-emerald-600 leading-none text-xs font-extrabold">
                            SPIN
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            Click
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 mb-2 px-6 py-2.5 bg-white border border-amber-200 rounded-xl text-center min-w-65 shadow-2xs">
                      <p className="text-sm font-extrabold text-amber-800 m-0">
                        {wheelMessage}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-lg shadow-amber-950/5 border border-amber-200 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-extrabold text-slate-800">
                    Lịch sử trúng thưởng ({selectedSubject})
                  </h4>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {
                      winnerHistories.filter(
                        (h) => h.subject === selectedSubject,
                      ).length
                    }{" "}
                    lượt
                  </span>
                </div>
                <button
                  onClick={() => setConfirmClearHistory(true)}
                  title="Xóa lịch sử"
                  disabled={
                    winnerHistories.filter((h) => h.subject === selectedSubject)
                      .length === 0
                  }
                  className="py-1.5 px-3 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <span>Xóa</span>
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 h-95 overflow-y-auto space-y-1.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
                {winnerHistories.filter((h) => h.subject === selectedSubject)
                  .length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-4">
                    Chưa có học sinh nào trúng ở môn này.
                  </p>
                ) : (
                  winnerHistories
                    .filter((h) => h.subject === selectedSubject)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-100 text-xs shadow-2xs"
                      >
                        <span className="font-bold text-slate-700">
                          🎓 {item.studentName}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {item.timestamp}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-extrabold text-slate-800">
                  Danh sách tham gia ({selectedSubject})
                </h3>
                {!DEFAULT_SUBJECTS.includes(selectedSubject) && (
                  <button
                    onClick={() => setConfirmDeleteSubject(true)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs cursor-pointer"
                  >
                    Xóa môn này
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Còn lại {activeStudents.length} học sinh trong vòng quay môn
                này.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Thêm tên thủ công vào môn này
                  </label>
                  <textarea
                    rows={3}
                    value={manualNames}
                    onChange={(e) => setManualNames(e.target.value)}
                    placeholder="Mỗi tên một dòng"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={handleAddManualNames}
                    className="w-full py-2 text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs cursor-pointer text-center truncate px-1"
                  >
                    Thêm tên
                  </button>
                  <button
                    onClick={handleUseDbStudents}
                    className="w-full py-2 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs cursor-pointer text-center truncate px-1"
                  >
                    Đồng bộ DB
                  </button>
                  <button
                    onClick={handleResetList}
                    className="w-full py-2 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs cursor-pointer text-center truncate px-1"
                  >
                    Đặt lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingSubject && (
        <div
          className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsEditingSubject(false)}
        >
          <div
            className="bg-white rounded-3xl  p-6 max-w-sm w-full shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Chỉnh sửa tên môn học
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Nhập lại tên đúng nếu trước đó bạn lỡ gõ nhầm.
            </p>

            <input
              type="text"
              value={editSubjectNameInput}
              onChange={(e) => setEditSubjectNameInput(e.target.value)}
              placeholder="Tên môn học mới..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-amber-500 mb-5 font-semibold text-slate-800"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEditedSubjectName();
              }}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingSubject(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEditedSubjectName}
                className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}

      {winnerPopup && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={handleContinueSpin}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng (X) ở góc */}
            <button
              onClick={handleContinueSpin}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shadow-xs hover:bg-slate-200 transition-all cursor-pointer"
            >
              ✕
            </button>

            {/* Icon vòng quay */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner bg-indigo-100 text-indigo-600">
              🎡
            </div>

            {/* Tiêu đề loại */}
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border mb-2 text-indigo-600 bg-indigo-50 border-indigo-200">
              Vòng quay may mắn
            </span>

            {/* Tên người trúng thưởng */}
            <h3 className="text-2xl font-black text-slate-900 mb-1">
              {winnerPopup.name}
            </h3>

            {/* Môn học */}
            <p className="text-xs text-slate-500 mb-8">
              Môn học:{" "}
              <span className="font-semibold text-slate-700">
                {selectedSubject}
              </span>
            </p>

            {/* Cụm nút bấm nằm chung trong 1 khối */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={handleContinueSpin}
                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer border border-slate-200 shadow-xs"
              >
                Tiếp tục
              </button>
              <button
                onClick={() => handleOpenPrivilege(winnerPopup)}
                className="py-3.5 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30"
              >
                Đặc quyền
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivilegeScreen && currentPrivilegeWinner && (
        <div
          className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => {
            setShowPrivilegeScreen(false);
            setCurrentPrivilegeWinner(null);
          }}
        >
          <div
            className="bg-slate-900 border border-amber-500/30 rounded-3xl  p-6 max-w-xl w-full relative shadow-2xl flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowPrivilegeScreen(false);
                setCurrentPrivilegeWinner(null);
              }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold flex items-center justify-center transition-all cursor-pointer border border-slate-700"
            >
              ✕
            </button>

            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-400/30 mb-2">
              Kho báu đặc quyền
            </span>
            <h3 className="text-xl font-black text-white mb-1">
              Học sinh:{" "}
              <span className="text-amber-400">
                {currentPrivilegeWinner.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Hãy chọn 1 ô thẻ bí mật bên dưới để khám phá đặc quyền nhận được!
            </p>

            <div className="grid grid-cols-4 gap-3 w-full mb-6">
              {activePrivileges.map((privilegeText, i) => {
                const isRevealed = revealedPrivileges.has(i);

                return (
                  <div
                    key={i}
                    onClick={() => handleSelectPrivilegeCard(i)}
                    className={`aspect-4/5 rounded-3xl relative flex flex-col items-center justify-center p-3 text-white font-bold text-xs shadow-xl transition-all duration-300 cursor-pointer select-none ${
                      isRevealed
                        ? "bg-linear-to-br from-amber-500 to-orange-600 text-slate-950 scale-105 ring-2 ring-amber-300 shadow-amber-500/30"
                        : "bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/50"
                    }`}
                  >
                    {isRevealed ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-2xl mb-1">✨</span>
                        <span className="text-[11px] font-black text-white leading-tight">
                          {privilegeText}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-amber-400 mb-1">
                          ?
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Mở thẻ
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowPrivilegeScreen(false);
                setCurrentPrivilegeWinner(null);
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              Hoàn tất & Đóng
            </button>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA LỊCH SỬ TRÚNG THƯỞNG */}
      {confirmClearHistory && (
        <div className="fixed inset-0 z-80 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa lịch sử trúng thưởng?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ lịch sử trúng thưởng của môn{" "}
                <strong className="text-slate-800">
                  &quot;{selectedSubject}&quot;
                </strong>{" "}
                sẽ bị xóa. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearHistory(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmClearHistory}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA MÔN HỌC */}
      {confirmDeleteSubject && (
        <div className="fixed inset-0 z-80 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa môn học này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa môn{" "}
                <strong className="text-slate-800">
                  &quot;{selectedSubject}&quot;
                </strong>{" "}
                không? Danh sách tham gia và lịch sử trúng thưởng của môn này
                cũng sẽ không còn hiển thị. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteSubject(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubject}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
