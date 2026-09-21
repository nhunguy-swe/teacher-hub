"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import confetti from "canvas-confetti";
import {
  StudentItem,
  DEFAULT_SUBJECTS,
  PRIVILEGES_LIST,
  getRandomItem,
  randomInRange,
} from "@/lib/types";
import { useLuckyDraw } from "@/components/admin/AdminLuckyDrawContext";

const CardIcon = () => (
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
    className="lucide lucide-playing-cards"
  >
    <path d="M14.832 8.445a1 1 0 00-1.589-.098l-2.075 3.098a1 1 0 000 1.11l2 3a1 1 0 001.664 0l2-3a1 1 0 000-1.11z" />
    <path d="m7.18 20.827-5-11a2 2 0 01.993-2.647L7 5.44" />
    <rect x="7" y="2" width="14" height="20" rx="2" />
  </svg>
);

export default function AdminLuckyDrawCard() {
  const toast = useToast();
  const meta = {
    icon: <CardIcon />,
    title: "Rút thẻ",
    desc: "Chạm vào lá bài để lật rút học sinh",
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Lá bài lật ngay tại chỗ: isFlipped = đang hiện mặt kết quả
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardResult, setCardResult] = useState<StudentItem | null>(null);

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
    setIsFlipped(false);
    setCardResult(null);
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

  // Lật thẻ về mặt úp để sẵn sàng rút lượt tiếp theo
  const handleFlipBack = () => {
    if (spinning) return;
    setIsFlipped(false);
    setCardResult(null);
  };

  const handleOpenPrivilege = (student: StudentItem) => {
    setCurrentPrivilegeWinner(student);
    const shuffledPrivs = [...PRIVILEGES_LIST]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setActivePrivileges(shuffledPrivs);
    setRevealedPrivileges(new Set());
    setShowPrivilegeScreen(true);
  };

  const handleClosePrivilege = () => {
    setShowPrivilegeScreen(false);
    setCurrentPrivilegeWinner(null);
    // Sau khi xong đặc quyền, úp thẻ lại để sẵn sàng rút tiếp
    setIsFlipped(false);
    setCardResult(null);
  };

  const handleSelectPrivilegeCard = (index: number) => {
    if (revealedPrivileges.has(index)) return;
    setRevealedPrivileges((prev) => new Set([...prev, index]));
    triggerFireworks();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPrivilegeScreen) {
          handleClosePrivilege();
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else if (isEditingSubject) {
          setIsEditingSubject(false);
        } else if (isFlipped) {
          handleFlipBack();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, showPrivilegeScreen, isEditingSubject, isFlipped]);

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
    setIsFlipped(false);
    setCardResult(null);
    toast.success("Đã đồng bộ danh sách học sinh từ hệ thống!");
  };

  const handleResetList = () => {
    resetList();
    setIsFlipped(false);
    setCardResult(null);
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

  const drawCard = () => {
    if (activeStudents.length === 0) return;
    if (!beginDraw()) return; // another draw already in progress (this tool or another)

    setSpinning(true);
    setCardResult(null);

    let currentStep = 0;
    const maxSteps = 38;
    const intervalTime = 80;

    const interval = setInterval(() => {
      currentStep++;
      const { item: randomStudent } = getRandomItem(activeStudents);
      setCardResult(randomStudent);

      if (currentStep >= maxSteps) {
        clearInterval(interval);

        const { item: selected } = getRandomItem(activeStudents);

        setCardResult(selected);
        setSpinning(false);
        setIsFlipped(true);

        addWinnerToHistory(selected, "card");
        triggerFireworks();

        removeStudentFromActive(selected.id);
        endDraw();
      }
    }, intervalTime);
  };

  // Click vào lá bài: chưa lật + chưa quay -> rút; đã lật -> úp lại để rút tiếp
  const handleCardClick = () => {
    if (spinning) return;
    if (isFlipped) {
      handleFlipBack();
      return;
    }
    drawCard();
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
        <div className="flex flex-col items-center py-6">
          <div
            className="w-72 h-110 select-none"
            style={{ perspective: "1400px" }}
          >
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transition: "transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1)",
              }}
            >
              {/* MẶT ÚP */}
              <div
                onClick={handleCardClick}
                style={{ backfaceVisibility: "hidden" }}
                className={`absolute inset-0 rounded-3xl flex flex-col justify-between p-8 shadow-2xl border-4 border-amber-400 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                  spinning
                    ? "bg-linear-to-br from-indigo-950 via-slate-900 to-amber-950 text-white shadow-indigo-950/60 animate-pulse"
                    : "bg-linear-to-br from-indigo-900 via-slate-900 to-amber-950 text-white shadow-indigo-950/50"
                }`}
              >
                <div className="absolute inset-3 border border-amber-400/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                  <span className="text-amber-400 text-sm font-mono">♠</span>
                  <span className="text-amber-400 text-sm font-mono self-end">
                    ♣
                  </span>
                </div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent opacity-80" />

                <div className="mt-6 text-amber-400 text-sm font-black tracking-widest uppercase text-center">
                  LUCKY CARD
                </div>

                <div className="flex flex-col items-center justify-center text-center my-auto z-10">
                  <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-5xl shadow-xl shadow-amber-500/30 mb-4">
                    🃏
                  </div>
                  <p className="font-black text-2xl text-amber-100 m-0 leading-snug">
                    {spinning && cardResult ? cardResult.name : "Chạm để rút"}
                  </p>
                </div>

                <div className="mb-4 text-center z-10">
                  <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30">
                    {selectedSubject}
                  </span>
                </div>
              </div>

              {/* MẶT KẾT QUẢ */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                className="absolute inset-0 rounded-3xl bg-white flex flex-col justify-between p-5 shadow-2xl border-4 border-rose-400 overflow-hidden select-none"
              >
                {/* 1. GÓC TRÊN BÊN TRÁI: Ký hiệu lá bài */}
                <div className="flex items-start justify-between w-full">
                  <div className="flex flex-col items-center leading-none text-rose-600 font-black">
                    <span className="text-lg">
                      {cardResult
                        ? cardResult.name.charAt(0).toUpperCase()
                        : ""}
                    </span>
                    <span className="text-xs">♦</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold">
                    Rút thẻ
                  </span>
                </div>

                {/* 2. NỘI DUNG TRUNG TÂM */}
                <div
                  onClick={handleCardClick}
                  className="flex-1 flex flex-col items-center justify-center text-center cursor-pointer my-2"
                >
                  <div className="relative w-16 h-16 rounded-2xl bg-linear-to-tr from-rose-200 to-red-100 text-rose-800 font-black text-2xl flex items-center justify-center mb-2 shadow-md ring-4 ring-rose-50">
                    <span className="absolute inset-0 rounded-2xl border-2 border-rose-300/50 animate-ping" />
                    {cardResult ? cardResult.name.charAt(0).toUpperCase() : ""}
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-rose-600 font-extrabold mb-0.5">
                    Chúc mừng bạn
                  </p>
                  <p className="font-black text-slate-900 text-base m-0 leading-snug px-1">
                    {cardResult?.name}
                  </p>
                  <span className="text-slate-400 text-xs font-semibold mt-0.5">
                    Môn: {selectedSubject}
                  </span>
                </div>

                {/* 3. GÓC DƯỚI BÊN PHẢI: Ký hiệu lá bài đảo ngược 180 độ chuẩn bài Tây */}
                <div className="flex items-end justify-between w-full">
                  <span className="text-[10px] text-slate-400">
                    Chạm để úp lại
                  </span>
                  <div className="flex flex-col items-center leading-none text-rose-600 font-black rotate-180">
                    <span className="text-lg">
                      {cardResult
                        ? cardResult.name.charAt(0).toUpperCase()
                        : ""}
                    </span>
                    <span className="text-xs">♦</span>
                  </div>
                </div>

                {/* 4. NÚT MỞ ĐẶC QUYỀN */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cardResult) handleOpenPrivilege(cardResult);
                  }}
                  className="w-full mt-2 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-linear-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-rose-500/30 active:scale-95"
                >
                  Mở đặc quyền
                </button>
              </div>
            </div>
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
                  <div className="flex flex-col items-center py-4">
                    <div
                      className="w-56 h-80 select-none"
                      style={{ perspective: "1200px" }}
                    >
                      <div
                        className="relative w-full h-full"
                        style={{
                          transformStyle: "preserve-3d",
                          transform: isFlipped
                            ? "rotateY(180deg)"
                            : "rotateY(0deg)",
                          transition:
                            "transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1)",
                        }}
                      >
                        {/* MẶT ÚP */}
                        <div
                          onClick={handleCardClick}
                          style={{ backfaceVisibility: "hidden" }}
                          className={`absolute inset-0 rounded-3xl flex flex-col justify-between p-6 shadow-xl border-4 border-amber-400 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                            spinning
                              ? "bg-linear-to-br from-indigo-950 via-slate-900 to-amber-950 text-white shadow-indigo-950/50 animate-pulse"
                              : "bg-linear-to-br from-indigo-900 via-slate-900 to-amber-950 text-white shadow-indigo-950/30"
                          }`}
                        >
                          <div className="absolute inset-2 border border-amber-400/30 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                            <span className="text-amber-400 text-xs font-mono">
                              ♠
                            </span>
                            <span className="text-amber-400 text-xs font-mono self-end">
                              ♣
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-60" />

                          <div className="mt-2 text-amber-400 text-xs font-bold tracking-widest uppercase text-center">
                            LUCKY CARD
                          </div>

                          <div className="flex flex-col items-center justify-center text-center my-auto z-10">
                            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20 mb-3">
                              🃏
                            </div>
                            <p className="font-bold text-base text-amber-100 m-0 leading-snug">
                              {spinning && cardResult
                                ? cardResult.name
                                : "Chạm để rút"}
                            </p>
                          </div>

                          <div className="mb-2 text-center z-10">
                            <span className="text-[10px] text-slate-300 font-medium">
                              {selectedSubject}
                            </span>
                          </div>
                        </div>

                        {/* MẶT KẾT QUẢ */}
                        <div
                          style={{
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                          }}
                          className="absolute inset-0 rounded-3xl bg-white flex flex-col p-4 shadow-xl border-4 border-rose-400 overflow-hidden justify-between"
                        >
                          {/* 1. GÓC TRÊN BÊN TRÁI: Ký hiệu lá bài chuẩn */}
                          <div className="flex flex-col items-center leading-none text-rose-600 font-black w-fit">
                            <span className="text-base">
                              {cardResult
                                ? cardResult.name.charAt(0).toUpperCase()
                                : ""}
                            </span>
                            <span className="text-[10px]">♦</span>
                          </div>

                          {/* 2. NỘI DUNG CHÍNH Ở GIỮA */}
                          <div
                            onClick={handleCardClick}
                            className="flex flex-col items-center justify-center text-center cursor-pointer my-auto"
                          >
                            <div className="relative w-14 h-14 rounded-2xl bg-linear-to-tr from-rose-200 to-red-100 text-rose-800 font-black text-xl flex items-center justify-center mb-1.5 shadow-md ring-4 ring-rose-50">
                              <span className="absolute inset-0 rounded-2xl border-2 border-rose-300/50 animate-ping" />
                              {cardResult
                                ? cardResult.name.charAt(0).toUpperCase()
                                : ""}
                            </div>
                            <p className="text-[9px] uppercase tracking-widest text-rose-600 font-extrabold mb-0.5">
                              Chúc mừng bạn
                            </p>
                            <p className="font-black text-slate-900 text-sm m-0 leading-snug px-1 line-clamp-1">
                              {cardResult?.name}
                            </p>
                            <span className="text-slate-400 text-[11px] font-semibold mt-0.5">
                              Môn: {selectedSubject}
                            </span>
                          </div>

                          {/* 3. KHU VỰC DƯỚI: Chữ "Chạm để úp" và Góc dưới bên phải đảo ngược 180 độ */}
                          <div className="flex items-end justify-between w-full">
                            <span className="text-[9px] text-slate-400 pb-0.5">
                              Chạm để úp lại
                            </span>
                            <div className="flex flex-col items-center leading-none text-rose-600 font-black rotate-180 w-fit">
                              <span className="text-base">
                                {cardResult
                                  ? cardResult.name.charAt(0).toUpperCase()
                                  : ""}
                              </span>
                              <span className="text-[10px]">♦</span>
                            </div>
                          </div>

                          {/* 4. NÚT MỞ ĐẶC QUYỀN */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cardResult) handleOpenPrivilege(cardResult);
                            }}
                            className="w-full mt-1.5 py-2 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-linear-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-rose-500/30 active:scale-95"
                          >
                            Mở đặc quyền
                          </button>
                        </div>
                      </div>
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
                  title="Reset lịch sử"
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

      {showPrivilegeScreen && currentPrivilegeWinner && (
        <div
          className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={handleClosePrivilege}
        >
          <div
            className="bg-slate-900 border border-amber-500/30 rounded-3xl  p-6 max-w-xl w-full relative shadow-2xl flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClosePrivilege}
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
                    className={`aspect-4/5 rounded-3xl  relative flex flex-col items-center justify-center p-3 text-white font-bold text-xs shadow-xl transition-all duration-300 cursor-pointer select-none ${
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
              onClick={handleClosePrivilege}
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
