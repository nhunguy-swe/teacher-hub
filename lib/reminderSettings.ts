import { useCallback, useMemo, useSyncExternalStore } from "react";

export type ReminderSettings = { enabled: boolean; birthday: boolean };

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  birthday: true,
};

const KEY = "reminder_settings";
const EVENT = "reminder-settings-change";
export const LAST_SHOWN_KEY = "reminder_last_shown";

// Đọc trực tiếp (dùng trong effect / ngoài React)
export function readReminderSettings(): ReminderSettings {
  try {
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      ...JSON.parse(localStorage.getItem(KEY) || "{}"),
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
};

const getRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

// Hook cho giao diện Cài đặt
export function useReminderSettings() {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "");

  const settings = useMemo<ReminderSettings>(() => {
    try {
      return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(raw || "{}") };
    } catch {
      return DEFAULT_REMINDER_SETTINGS;
    }
  }, [raw]);

  const update = useCallback(
    (patch: Partial<ReminderSettings>) => {
      const next = { ...settings, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [settings],
  );

  return [settings, update] as const;
}
