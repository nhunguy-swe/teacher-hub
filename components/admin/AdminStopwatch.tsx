"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";

interface SessionHistory {
  id: string;
  title: string;
  duration: string;
  type: "Đếm ngược" | "Bấm giờ";
  createdAt: string;
}

export default function AdminStopwatch() {
  const toast = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [countdownMinutes, setCountdownMinutes] = useState(5);
  const [customInput, setCustomInput] = useState("5");
  const [sessionTitle, setSessionTitle] = useState("Phiên bấm giờ");

  const [history, setHistory] = useState<SessionHistory[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_stopwatch_history");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Lỗi đọc lịch sử từ localStorage:", e);
        }
      }
    }
    return [];
  });

  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // State cho popup xác nhận xóa lịch sử phiên đã chọn
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);

  const [timeMs, setTimeMs] = useState(countdownMinutes * 60 * 1000);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("admin_stopwatch_history", JSON.stringify(history));
    } catch (e) {
      console.error("Lỗi ghi lịch sử vào localStorage:", e);
    }
  }, [history]);

  useEffect(() => {
    const audio = new Audio("/sounds/chuong-het-gio.mp3");
    audio.preload = "auto";
    audio.onerror = () => {
      console.error(
        "Không tải được file chuông tại /sounds/chuong-het-gio.mp3.",
      );
    };
    audioRef.current = audio;
  }, []);

  const playAlarmSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .catch((e) => console.error("Không thể phát âm thanh:", e));
      }
    } catch (e) {
      console.error("Không thể phát âm thanh:", e);
    }
  }, []);

  const saveToHistory = useCallback(
    (totalMs: number, type: "Đếm ngược" | "Bấm giờ") => {
      const totalSecs = Math.floor(totalMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const durationStr =
        `${mins > 0 ? `${mins} phút ` : ""}${secs > 0 ? `${secs} giây` : mins === 0 ? "0 giây" : ""}`.trim();

      const newSession: SessionHistory = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: sessionTitle.trim() || "Phiên bấm giờ",
        duration: durationStr,
        type: type,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setHistory((prev) => [newSession, ...prev]);
    },
    [sessionTitle],
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      const startTime = Date.now();
      const initialTimeMs = timeMs;

      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (mode === "stopwatch") {
          setTimeMs(initialTimeMs + elapsed);
        } else {
          const nextTime = initialTimeMs - elapsed;
          if (nextTime <= 0) {
            setIsRunning(false);
            setShowPopup(true);
            playAlarmSound();
            saveToHistory(countdownMinutes * 60 * 1000, "Đếm ngược");
            setTimeMs(0);
            clearInterval(interval);
          } else {
            setTimeMs(nextTime);
          }
        }
      }, 30);
    }
    return () => clearInterval(interval);
  }, [
    isRunning,
    mode,
    countdownMinutes,
    playAlarmSound,
    saveToHistory,
    timeMs,
  ]);

  const formatTimeWithMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);

    return {
      timeStr: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      msStr: milliseconds.toString().padStart(2, "0"),
    };
  };

  const handleModeChange = (newMode: "countdown" | "stopwatch") => {
    if (isRunning) setIsRunning(false);
    setMode(newMode);
    if (newMode === "countdown") {
      setTimeMs(countdownMinutes * 60 * 1000);
    } else {
      setTimeMs(0);
    }
  };

  const handleQuickMinute = (mins: number) => {
    setCountdownMinutes(mins);
    setCustomInput(mins.toString());
    if (mode === "countdown" && !isRunning) {
      setTimeMs(mins * 60 * 1000);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setCountdownMinutes(num);
      if (mode === "countdown" && !isRunning) {
        setTimeMs(num * 60 * 1000);
      }
    }
  };

  const handleStartStop = () => {
    if (!isRunning) {
      if (mode === "countdown" && timeMs === 0) {
        setTimeMs(countdownMinutes * 60 * 1000);
      }
      setIsRunning(true);
    } else {
      setIsRunning(false);
      if (mode === "stopwatch" && timeMs > 0) {
        saveToHistory(timeMs, "Bấm giờ");
      }
    }
  };

  const handleReset = () => {
    if (isRunning && mode === "stopwatch" && timeMs > 0) {
      saveToHistory(timeMs, "Bấm giờ");
    }
    setIsRunning(false);
    setTimeMs(mode === "countdown" ? countdownMinutes * 60 * 1000 : 0);
  };

  const toggleSelectHistoryItem = (id: string) => {
    setSelectedHistoryIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemKey) => itemKey !== id)
        : [...prev, id],
    );
  };

  // Xóa các phiên lịch sử đã chọn (được gọi từ popup xác nhận)
  const handleConfirmDeleteHistory = () => {
    const count = selectedHistoryIds.length;
    setHistory((prev) =>
      prev.filter((item) => !selectedHistoryIds.includes(item.id)),
    );
    setSelectedHistoryIds([]);
    setConfirmDeleteHistory(false);
    toast.success(`Đã xóa ${count} phiên khỏi lịch sử!`);
  };

  const { timeStr, msStr } = formatTimeWithMs(timeMs);

  return (
    <div className="w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* KHUNG TRÁI: Đồng hồ bấm giờ */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6 flex flex-col">
          <div className="flex flex-row justify-between items-center gap-4 pb-4 border-b border-slate-100">
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
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2" />
                <path d="M5 3L2 6" />
                <path d="M19 3l3 3" />
              </svg>
              Đồng hồ bấm giờ
            </h2>

            <button
              onClick={() => setIsFullscreen(true)}
              title="Phóng to cho lớp theo dõi"
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

          <div className="flex flex-col items-center justify-between flex-1 bg-amber-50/40 p-5 rounded-3xl border border-amber-100/60">
            {/* Thanh chọn chế độ di chuyển mượt mà */}
            <div className="relative flex bg-slate-100 p-1 rounded-full border border-slate-200/60 mb-6 shadow-inner w-64">
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-amber-500 rounded-full shadow-md transition-all duration-300 ease-in-out ${
                  mode === "countdown" ? "left-1" : "left-[calc(50%+2px)]"
                }`}
              ></div>
              <button
                onClick={() => handleModeChange("countdown")}
                className={`relative z-10 w-1/2 py-2 text-xs font-bold transition-colors duration-200 cursor-pointer text-center ${
                  mode === "countdown"
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đếm ngược
              </button>
              <button
                onClick={() => handleModeChange("stopwatch")}
                className={`relative z-10 w-1/2 py-2 text-xs font-bold transition-colors duration-200 cursor-pointer text-center ${
                  mode === "stopwatch"
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bấm giờ
              </button>
            </div>

            <div className="my-auto text-center py-4 flex items-baseline justify-center">
              <div className="text-6xl sm:text-7xl font-black text-slate-800 tracking-wider font-mono drop-shadow-sm">
                {timeStr}
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 font-mono ml-2">
                .{msStr}
              </div>
            </div>

            <div className="text-slate-500 text-xs font-medium -mt-2 mb-4">
              {isRunning ? (
                <span className="text-emerald-600 font-semibold animate-pulse">
                  Đang đếm thời gian...
                </span>
              ) : timeMs === 0 && mode === "countdown" ? (
                <span className="text-rose-500 font-semibold">
                  Đã kết thúc thời gian!
                </span>
              ) : (
                "Sẵn sàng bắt đầu"
              )}
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-75"
                style={{
                  width:
                    mode === "countdown" && countdownMinutes > 0
                      ? `${Math.max(0, Math.min(100, (timeMs / (countdownMinutes * 60 * 1000)) * 100))}%`
                      : "100%",
                }}
              ></div>
            </div>

            <div className="flex items-center justify-center gap-2.5 w-full">
              <button
                onClick={handleStartStop}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
              >
                {isRunning ? "Tạm dừng" : "Bắt đầu"}
              </button>
              <button
                onClick={handleReset}
                className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs cursor-pointer"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </div>

        {/* KHUNG PHẢI: Cấu hình & Lịch sử phiên */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6 flex flex-col h-full">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
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
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Thời lượng nhanh
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-600 block mb-1">
                Tiêu đề phiên bấm giờ
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Nhập tiêu đề phiên..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
              />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 3, 5, 10, 15].map((mVal) => (
                <button
                  key={mVal}
                  onClick={() => handleQuickMinute(mVal)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    countdownMinutes === mVal && mode === "countdown"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                  }`}
                >
                  <span className="text-sm font-black">{mVal}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    phút
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="font-semibold text-slate-600 block mb-1">
                Thời gian tùy chỉnh (phút)
              </label>
              <input
                type="number"
                min="1"
                value={customInput}
                onChange={handleCustomInputChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 m-0">
                Lịch sử phiên
              </h3>
              {selectedHistoryIds.length > 0 && (
                <button
                  onClick={() => setConfirmDeleteHistory(true)}
                  className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
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
                  Xóa đã chọn ({selectedHistoryIds.length})
                </button>
              )}
            </div>

            <div className="flex-1 min-h-35 max-h-55 overflow-y-auto pr-1 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs py-8">
                  Chưa có phiên bấm giờ.
                </div>
              ) : (
                history.map((item) => {
                  const isChecked = selectedHistoryIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectHistoryItem(item.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                        isChecked
                          ? "bg-amber-50/80 border-amber-300"
                          : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 m-0 truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-400 m-0">
                            {item.type} - {item.createdAt}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 ml-2 text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 font-bold text-amber-700">
                        {item.duration}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHẾ ĐỘ PHÓNG TO TOÀN MÀN HÌNH CHO LỚP HỌC */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#1e1b4b] text-white flex flex-col items-center justify-between p-8 sm:p-12 animate-fadeIn">
          <div className="w-full flex justify-between items-center max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xl sm:text-2xl font-bold tracking-wide text-purple-200">
                {sessionTitle}
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
            >
              <span>✕</span> Thoát phóng to
            </button>
          </div>

          <div className="text-center my-auto flex items-baseline justify-center">
            <div className="text-[22vw] sm:text-[180px] font-black font-mono tracking-wider text-transparent bg-clip-text bg-linear-to-b from-white via-purple-100 to-purple-300 drop-shadow-[0_20px_50px_rgba(245,158,11,0.5)] leading-none">
              {timeStr}
            </div>
            <div className="text-5xl sm:text-7xl font-bold font-mono text-amber-400 ml-4">
              .{msStr}
            </div>
          </div>

          <div className="text-purple-300 text-xl sm:text-2xl font-semibold mt-2 tracking-wider uppercase">
            {isRunning ? (
              <span className="animate-pulse text-emerald-400">
                ● Đang chạy thời gian hoạt động
              </span>
            ) : timeMs === 0 && mode === "countdown" ? (
              <span className="text-rose-400 font-bold text-3xl animate-bounce">
                ⏰ Đã hết giờ học!
              </span>
            ) : (
              "Đang tạm dừng"
            )}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handleStartStop}
              className={`px-8 py-4 rounded-3xl font-black text-base shadow-2xl transition-all transform active:scale-95 cursor-pointer ${
                isRunning
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isRunning ? "Tạm dừng" : "Tiếp tục / Bắt đầu"}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-4 rounded-3xl font-bold text-base bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
            >
              Đặt lại
            </button>
          </div>
        </div>
      )}

      {/* POPUP THÔNG BÁO HẾT GIỜ */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm border border-[#EFE8D8] shadow-xl space-y-4 text-center animate-scaleUp">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
              🔔
            </div>
            <h3 className="text-base font-bold text-slate-800 m-0">
              Đã hết giờ!
            </h3>
            <p className="text-slate-500 text-xs m-0">
              Phiên đếm ngược{" "}
              <span className="font-bold text-slate-700">
                &ldquo;{sessionTitle}&rdquo;
              </span>{" "}
              đã kết thúc.
            </p>
            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA LỊCH SỬ ĐÃ CHỌN */}
      {confirmDeleteHistory && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedHistoryIds.length} phiên đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">
                  {selectedHistoryIds.length}
                </strong>{" "}
                phiên bấm giờ đã chọn sẽ bị xóa khỏi lịch sử. Hành động này
                không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteHistory(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteHistory}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer"
              >
                Xóa {selectedHistoryIds.length} phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
