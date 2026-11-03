"use client";

import { db, auth } from "@/lib/firebase";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { resizeToDataUrl, useAdminAvatar } from "@/lib/adminAvatar";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/components/ToastProvider";
import { ClassInfo, DEFAULT_CLASS_INFO } from "@/lib/classInfo";
import { useReminderSettings } from "@/lib/reminderSettings";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: string; desc: string }[] = [
  {
    value: "light",
    label: "Sáng",
    icon: "☀️",
    desc: "Nền trắng, dễ nhìn ban ngày",
  },
  { value: "dark", label: "Tối", icon: "🌙", desc: "Nền tối, dịu mắt ban đêm" },
  {
    value: "system",
    label: "Theo hệ thống",
    icon: "💻",
    desc: "Tự đổi theo thiết bị",
  },
];

const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = (): Theme =>
  (localStorage.getItem("theme") as Theme | null) ?? "system";

// Lúc render trên server (không có localStorage)
const getServerSnapshot = (): Theme => "system";

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export default function AdminSettings() {
  const toast = useToast();
  const [reminder, updateReminder] = useReminderSettings();
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [info, setInfo] = useState<ClassInfo>(DEFAULT_CLASS_INFO);
  const [saving, setSaving] = useState(false);

  // Nickname hiển thị ở lời chào "Chào {nickname} trở lại!"
  const [uid, setUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [savingNick, setSavingNick] = useState(false);

  const avatar = useAdminAvatar(uid);
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Nếu chọn "Theo hệ thống" thì lắng nghe khi máy đổi chế độ
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Lấy uid của tài khoản đang đăng nhập
  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  // Đọc nickname hiện tại từ Firestore
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "adminProfiles", uid))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          setNickname((snap.data().nickname as string | undefined) ?? "");
        }
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Đọc thông tin lớp từ Firestore
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "settings", "general"))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          setInfo({
            ...DEFAULT_CLASS_INFO,
            ...(snap.data() as Partial<ClassInfo>),
          });
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải thông tin lớp.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (t: Theme) => {
    localStorage.setItem("theme", t);
    applyTheme(t);
    listeners.forEach((cb) => cb()); // báo cho React đọc lại
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng một file
    if (!file || !uid) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn một file ảnh!");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ảnh quá lớn, vui lòng chọn ảnh dưới 10MB!");
      return;
    }
    setSavingAvatar(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      await setDoc(
        doc(db, "adminProfiles", uid),
        { avatar: dataUrl },
        { merge: true },
      );
      toast.success("Đã đổi ảnh đại diện!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu ảnh, vui lòng thử ảnh khác.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!uid) return;
    setSavingAvatar(true);
    try {
      await setDoc(
        doc(db, "adminProfiles", uid),
        { avatar: deleteField() },
        { merge: true },
      );
      toast.success("Đã xóa ảnh đại diện!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa ảnh.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveNickname = async () => {
    if (!uid) return;
    setSavingNick(true);
    try {
      await setDoc(
        doc(db, "adminProfiles", uid),
        { nickname: nickname.trim() },
        { merge: true },
      );
      toast.success("Đã lưu nickname!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu nickname.");
    } finally {
      setSavingNick(false);
    }
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "general"), {
        className: info.className.trim(),
        schoolYear: info.schoolYear.trim(),
        effectiveDate: info.effectiveDate,
      });
      toast.success("Đã lưu thông tin lớp!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu thông tin lớp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Cài đặt
        </h2>
      </div>

      {/* Giao diện */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Giao diện</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                theme === o.value
                  ? "border-amber-500 bg-amber-50 shadow-2xs"
                  : "border-slate-200 bg-slate-50 hover:border-amber-300"
              }`}
            >
              <div className="text-2xl">{o.icon}</div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {o.label}
              </div>
              <div className="text-[11px] text-slate-500">{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ảnh đại diện */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Ảnh đại diện</h3>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-amber-100 ring-2 ring-amber-300 shadow-md shadow-amber-500/20">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="Ảnh đại diện"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-400 to-[#f59e0b] text-white">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3L2 8l10 5 10-5-10-5z" />
                  <path d="M2 12l10 5 10-5" />
                  <path d="M2 8v6" />
                </svg>
              </span>
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={savingAvatar || !uid}
                className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {savingAvatar ? "Đang lưu..." : "Chọn ảnh từ máy"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={savingAvatar}
                  className="px-3.5 py-2 text-xs font-bold bg-white text-slate-600 border border-slate-200 rounded-xl hover:border-red-300 hover:text-red-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  Xóa ảnh
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 m-0">
              Ảnh tự cắt vuông và thu nhỏ. Hiển thị ở chip tài khoản trên đầu
              trang.
            </p>
          </div>
        </div>
      </div>

      {/* Nickname */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700">Nickname</h3>
        <div className="flex flex-col sm:flex-row gap-3 text-xs">
          <input
            type="text"
            maxLength={30}
            placeholder="Ví dụ: Cô Trúc"
            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
          />
          <button
            type="button"
            onClick={handleSaveNickname}
            disabled={savingNick || !uid}
            className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {savingNick ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 m-0">
          Hiển thị ở lời chào: &quot;Chào {nickname.trim() || "bạn"} trở
          lại!&quot;
        </p>
      </div>

      {/* Nhắc nhở */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Nhắc nhở</h3>

        <label className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer">
          <div>
            <div className="text-sm font-bold text-slate-800">
              🔔 Bật nhắc nhở khi mở web
            </div>
            <div className="text-[11px] text-slate-500">
              Hiện thông báo 1 lần mỗi ngày khi bạn mở trang quản trị
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-amber-600 cursor-pointer"
            checked={reminder.enabled}
            onChange={(e) => updateReminder({ enabled: e.target.checked })}
          />
        </label>

        <label
          className={`flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer ${
            reminder.enabled ? "" : "opacity-50 pointer-events-none"
          }`}
        >
          <div>
            <div className="text-sm font-bold text-slate-800">
              🎂 Nhắc sinh nhật học sinh
            </div>
            <div className="text-[11px] text-slate-500">
              Dựa trên ngày sinh trong mục Học sinh
            </div>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-amber-600 cursor-pointer"
            checked={reminder.birthday}
            onChange={(e) => updateReminder({ birthday: e.target.checked })}
          />
        </label>
      </div>

      {/* Thông tin lớp */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Thông tin lớp</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Tên lớp
            </label>
            <input
              type="text"
              placeholder="Ví dụ: 3A"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
              value={info.className}
              onChange={(e) => setInfo({ ...info, className: e.target.value })}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Năm học
            </label>
            <input
              type="text"
              placeholder="Ví dụ: 2025 - 2026"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
              value={info.schoolYear}
              onChange={(e) => setInfo({ ...info, schoolYear: e.target.value })}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Áp dụng từ ngày
            </label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-amber-500 transition-colors"
              value={info.effectiveDate}
              onChange={(e) =>
                setInfo({ ...info, effectiveDate: e.target.value })
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveInfo}
          disabled={saving}
          className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu thông tin lớp"}
        </button>
      </div>
    </div>
  );
}
