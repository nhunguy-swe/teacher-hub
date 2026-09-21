"use client";

/**
 * Hệ thống Toast/Notification thay thế cho alert() mặc định của trình duyệt.
 *
 * CÁCH DÙNG:
 * 1. Đặt file này vào project, ví dụ: src/components/ToastProvider.tsx
 * 2. Bọc toàn bộ app (hoặc riêng layout /admin) bằng <ToastProvider>:
 *
 *      // app/layout.tsx hoặc app/admin/layout.tsx
 *      import { ToastProvider } from "@/components/ToastProvider";
 *
 *      export default function RootLayout({ children }) {
 *        return (
 *          <html lang="vi">
 *            <body>
 *              <ToastProvider>{children}</ToastProvider>
 *            </body>
 *          </html>
 *        );
 *      }
 *
 * 3. Trong bất kỳ component con nào (phải là "use client"), gọi:
 *
 *      import { useToast } from "@/components/ToastProvider";
 *
 *      const toast = useToast();
 *      toast.success("Đã đăng thông báo mới!");
 *      toast.error("Không thể xóa dữ liệu.");
 *      toast.warning("Cần giữ ít nhất 1 lối tắt ngoài màn hình chính!");
 *      toast.info("Người dùng đang chờ xử lý.");
 *
 *    Thay cho: alert("Đã đăng thông báo mới!")
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastType = "info" | "warning" | "error" | "success";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastContextValue {
  show: (type: ToastType, message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Cấu hình giao diện theo từng loại toast, đồng bộ với ảnh mẫu
const TOAST_STYLES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    iconBg: string;
    defaultTitle: string;
    icon: React.ReactNode;
  }
> = {
  info: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    iconBg: "text-sky-500",
    defaultTitle: "Info",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#0EA5E9" />
        <rect x="11" y="10" width="2" height="7" rx="1" fill="white" />
        <circle cx="12" cy="7" r="1.3" fill="white" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    iconBg: "text-amber-500",
    defaultTitle: "Warning",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5 21.5 20h-19L12 3.5z"
          fill="#F59E0B"
          stroke="#F59E0B"
          strokeLinejoin="round"
        />
        <rect x="11" y="9.5" width="2" height="5.5" rx="1" fill="white" />
        <circle cx="12" cy="17" r="1.2" fill="white" />
      </svg>
    ),
  },
  error: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    iconBg: "text-rose-500",
    defaultTitle: "Error",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#E11D48" />
        <line
          x1="7"
          y1="7"
          x2="17"
          y2="17"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    iconBg: "text-emerald-500",
    defaultTitle: "Success",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#10B981" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

const AUTO_DISMISS_MS = 4000;

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: number) => void;
}) {
  const style = TOAST_STYLES[toast.type];
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setLeaving(true);
    // Đợi animation kết thúc rồi mới gỡ khỏi danh sách
    setTimeout(() => onClose(toast.id), 180);
  }, [onClose, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(handleClose, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleClose]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full sm:w-96 ${style.bg} border ${style.border} rounded-3xl  shadow-lg shadow-slate-900/5 px-4 py-3.5 flex items-start gap-3 transition-all duration-200 ${
        leaving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
      }`}
    >
      <span className={`shrink-0 mt-0.5 ${style.iconBg}`}>{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold m-0 ${style.text}`}>
          {toast.title || style.defaultTitle}:{" "}
          <span className="font-medium">{toast.message}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Đóng thông báo"
        className={`shrink-0 ${style.text} opacity-50 hover:opacity-100 transition-opacity cursor-pointer`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, title?: string) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, type, message, title }]);
    },
    [],
  );

  const value: ToastContextValue = {
    show,
    info: (message, title) => show("info", message, title),
    warning: (message, title) => show("warning", message, title),
    error: (message, title) => show("error", message, title),
    success: (message, title) => show("success", message, title),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-100 flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() phải được gọi bên trong <ToastProvider>");
  }
  return ctx;
}
