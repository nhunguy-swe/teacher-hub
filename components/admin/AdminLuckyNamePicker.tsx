"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import confetti from "canvas-confetti";
import { StudentItem, DEFAULT_SUBJECTS, randomInRange } from "@/lib/types";
import { useLuckyDraw } from "@/components/admin/AdminLuckyDrawContext";
import { useLuckySounds, LUCKY_SOUNDS } from "@/lib/useLuckySounds";
import PrivilegeManager from "@/components/admin/PrivilegeManager";

// 30 bước x 80ms, khớp với vòng lặp trong handleCallNames
const CALL_STEPS = 30;
const CALL_INTERVAL_MS = 80;
const CALL_DURATION_MS = CALL_STEPS * CALL_INTERVAL_MS;
const MAX_PICK = 10;

const AVATARS = ["😺", "🐶", "🐺", "🦁", "🐷", "🐻", "🐼", "🦊", "🐯", "🐰"];

const GroupIcon = () => (
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
  >
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

// Chọn ngẫu nhiên `n` học sinh KHÁC NHAU từ danh sách
const sampleStudents = (list: StudentItem[], n: number) =>
  [...list].sort(() => Math.random() - 0.5).slice(0, n);

function StudentCard({
  student,
  avatar,
  size,
  highlight,
  onPrivilege,
}: {
  student: StudentItem | null;
  avatar: string;
  size: "sm" | "lg";
  highlight: boolean;
  onPrivilege?: (s: StudentItem) => void;
}) {
  const lg = size === "lg";
  return (
    <div
      className={`flex flex-col items-center bg-white rounded-3xl border-2 transition-all duration-300 ${
        highlight
          ? "border-amber-400 shadow-xl shadow-amber-500/30 scale-[1.03]"
          : "border-slate-100 shadow-md"
      } ${lg ? "p-4 gap-2" : "p-3 gap-2"}`}
    >
      <p
        className={`font-black text-slate-900 text-center leading-tight line-clamp-2 w-full ${
          lg ? "text-lg min-h-12" : "text-xs min-h-8"
        }`}
      >
        {student?.name ?? "?"}
      </p>

      {/* Khung lục giác */}
      <div
        className="flex items-center justify-center bg-amber-300"
        style={{
          width: lg ? 120 : 76,
          height: lg ? 136 : 86,
          clipPath:
            "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      >
        <div
          className="flex items-center justify-center bg-amber-50"
          style={{
            width: "94%",
            height: "94%",
            fontSize: lg ? 52 : 32,
            clipPath:
              "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          }}
        >
          {student ? avatar : "❔"}
        </div>
      </div>

      {onPrivilege && student && (
        <button
          onClick={() => onPrivilege(student)}
          className={`w-full text-white font-extrabold rounded-xl bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 shadow-md shadow-amber-500/30 active:scale-95 transition-all cursor-pointer ${
            lg ? "py-2 text-sm" : "py-1.5 text-[10px]"
          }`}
        >
          Đặc quyền
        </button>
      )}
    </div>
  );
}

export default function AdminLuckyNamePicker() {
  const toast = useToast();
  const meta = {
    icon: <GroupIcon />,
    title: "Gọi tên theo nhóm",
    desc: "Gọi cùng lúc nhiều học sinh lên trả bài",
  };

  const {
    subjectsList,
    setSubjectsList,
    selectedSubject,
    setSelectedSubject,
    renameSubject,
    deleteSubject,
    activeStudents,
    removeStudentsFromActive,
    addManualNames,
    fetchDbStudents,
    resetList,
    winnerHistories,
    addWinnerToHistory,
    clearHistoryForSelectedSubject,
    beginDraw,
    endDraw,
    privileges,
  } = useLuckyDraw();

  const { playSpinSound, stopSpinSound, playWinSound } = useLuckySounds({
    spinSrc: LUCKY_SOUNDS.card,
    spinDurationMs: CALL_DURATION_MS,
  });

  const [manualNames, setManualNames] = useState("");
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editSubjectNameInput, setEditSubjectNameInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Số bạn được gọi mỗi lượt
  const [pickCount, setPickCount] = useState(3);
  const [calling, setCalling] = useState(false);
  const [pickedList, setPickedList] = useState<StudentItem[]>([]);
  const [avatarOrder, setAvatarOrder] = useState<string[]>(AVATARS);
  const [isFinal, setIsFinal] = useState(false); // true = kết quả cuối, false = đang xáo

  const [showPrivilegeScreen, setShowPrivilegeScreen] = useState(false);
  const [activePrivileges, setActivePrivileges] = useState<string[]>([]);
  const [revealedPrivileges, setRevealedPrivileges] = useState<Set<number>>(
    new Set(),
  );
  const [currentPrivilegeWinner, setCurrentPrivilegeWinner] =
    useState<StudentItem | null>(null);

  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState(false);

  const maxPick = Math.max(1, Math.min(MAX_PICK, activeStudents.length));
  const effectiveCount = Math.min(pickCount, maxPick);

  const resetResult = () => {
    setPickedList([]);
    setIsFinal(false);
  };

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    resetResult();
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

  const handleConfirmClearHistory = () => {
    clearHistoryForSelectedSubject();
    setConfirmClearHistory(false);
    toast.success(`Đã xóa lịch sử trúng thưởng môn "${selectedSubject}"!`);
  };

  const handleConfirmDeleteSubject = () => {
    const subjectName = selectedSubject;
    deleteSubject(subjectName);
    setConfirmDeleteSubject(false);
    resetResult();
    toast.success(`Đã xóa môn "${subjectName}"!`);
  };

  const handleOpenPrivilege = (student: StudentItem) => {
    if (privileges.length === 0) {
      toast.warning("Chưa có đặc quyền nào. Hãy thêm ở mục Quản lý đặc quyền!");
      return;
    }
    setCurrentPrivilegeWinner(student);
    setActivePrivileges(
      [...privileges].sort(() => Math.random() - 0.5).slice(0, 8),
    );
    setRevealedPrivileges(new Set());
    setShowPrivilegeScreen(true);
  };

  const closePrivilege = () => {
    setShowPrivilegeScreen(false);
    setCurrentPrivilegeWinner(null);
  };

  const handleSelectPrivilegeCard = (index: number) => {
    if (revealedPrivileges.has(index)) return;
    setRevealedPrivileges((prev) => new Set([...prev, index]));
    playWinSound();
    triggerFireworks();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showPrivilegeScreen) closePrivilege();
      else if (isFullscreen) setIsFullscreen(false);
      else if (isEditingSubject) setIsEditingSubject(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, showPrivilegeScreen, isEditingSubject]);

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
    resetResult();
    toast.success("Đã đồng bộ danh sách học sinh từ hệ thống!");
  };

  const handleResetList = () => {
    resetList();
    resetResult();
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
      if (timeLeft <= 0) return clearInterval(interval);
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

  const handleCallNames = () => {
    if (activeStudents.length === 0) return;
    if (!beginDraw()) return;

    const n = Math.min(pickCount, activeStudents.length);
    // Chụp lại danh sách tại thời điểm bấm để kết quả không bị đổi giữa chừng
    const pool = [...activeStudents];

    // Xáo 10 hình, mỗi thẻ lấy 1 hình theo vị trí => không bao giờ trùng
    setAvatarOrder([...AVATARS].sort(() => Math.random() - 0.5));
    setCalling(true);
    setIsFinal(false);
    setPickedList(sampleStudents(pool, n));
    playSpinSound();

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setPickedList(sampleStudents(pool, n));
      // Hình cũng xáo mỗi bước, chạy cùng nhịp với tên
      setAvatarOrder([...AVATARS].sort(() => Math.random() - 0.5));

      if (step >= CALL_STEPS) {
        clearInterval(interval);

        const winners = sampleStudents(pool, n);
        setPickedList(winners);
        // Chốt hình cuối cùng cho kết quả
        setAvatarOrder([...AVATARS].sort(() => Math.random() - 0.5));
        setIsFinal(true);
        setCalling(false);
        stopSpinSound();
        playWinSound();
        triggerFireworks();

        winners.forEach((w) => addWinnerToHistory(w, "namepicker"));
        // Xóa tất cả trong 1 lần ghi để không bị ghi đè lẫn nhau
        removeStudentsFromActive(winners.map((w) => w.id));
        endDraw();
      }
    }, CALL_INTERVAL_MS);
  };

  const changeCount = (next: number) => {
    if (calling) return;
    setPickCount(Math.max(1, Math.min(maxPick, next)));
    resetResult(); // bỏ kết quả cũ, hiện lại các thẻ trống theo số lượng mới
  };

  const renderCountPicker = (big?: boolean) => (
    <div
      className={`flex items-center bg-slate-100 rounded-2xl overflow-hidden ${
        big ? "h-14" : "h-10"
      }`}
    >
      <button
        onClick={() => changeCount(effectiveCount - 1)}
        disabled={calling || effectiveCount <= 1}
        className={`px-3 text-slate-600 hover:bg-slate-200 disabled:opacity-40 cursor-pointer h-full font-black ${
          big ? "text-xl px-5" : ""
        }`}
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <span
        className={`bg-white h-full flex items-center justify-center font-black text-slate-800 ${
          big ? "w-16 text-xl" : "w-10 text-sm"
        }`}
      >
        {effectiveCount}
      </span>
      <button
        onClick={() => changeCount(effectiveCount + 1)}
        disabled={calling || effectiveCount >= maxPick}
        className={`px-3 text-slate-600 hover:bg-slate-200 disabled:opacity-40 cursor-pointer h-full font-black ${
          big ? "text-xl px-5" : ""
        }`}
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );

  // Khung hiển thị: nếu chưa gọi thì hiện các thẻ trống
  const displayCards: (StudentItem | null)[] =
    pickedList.length > 0
      ? pickedList
      : Array.from({ length: effectiveCount }, () => null);

  // Độ rộng mỗi thẻ theo số lượng, để flex căn giữa được.
  // 1 thẻ có độ rộng bằng 1/3 khung, nằm chính giữa.
  // Tối đa 5 thẻ mỗi hàng. Ít hơn 5 thì chia đều theo số lượng, và luôn căn giữa.
  const cardWidth = (n: number) =>
    n <= 1
      ? "w-[calc((100%-2rem)/3)]"
      : n === 2
        ? "w-[calc((100%-1rem)/2)]"
        : n === 3
          ? "w-[calc((100%-2rem)/3)]"
          : n === 4
            ? "w-[calc((100%-3rem)/4)]"
            : "w-[calc((100%-4rem)/5-1px)]";

  const fullscreenGameContent = (
    <div className="flex flex-col w-full h-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between w-full shrink-0 px-2 sm:px-4 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 flex items-center justify-center scale-125">
            {meta.icon}
          </span>
          <h2 className="text-2xl font-black text-white tracking-wide">
            {meta.title} —{" "}
            <span className="text-amber-400">{selectedSubject}</span>
          </h2>
        </div>
        <button
          onClick={() => setIsFullscreen(false)}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-white/20 shadow-lg"
        >
          ✕ Thu nhỏ
        </button>
      </div>

      {activeStudents.length === 0 && pickedList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg text-slate-300 text-center">
            Chưa còn học sinh nào trong danh sách môn {selectedSubject}.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <div
            className="flex flex-wrap justify-center gap-4 w-full px-2"
            style={{ maxWidth: displayCards.length <= 3 ? "56rem" : "80rem" }}
          >
            {displayCards.map((s, i) => (
              <div
                key={(s?.id ?? "empty") + i}
                className={cardWidth(displayCards.length)}
              >
                <StudentCard
                  student={s}
                  avatar={avatarOrder[i % avatarOrder.length]}
                  size="lg"
                  highlight={isFinal}
                  onPrivilege={isFinal ? handleOpenPrivilege : undefined}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {renderCountPicker(true)}
            <button
              onClick={handleCallNames}
              disabled={calling || activeStudents.length === 0}
              className="h-14 px-10 bg-linear-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-amber-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calling ? "Đang gọi..." : "Gọi tên"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isFullscreen ? (
        <div className="fixed inset-0 z-50 bg-slate-950 backdrop-blur-xl p-6 overflow-y-auto flex items-center justify-center scrollbar-none [&::-webkit-scrollbar]:hidden">
          {fullscreenGameContent}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-lg shadow-amber-950/5 border border-amber-200 flex flex-col justify-between relative">
            <div>
              <div className="flex flex-col gap-2.5 bg-amber-50/60 border border-amber-200 px-4 py-3 rounded-xl mb-4">
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
                {activeStudents.length === 0 && pickedList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-16">
                    Chưa còn học sinh nào trong danh sách môn {selectedSubject}.
                    Hãy bấm &quot;Đặt lại&quot; ở cột phải.
                  </p>
                ) : (
                  <div className="flex flex-col items-center py-2 w-full gap-5">
                    <div className="flex flex-wrap justify-center gap-4 w-full">
                      {displayCards.map((s, i) => (
                        <div
                          key={(s?.id ?? "empty") + i}
                          className={cardWidth(displayCards.length)}
                        >
                          <StudentCard
                            student={s}
                            avatar={avatarOrder[i % avatarOrder.length]}
                            size="sm"
                            highlight={isFinal}
                            onPrivilege={
                              isFinal ? handleOpenPrivilege : undefined
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      {renderCountPicker()}
                      <button
                        onClick={handleCallNames}
                        disabled={calling || activeStudents.length === 0}
                        className="h-10 px-8 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        {calling ? "Đang gọi..." : "Gọi tên"}
                      </button>
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
                Còn lại {activeStudents.length} học sinh trong vòng gọi môn này.
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
                    className="w-full py-2 text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all shadow-2xs cursor-pointer text-center truncate px-1"
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

          <PrivilegeManager />
        </div>
      )}

      {isEditingSubject && (
        <div
          className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsEditingSubject(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100"
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
          className="fixed inset-0 z-70 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={closePrivilege}
        >
          <div
            className="bg-[#0f172a] border border-[#f59e0b]/40 rounded-3xl p-6 max-w-xl w-full relative shadow-2xl flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePrivilege}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#334155] text-white hover:bg-[#475569] font-bold flex items-center justify-center transition-all cursor-pointer border border-[#64748b]"
            >
              ✕
            </button>

            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-[#f59e0b]/20 text-[#fcd34d] rounded-full border border-[#f59e0b]/50 mb-2">
              Kho báu đặc quyền
            </span>
            <h3 className="text-xl font-black text-white mb-1">
              Học sinh:{" "}
              <span className="text-[#fbbf24]">
                {currentPrivilegeWinner.name}
              </span>
            </h3>
            <p className="text-xs text-[#cbd5e1] mb-6">
              Hãy chọn 1 ô thẻ bí mật bên dưới để khám phá đặc quyền nhận được!
            </p>

            <div className="grid grid-cols-4 gap-3 w-full mb-6">
              {activePrivileges.map((privilegeText, i) => {
                const isRevealed = revealedPrivileges.has(i);
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectPrivilegeCard(i)}
                    className={`aspect-4/5 rounded-3xl relative flex flex-col items-center justify-center p-3 font-bold text-xs shadow-xl transition-all duration-300 cursor-pointer select-none ${
                      isRevealed
                        ? "bg-linear-to-br from-[#fcd34d] to-[#f59e0b] scale-105 ring-2 ring-[#fde68a] shadow-[#f59e0b]/40"
                        : "bg-[#1e293b] hover:bg-[#334155] border border-[#475569] hover:border-[#fbbf24]"
                    }`}
                  >
                    {isRevealed ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-2xl mb-1">✨</span>
                        <span className="text-[11px] font-black text-[#1c1917] leading-tight">
                          {privilegeText}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-[#fbbf24] mb-1">
                          ?
                        </span>
                        <span className="text-[10px] text-[#e2e8f0] uppercase tracking-wider">
                          Mở thẻ
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={closePrivilege}
              className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-[#1c1917] font-black text-xs rounded-xl shadow-lg shadow-[#f59e0b]/30 transition-all cursor-pointer"
            >
              Hoàn tất & Đóng
            </button>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA LỊCH SỬ */}
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
