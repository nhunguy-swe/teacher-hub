"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ToastProvider";
import { LuckyDrawProvider } from "@/components/admin/AdminLuckyDrawContext";
import Link from "next/link";
import "../admin.css";

const MENU_ITEMS = [
  {
    id: "section-statistics",
    label: "Tổng quan",
    path: "/admin/statistics",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "section-general-group",
    label: "Thông tin chung",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    children: [
      {
        id: "section-messages",
        label: "Lời nhắn phụ huynh",
        path: "/admin/contact",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        ),
      },
      {
        id: "section-announcements",
        label: "Thông báo",
        path: "/admin/announcements",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        ),
      },
      {
        id: "section-schedule",
        label: "Thời khóa biểu",
        path: "/admin/schedule",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "section-management-group",
    label: "Quản lý lớp học",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    children: [
      {
        id: "section-students",
        label: "Học sinh",
        path: "/admin/students",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
      },
      {
        id: "section-seating",
        label: "Sơ đồ lớp",
        path: "/admin/seating-chart",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
      {
        id: "section-competition",
        label: "Thi đua tổ",
        path: "/admin/competition-groups",
        icon: (
          <svg
            width="16"
            height="16"
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
        ),
      },
      {
        id: "section-criteria",
        label: "Tiêu chí thi đua",
        path: "/admin/criteria",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        id: "section-rewards",
        label: "Trạm quà đổi điểm",
        path: "/admin/rewards",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
          </svg>
        ),
      },
      {
        id: "section-honor",
        label: "Bảng vàng",
        path: "/admin/honor",
        icon: (
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
            className="lucide lucide-podium"
          >
            <path d="M12 6V2h-1" />
            <path d="M9 15a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1" />
            <path d="M9 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10" />
          </svg>
        ),
      },
      {
        id: "section-privileges",
        label: "Thẻ đặc quyền",
        path: "/admin/privileges",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "section-tools-group",
    label: "Công cụ & Tiện ích",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    children: [
      {
        id: "section-attendance",
        label: "Điểm danh",
        path: "/admin/attendance",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        ),
      },
      {
        id: "section-noise",
        label: "Đo tiếng ồn",
        path: "/admin/noise-meter",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        ),
      },
      {
        id: "section-stopwatch",
        label: "Đồng hồ bấm giờ",
        path: "/admin/stopwatch",
        icon: (
          <svg
            width="16"
            height="16"
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
        ),
      },
      {
        id: "section-lucky-group",
        label: "Gọi tên may mắn",
        icon: (
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
            className="lucide lucide-dices"
          >
            <rect width="12" height="12" x="2" y="10" rx="2" ry="2" />
            <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
            <path d="M6 18h.01" />
            <path d="M10 14h.01" />
            <path d="M15 6h.01" />
            <path d="M18 9h.01" />
          </svg>
        ),
        children: [
          {
            id: "section-spin",
            label: "Vòng quay",
            path: "/admin/lucky-spin",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
            ),
          },
          {
            id: "section-drawcard",
            label: "Rút thẻ",
            path: "/admin/lucky-drawcard",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
            ),
          },
          {
            id: "section-flipcard",
            label: "Lật thẻ",
            path: "/admin/lucky-flipcard",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-playing-cards-fan"
              >
                <path d="M12.65 7.65a2 2 0 012.629-1.046l5.51 2.374a2 2 0 011.046 2.628l-3.957 9.184a2 2 0 01-2.628 1.046l-5.51-2.374a2 2 0 01-1.046-2.628z" />
                <path d="M18 7.777V4a2 2 0 00-2-2h-6a2 2 0 00-2 2v10a2 2 0 001.137 1.805" />
                <path d="m8 4.389-4.364.809a2 2 0 00-1.602 2.33l1.822 9.833a2 2 0 002.331 1.602l2.542-.47" />
              </svg>
            ),
          },
        ],
      },
      {
        id: "section-games",
        label: "Trò chơi",
        path: "/admin/games",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" y1="12" x2="10" y2="12" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <circle cx="15" cy="13" r="1" />
            <circle cx="18" cy="11" r="1" />
            <path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "section-materials-group",
    label: "Tài liệu & Kỷ niệm",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
    children: [
      {
        id: "section-materials",
        label: "Slide bài giảng/bài tập",
        path: "/admin/materials",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
      },
      {
        id: "section-gallery",
        label: "Góc kỷ niệm",
        path: "/admin/gallery",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "section-settings",
    label: "Cài đặt",
    path: "/admin/settings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

// Tách riêng mục "Cài đặt" để luôn ghim cố định ở cuối sidebar,
// không nằm trong vùng menu có thể cuộn/thu gọn.
const SETTINGS_ITEM = MENU_ITEMS.find(
  (item) => item.id === "section-settings",
)!;
const SCROLLABLE_MENU_ITEMS = MENU_ITEMS.filter(
  (item) => item.id !== "section-settings",
);

type MenuNode = {
  id: string;
  label: string;
  path?: string;
  icon: React.ReactNode;
  children?: MenuNode[];
};

const findActiveItem = (
  items: MenuNode[],
  pathname: string,
): MenuNode | null => {
  for (const it of items) {
    if (it.path === pathname) return it;
    if (it.children) {
      const found = findActiveItem(it.children, pathname);
      if (found) return found;
    }
  }
  return null;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    "section-general-group": true,
    "section-management-group": true,
    "section-tools-group": true,
    "section-lucky-group": true,
    "section-materials-group": true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isAuthPage =
        pathname === "/admin/login" || pathname === "/admin/forgot-password";

      if (!user && !isAuthPage) {
        router.push("/admin/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  const toggleDropdown = (groupId: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <p className="text-emerald-400 font-medium">
          Đang kiểm tra quyền truy cập...
        </p>
      </div>
    );
  }

  const isAuthPage =
    pathname === "/admin/login" || pathname === "/admin/forgot-password";

  if (isAuthPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  const isSettingsActive = SETTINGS_ITEM.path === pathname;

  const activeItem =
    findActiveItem(MENU_ITEMS as MenuNode[], pathname) ?? SETTINGS_ITEM;

  return (
    <ToastProvider>
      <LuckyDrawProvider>
        <div className="min-h-screen flex flex-col bg-(--paper)">
          <div className="topbar">
            <div className="topbar-inner">
              <div>
                <h1 className="logo" style={{ marginBottom: "4px" }}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3L2 8l10 5 10-5-10-5z" />
                    <path d="M2 12l10 5 10-5" />
                    <path d="M2 8v6" />
                  </svg>
                  Trang quản lý của Cô Trúc
                </h1>
                <p>
                  Quản lý thời khóa biểu, thông báo, tài liệu, trò chơi và hình
                  ảnh lớp học
                </p>
              </div>
              <div className="topbar-actions">
                <Link href="/" className="btn-ghost">
                  Xem trang chủ
                </Link>
                <button
                  className="btn-danger btn-primary"
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>

          <main className="w-full px-3 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto space-y-8 flex-1">
            <div className="flex flex-col lg:flex-row gap-6 items-start relative">
              <aside className="w-full lg:w-72 shrink-0 sticky top-0 lg:top-6 z-30">
                <div className="bg-white backdrop-blur-md p-2.5 lg:p-4 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 lg:flex lg:flex-col lg:h-[calc(100vh-150px)]">
                  {/* Nút mở menu: chỉ hiện trên điện thoại */}
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen((v) => !v)}
                    className="lg:hidden w-full flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#f59e0b] text-white text-sm font-bold shadow-md cursor-pointer"
                  >
                    <span className="flex items-center">{activeItem.icon}</span>
                    <span className="flex-1 text-left truncate">
                      {activeItem.label}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`transition-transform duration-200 ${mobileMenuOpen ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Tiêu đề: chỉ hiện trên máy tính */}
                  <div className="hidden lg:block px-3 pt-2 pb-3 border-b border-slate-100 mb-2 shrink-0">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800/70">
                      Danh mục quản lý
                    </span>
                  </div>

                  {/* Vùng menu */}
                  <div
                    className={`${mobileMenuOpen ? "flex" : "hidden"} lg:flex flex-col gap-1.5 mt-2 lg:mt-0 max-h-[60vh] lg:max-h-none overflow-y-auto lg:flex-1 [&::-webkit-scrollbar]:hidden`}
                  >
                    {SCROLLABLE_MENU_ITEMS.map((item) => {
                      const hasChildren =
                        item.children && item.children.length > 0;
                      const isOpen = openDropdowns[item.id];
                      const isActive = item.path === pathname;

                      return (
                        <div key={item.id} className="flex flex-col">
                          {hasChildren ? (
                            <div
                              onClick={() => toggleDropdown(item.id)}
                              className="w-full flex items-center gap-2 lg:gap-3 px-4 py-2 lg:px-3.5 lg:py-2.5 rounded-full lg:rounded-3xl text-xs lg:text-sm font-bold bg-amber-50/70 text-slate-700 cursor-pointer hover:bg-amber-100/70 transition-colors"
                            >
                              <span className="text-sm lg:text-base flex items-center text-amber-600">
                                {item.icon}
                              </span>
                              <span className="flex-1">{item.label}</span>
                              <div className="p-2 -m-1 shrink-0 text-amber-700">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={item.path || "#"}
                              style={
                                isActive
                                  ? {
                                      backgroundColor: "#f59e0b",
                                      color: "#ffffff",
                                      boxShadow:
                                        "0 4px 6px -1px rgba(245, 158, 11, 0.3)",
                                    }
                                  : {}
                              }
                              className={`flex items-center gap-2 lg:gap-3 px-4 py-2 lg:px-3.5 lg:py-2.5 rounded-full lg:rounded-3xl text-xs lg:text-sm font-bold transition-all duration-200 ${
                                isActive
                                  ? "bg-[#f59e0b] text-white shadow-md"
                                  : "bg-amber-50/70 lg:bg-transparent text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                              }`}
                            >
                              <span
                                className={`text-sm lg:text-base flex items-center ${isActive ? "text-white" : "text-amber-600"}`}
                              >
                                {item.icon}
                              </span>
                              <span className="flex-1">{item.label}</span>
                            </Link>
                          )}

                          {hasChildren && isOpen && (
                            <div className="flex flex-col lg:pl-2.5 pl-1.5 mt-1 space-y-1 border-l-2 border-amber-200 ml-1.5 lg:ml-2">
                              {item.children?.map((child) => {
                                const hasSubChildren =
                                  child.children && child.children.length > 0;
                                const isSubOpen = openDropdowns[child.id];
                                const isChildActive = child.path === pathname;

                                return (
                                  <div key={child.id} className="flex flex-col">
                                    {hasSubChildren ? (
                                      <div
                                        onClick={() => toggleDropdown(child.id)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-amber-50/40 cursor-pointer hover:bg-amber-100/50 transition-colors"
                                      >
                                        <span className="text-amber-600">
                                          {child.icon}
                                        </span>
                                        <span className="flex-1">
                                          {child.label}
                                        </span>
                                        <div className="p-1 text-amber-700">
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className={`transition-transform ${isSubOpen ? "rotate-180" : ""}`}
                                          >
                                            <polyline points="6 9 12 15 18 9" />
                                          </svg>
                                        </div>
                                      </div>
                                    ) : (
                                      <Link
                                        href={child.path || "#"}
                                        style={
                                          isChildActive
                                            ? {
                                                backgroundColor: "#f59e0b",
                                                color: "#ffffff",
                                                boxShadow:
                                                  "0 2px 4px rgba(245, 158, 11, 0.2)",
                                              }
                                            : {}
                                        }
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                                          isChildActive
                                            ? "bg-[#f59e0b] text-white shadow-sm"
                                            : "text-slate-600 hover:bg-amber-50 hover:text-amber-900"
                                        }`}
                                      >
                                        <span
                                          className={
                                            isChildActive
                                              ? "text-white"
                                              : "text-amber-600"
                                          }
                                        >
                                          {child.icon}
                                        </span>
                                        <span className="flex-1">
                                          {child.label}
                                        </span>
                                      </Link>
                                    )}

                                    {hasSubChildren && isSubOpen && (
                                      <div className="flex flex-col pl-2.5 mt-1 space-y-1 border-l-2 border-amber-200 ml-1">
                                        {child.children?.map((subChild) => {
                                          const isSubActive =
                                            subChild.path === pathname;
                                          return (
                                            <Link
                                              key={subChild.id}
                                              href={subChild.path || "#"}
                                              style={
                                                isSubActive
                                                  ? {
                                                      backgroundColor:
                                                        "#f59e0b",
                                                      color: "#ffffff",
                                                      boxShadow:
                                                        "0 2px 4px rgba(245, 158, 11, 0.2)",
                                                    }
                                                  : {}
                                              }
                                              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                                                isSubActive
                                                  ? "bg-[#f59e0b] text-white shadow-sm"
                                                  : "text-slate-500 hover:bg-amber-50 hover:text-amber-900"
                                              }`}
                                            >
                                              <span
                                                className={
                                                  isSubActive
                                                    ? "text-white"
                                                    : "text-amber-600"
                                                }
                                              >
                                                {subChild.icon}
                                              </span>
                                              <span className="flex-1">
                                                {subChild.label}
                                              </span>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Cài đặt - ghim ở đáy sidebar */}
                  <div
                    className={`${mobileMenuOpen ? "block" : "hidden"} lg:block shrink-0 mt-2 pt-2 border-t border-slate-100`}
                  >
                    <Link
                      href={SETTINGS_ITEM.path || "#"}
                      style={
                        isSettingsActive
                          ? {
                              backgroundColor: "#f59e0b",
                              color: "#ffffff",
                              boxShadow:
                                "0 4px 6px -1px rgba(245, 158, 11, 0.3)",
                            }
                          : {}
                      }
                      className={`flex items-center gap-2 lg:gap-3 px-4 py-2 lg:px-3.5 lg:py-2.5 rounded-full lg:rounded-3xl text-xs lg:text-sm font-bold transition-all duration-200 ${
                        isSettingsActive
                          ? "bg-[#f59e0b] text-white shadow-md"
                          : "bg-amber-50/70 lg:bg-transparent text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                      }`}
                    >
                      <span
                        className={`text-sm lg:text-base flex items-center ${isSettingsActive ? "text-white" : "text-amber-600"}`}
                      >
                        {SETTINGS_ITEM.icon}
                      </span>
                      <span className="flex-1">{SETTINGS_ITEM.label}</span>
                    </Link>
                  </div>
                </div>
              </aside>

              <div className="flex-1 w-full min-w-0 pt-0">{children}</div>
            </div>
          </main>

          <footer
            style={{
              background: "#22382f",
              color: "#fff",
              padding: "20px",
              textAlign: "center",
              marginTop: "auto",
            }}
          >
            <p style={{ fontSize: "13px", color: "#a0a0a0", margin: 0 }}>
              © {new Date().getFullYear()} — Trang quản lý chính thức.
            </p>
          </footer>
        </div>
      </LuckyDrawProvider>
    </ToastProvider>
  );
}
