"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const ZONES = [
  { label: "Tuyệt vời", color: "#22C55E", max: 40 },
  { label: "Khá tốt", color: "#3B82F6", max: 65 },
  { label: "Hơi ồn", color: "#F59E0B", max: 85 },
  { label: "Quá ồn", color: "#EF4444", max: 120 },
];

function zoneFor(level: number) {
  return ZONES.find((z) => level < z.max) || ZONES[ZONES.length - 1];
}

interface HistoryBar {
  min: number;
  avg: number;
  max: number;
  color: string;
}

export default function AdminNoiseMeter() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [level, setLevel] = useState(0);
  const [hint, setHint] = useState(
    'Bấm "Bắt đầu đo" để theo dõi âm lượng thực tế của lớp học.',
  );
  const [simMode, setSimMode] = useState(false);

  const [minVal, setMinVal] = useState(0);
  const [maxVal, setMaxVal] = useState(0);
  const [avgVal, setAvgVal] = useState(0);
  const [historyBars, setHistoryBars] = useState<HistoryBar[]>([]);

  // State điều khiển chế độ phóng to toàn màn hình cho lớp theo dõi
  const [isFullscreen, setIsFullscreen] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const sensitivityRef = useRef(sensitivity);
  const mountedRef = useRef(true);

  const sampleBufferRef = useRef<number[]>([]);
  const smoothedLevelRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const updateStats = useCallback((currentLvl: number) => {
    smoothedLevelRef.current = Math.round(
      smoothedLevelRef.current * 0.8 + currentLvl * 0.2,
    );
    const displayLvl = smoothedLevelRef.current;

    setLevel(displayLvl);

    setMinVal((m) => (m === 0 ? displayLvl : Math.min(m, displayLvl)));
    setMaxVal((m) => Math.max(m, displayLvl));
    setAvgVal((a) =>
      a === 0 ? displayLvl : Math.round(a * 0.95 + displayLvl * 0.05),
    );

    sampleBufferRef.current.push(displayLvl);
  }, []);

  const loopRealRef = useRef<() => void>(() => {});

  const loopReal = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const norm = (dataArray[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    const rawLvl = rms * 300 * (sensitivityRef.current / 50);
    const lvl = Math.min(100, Math.max(30, Math.round(30 + rawLvl)));

    updateStats(lvl);

    rafRef.current = window.setTimeout(
      loopRealRef.current,
      120,
    ) as unknown as number;
  }, [updateStats]);

  useEffect(() => {
    loopRealRef.current = loopReal;
  }, [loopReal]);

  const loopSimRef = useRef<() => void>(() => {});

  const loopSim = useCallback(() => {
    const lvl = Math.min(
      100,
      Math.max(
        35,
        Math.round(50 + Math.sin(Date.now() / 600) * 15 + Math.random() * 25),
      ),
    );
    updateStats(lvl);
    rafRef.current = window.setTimeout(
      loopSimRef.current,
      250,
    ) as unknown as number;
  }, [updateStats]);

  useEffect(() => {
    loopSimRef.current = loopSim;
  }, [loopSim]);

  useEffect(() => {
    if (!running || paused) return;
    const interval = setInterval(() => {
      const samples = sampleBufferRef.current;
      if (samples.length > 0) {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = Math.round(
          samples.reduce((a, b) => a + b, 0) / samples.length,
        );
        const zone = zoneFor(avg);

        setHistoryBars((prev) => {
          const next = [...prev, { min, avg, max, color: zone.color }];
          return next.slice(-12);
        });
        sampleBufferRef.current = [];
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [running, paused]);

  const stop = useCallback(() => {
    setRunning(false);
    setPaused(false);
    if (rafRef.current) {
      clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const startMeasurement = async () => {
    if (running && !paused) return;

    // Chế độ mô phỏng: không cần micro nên chạy lại vòng lặp là được
    if (paused && simMode) {
      setPaused(false);
      setRunning(true);
      loopSim();
      setHint("Đang tiếp tục đo âm lượng...");
      return;
    }
    // Chế độ thật: pauseMeasurement đã đóng micro + AudioContext (analyserRef = null),
    // nên bên dưới sẽ mở lại micro. Min/Max/TB và biểu đồ vẫn được giữ nguyên.

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      setSimMode(false);
      setRunning(true);
      setPaused(false);
      setHint("Đang đo âm lượng thực tế từ microphone...");
      sampleBufferRef.current = [];
      smoothedLevelRef.current = 0;
      loopReal();
    } catch {
      if (!mountedRef.current) return;
      setSimMode(true);
      setRunning(true);
      setPaused(false);
      setHint("Không thể truy cập micro. Đang chạy ở chế độ mô phỏng demo.");
      sampleBufferRef.current = [];
      smoothedLevelRef.current = 0;
      loopSim();
    }
  };

  const pauseMeasurement = () => {
    if (!running) return;
    setPaused(true);
    setRunning(false);
    if (rafRef.current) {
      clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setHint("Đã tạm dừng phiên đo.");
  };

  const resetMeasurement = () => {
    stop();
    setLevel(0);
    setMinVal(0);
    setMaxVal(0);
    setAvgVal(0);
    setHistoryBars([]);
    sampleBufferRef.current = [];
    smoothedLevelRef.current = 0;
    setHint('Bấm "Bắt đầu đo" để theo dõi âm lượng thực tế của lớp học.');
  };

  useEffect(() => stop, [stop]);

  const zone = zoneFor(level);
  const isTooLoud = level >= 85; // Ngưỡng quá ồn

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, level) / 100) * circumference;

  return (
    <div className="w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* KHUNG TRÁI: Vòng tròn đo âm lượng */}
        <div
          className={`lg:col-span-7 bg-white p-6 rounded-3xl border shadow-lg space-y-6 flex flex-col transition-all ${
            isTooLoud
              ? "border-rose-500 ring-4 ring-rose-500/20 shadow-rose-500/10"
              : "border-amber-200 shadow-amber-950/5"
          }`}
        >
          <div className="flex flex-row justify-between items-center gap-4 pb-4 border-b border-slate-100 flex-wrap">
            <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
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
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
              </svg>
              Đo tiếng ồn trong lớp
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
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

              {isTooLoud && (
                <div className="flex items-center gap-2 bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-black animate-bounce shadow-md">
                  <span>🚨</span> LỚP ĐANG QUÁ ỒN!
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-between flex-1 bg-amber-50/40 p-5 rounded-3xl border border-amber-100/60">
            <div className="relative w-52 h-52 flex items-center justify-center my-2">
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 200 200"
              >
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="14"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke={zone.color}
                  strokeWidth="14"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    transition:
                      "stroke-dashoffset 0.25s ease, stroke 0.3s ease",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={`text-4xl font-black tracking-tight ${isTooLoud ? "text-rose-600 animate-pulse" : "text-slate-800"}`}
                >
                  {Math.round(level)}
                </span>
                <span className="text-xs font-bold text-slate-400 mt-0.5">
                  dB gần đúng
                </span>
                <div
                  className="mt-2 text-xs font-extrabold px-3 py-1 rounded-full shadow-2xs"
                  style={{ background: `${zone.color}20`, color: zone.color }}
                >
                  {zone.label}
                </div>
              </div>
            </div>

            <p
              className={`text-xs font-bold text-center mb-4 ${isTooLoud ? "text-rose-600" : "text-slate-500"}`}
            >
              {isTooLoud
                ? "⚠️ Cùng hạ giọng nhỏ lại nhé cả lớp ơi!"
                : "Mức âm lượng đang rất tuyệt vời!"}
            </p>

            <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, level)}%`,
                  backgroundColor: zone.color,
                }}
              />
            </div>

            <div className="flex items-center justify-center gap-2.5 w-full flex-wrap">
              <button
                onClick={startMeasurement}
                disabled={running && !paused}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-md cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  running && !paused
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {paused ? "Tiếp tục đo" : "Bắt đầu đo"}
              </button>

              <button
                onClick={pauseMeasurement}
                disabled={!running}
                className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer ${
                  !running
                    ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200 shadow-2xs"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Tạm dừng
              </button>

              <button
                onClick={resetMeasurement}
                className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Đặt lại
              </button>
            </div>

            {/* 👇 Ô chứa dòng trạng thái, đặt bên trong khung thay vì trôi nổi ngoài layout */}
            <div className="w-full mt-4 bg-white border border-amber-100 rounded-xl px-3.5 py-2.5 text-center">
              <p className="text-[11px] text-slate-500 font-medium m-0">
                {hint}{" "}
                {simMode && (
                  <span className="text-amber-600">
                    (Đang dùng dữ liệu mô phỏng do trình duyệt chưa cấp quyền
                    micro)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* KHUNG PHẢI: Thống kê, lịch sử phiên & độ nhạy micro */}
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
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Thống kê & Lịch sử
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl px-4 py-3 text-center">
              <p className="text-lg font-extrabold text-emerald-700 m-0">
                {minVal}
              </p>
              <p className="text-[11px] font-semibold text-emerald-700/70 m-0">
                Tối thiểu
              </p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-3xl px-4 py-3 text-center">
              <p className="text-lg font-extrabold text-sky-700 m-0">
                {avgVal}
              </p>
              <p className="text-[11px] font-semibold text-sky-700/70 m-0">
                Trung bình
              </p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-3xl px-4 py-3 text-center">
              <p className="text-lg font-extrabold text-rose-700 m-0">
                {maxVal}
              </p>
              <p className="text-[11px] font-semibold text-rose-700/70 m-0">
                Tối đa
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span className="flex items-center gap-1">
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
                  className="lucide lucide-mic preview-icon text-amber-600"
                >
                  <path d="M12 19v3" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <rect x="9" y="2" width="6" height="13" rx="3" />
                </svg>{" "}
                Độ nhạy Micro
              </span>
              <span>{sensitivity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={sensitivity}
              onChange={(e) => setSensitivity(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col flex-1 space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 m-0">
              Lịch sử phiên đo
            </h3>

            <div className="flex-1 min-h-35 h-36 bg-amber-50/40 rounded-3xl border border-amber-100/60 p-3 flex items-end justify-between gap-1.5">
              {historyBars.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium text-center">
                  Chưa có dữ liệu biểu đồ. Hãy bấm Bắt đầu đo.
                </div>
              ) : (
                historyBars.map((bar, idx) => {
                  const heightPercent = Math.min(100, Math.max(10, bar.avg));
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative"
                    >
                      <div className="absolute -top-8 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        TB: {bar.avg}dB
                      </div>
                      <div
                        className="w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: bar.color,
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHẾ ĐỘ PHÓNG TO TOÀN MÀN HÌNH CHO LỚP HỌC (khi chưa quá ồn) */}
      {isFullscreen && !isTooLoud && (
        <div className="fixed inset-0 z-50 bg-[#1e1b4b] text-white flex flex-col items-center justify-between p-8 sm:p-12 animate-fadeIn">
          <div className="w-full flex justify-between items-center max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xl sm:text-2xl font-bold tracking-wide text-purple-200">
                Đo tiếng ồn
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
            >
              <span>✕</span> Thoát phóng to
            </button>
          </div>

          <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center my-auto">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 200 200"
            >
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="14"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={zone.color}
                strokeWidth="14"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: "stroke-dashoffset 0.25s ease, stroke 0.3s ease",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-7xl sm:text-8xl font-black tracking-tight">
                {Math.round(level)}
              </span>
              <span className="text-sm font-bold text-purple-300 mt-1">
                dB gần đúng
              </span>
              <div
                className="mt-3 text-sm font-extrabold px-4 py-1.5 rounded-full"
                style={{ background: `${zone.color}30`, color: zone.color }}
              >
                {zone.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={running && !paused ? pauseMeasurement : startMeasurement}
              className={`px-8 py-4 rounded-3xl font-black text-base shadow-2xl transition-all transform active:scale-95 cursor-pointer ${
                running && !paused
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {running && !paused
                ? "Tạm dừng"
                : paused
                  ? "Tiếp tục đo"
                  : "Bắt đầu đo"}
            </button>
            <button
              onClick={resetMeasurement}
              className="px-6 py-4 rounded-3xl font-bold text-base bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
            >
              Đặt lại
            </button>
          </div>
        </div>
      )}

      {/* CẢNH BÁO QUÁ ỒN — TỰ ĐỘNG PHỦ TOÀN MÀN HÌNH, bất kể đang ở chế độ phóng to hay bình thường */}
      {isTooLoud && (
        <div className="fixed inset-0 z-60 bg-rose-600 flex flex-col items-center justify-center gap-6 p-8 animate-fadeIn">
          <div className="absolute inset-0 bg-rose-600 animate-pulse pointer-events-none" />
          <span className="relative text-8xl sm:text-9xl animate-bounce">
            🚨
          </span>
          <h2 className="relative text-white text-3xl sm:text-5xl font-black text-center tracking-tight drop-shadow-lg">
            LỚP ĐANG QUÁ ỒN!
          </h2>
          <p className="relative text-rose-100 text-base sm:text-xl font-bold text-center max-w-xl">
            Cùng hạ giọng nhỏ lại nhé cả lớp ơi! 🤫
          </p>
          <div className="relative text-white text-6xl sm:text-8xl font-black font-mono">
            {Math.round(level)}
            <span className="text-2xl sm:text-3xl font-bold ml-2">dB</span>
          </div>
          <button
            onClick={() => {
              setIsFullscreen(false);
              pauseMeasurement();
            }}
            className="relative px-6 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all border border-white/30 cursor-pointer"
          >
            Tạm dừng đo
          </button>
        </div>
      )}
    </div>
  );
}
