"use client";

import { useEffect, useRef, useCallback } from "react";

// Gom đường dẫn âm thanh vào một chỗ
export const LUCKY_SOUNDS = {
  wheel: "/sounds/spin-wheel.mp3", // Vòng quay
  card: "/sounds/draw-card.mp3", // Rút thẻ
  flip: "/sounds/flip-card.mp3", // Lật thẻ
  win: "/sounds/win.mp3", // Dùng chung cho cả 3 tool
} as const;

interface LuckySoundsOptions {
  spinSrc: string; // tiếng quay riêng của từng tool
  spinDurationMs: number; // thời gian quay, dùng để fade out đúng lúc
  winSrc?: string; // mặc định dùng tiếng thắng chung
  fadeMs?: number;
}

export function useLuckySounds({
  spinSrc,
  spinDurationMs,
  winSrc = LUCKY_SOUNDS.win,
  fadeMs = 400,
}: LuckySoundsOptions) {
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFadeTimers = useCallback(() => {
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    fadeTimeoutRef.current = null;
    fadeIntervalRef.current = null;
  }, []);

  // Tiếng quay (riêng từng tool)
  useEffect(() => {
    const audio = new Audio(spinSrc);
    audio.preload = "auto";
    spinAudioRef.current = audio;

    return () => {
      clearFadeTimers();
      audio.pause();
      spinAudioRef.current = null;
    };
  }, [spinSrc, clearFadeTimers]);

  // Tiếng thắng (dùng chung)
  useEffect(() => {
    const audio = new Audio(winSrc);
    audio.preload = "auto";
    winAudioRef.current = audio;

    return () => {
      audio.pause();
      winAudioRef.current = null;
    };
  }, [winSrc]);

  const playSpinSound = useCallback(() => {
    const audio = spinAudioRef.current;
    if (!audio) return;
    clearFadeTimers();
    audio.currentTime = 0;
    audio.volume = 1;
    audio.play().catch(() => {});

    // Giảm dần âm lượng ở cuối lượt quay
    fadeTimeoutRef.current = setTimeout(() => {
      const steps = 10;
      let step = 0;
      fadeIntervalRef.current = setInterval(() => {
        step++;
        audio.volume = Math.max(0, 1 - step / steps);
        if (step >= steps && fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }, fadeMs / steps);
    }, Math.max(0, spinDurationMs - fadeMs));
  }, [clearFadeTimers, spinDurationMs, fadeMs]);

  const stopSpinSound = useCallback(() => {
    clearFadeTimers();
    const audio = spinAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
  }, [clearFadeTimers]);

  // Clone để bấm nhiều thẻ liên tiếp vẫn phát chồng được
  const playWinSound = useCallback(() => {
    const audio = winAudioRef.current;
    if (!audio) return;
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = 1;
    clone.play().catch(() => {});
  }, []);

  return { playSpinSound, stopSpinSound, playWinSound };
}