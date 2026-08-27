"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminContact from "@/components/admin/AdminContact"; // <-- Thêm import component mới
import AdminAnnouncement from "@/components/admin/AdminAnnouncement";
import AdminMaterials from "@/components/admin/AdminMaterials";
import AdminGallery from "@/components/admin/AdminGallery";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminGames from "@/components/admin/AdminGames";

interface ItemData {
  id: string;
  parentName?: string;
  name?: string;
  sender?: string;
  studentInfo?: string;
  subject?: string;
  message?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

const MENU_ITEMS: { id: string; icon: React.ReactNode; label: string }[] = [
  {
    id: "section-messages",
    label: "Lời nhắn phụ huynh",
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
        <path d="M4 4h16v16H4z" />
        <path d="M22 6l-10 7L2 6" />
      </svg>
    ),
  },
  {
    id: "section-schedule",
    label: "Thời khóa biểu",
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
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "section-announcements",
    label: "Thông báo lớp học",
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
        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    id: "section-materials",
    label: "Kho tài liệu",
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
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    id: "section-gallery",
    label: "Góc kỷ niệm",
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
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: "section-games",
    label: "Trò chơi lớp học",
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
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <circle cx="15" cy="13" r="1" />
        <circle cx="18" cy="11" r="1" />
        <path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
      </svg>
    ),
  },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ItemData[]>([]);
  const [activeSection, setActiveSection] = useState("section-messages");

  const router = useRouter();

  const loadAllData = useCallback(async () => {
    try {
      const qMsgs = query(
        collection(db, "contacts"),
        orderBy("createdAt", "desc"),
      );
      const snapMsgs = await getDocs(qMsgs);
      setMessages(
        snapMsgs.docs.map((d) => ({ id: d.id, ...d.data() })) as ItemData[],
      );
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setLoading(false);
        loadAllData();
      }
    });
    return () => unsubscribe();
  }, [router, loadAllData]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = MENU_ITEMS.map((m) => m.id);
      const scrollPosition = window.scrollY + 150;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDelete = async (colName: string, id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa mục này?")) {
      try {
        await deleteDoc(doc(db, colName, id));
        loadAllData();
      } catch {
        alert("Xóa thất bại, vui lòng thử lại!");
      }
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "resolved" ? "pending" : "resolved";
    try {
      await updateDoc(doc(db, "contacts", id), { status: newStatus });
      loadAllData();
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      alert("Không thể cập nhật trạng thái, vui lòng thử lại!");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-emerald-400 font-medium">
          Đang kiểm tra quyền truy cập...
        </p>
      </div>
    );
  }

  return (
    <>
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
              Quản lý thời khóa biểu, thông báo, tài liệu, trò chơi và hình ảnh
              lớp học
            </p>
          </div>
          <div className="topbar-actions">
            <Link href="/" className="btn-ghost">
              Xem trang chủ
            </Link>
            <button className="btn-danger btn-primary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <main className="w-full px-3 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
          <aside className="w-full lg:w-72 shrink-0 sticky top-0 lg:top-6 z-30">
            <div className="bg-white/90 backdrop-blur-md p-2.5 lg:p-4 rounded-2xl lg:rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 lg:space-y-1.5">
              <div className="hidden lg:block px-3 pt-2 pb-3 border-b border-amber-100 mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800/70 flex items-center gap-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-600"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Danh mục quản lý
                </span>
              </div>

              <div
                className="flex flex-row lg:flex-col gap-2 lg:gap-1.5 overflow-x-auto lg:overflow-visible snap-x snap-mandatory lg:snap-none [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {MENU_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`flex items-center gap-2 lg:gap-3 shrink-0 lg:shrink whitespace-nowrap snap-start px-4 py-2 lg:px-3.5 lg:py-2.5 rounded-full lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-200 ${
                      activeSection === item.id
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 lg:translate-x-1"
                        : "bg-amber-50/70 lg:bg-transparent text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                    }`}
                  >
                    <span
                      className={`text-sm lg:text-base flex items-center ${
                        activeSection === item.id
                          ? "text-white"
                          : "text-amber-600"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 w-full space-y-6 min-w-0 pt-0">
            {/* Sử dụng component AdminContact vừa tách */}
            <section id="section-messages" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminContact
                messages={messages}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            </section>

            <section id="section-schedule" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminSchedule />
            </section>

            <section id="section-announcements" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminAnnouncement onAdded={loadAllData} />
            </section>

            <section id="section-materials" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminMaterials onAdded={loadAllData} />
            </section>

            <section id="section-gallery" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminGallery onAdded={loadAllData} />
            </section>

            <section id="section-games" className="panel scroll-mt-12 lg:scroll-mt-6">
              <AdminGames onAdded={loadAllData} />
            </section>
          </div>
        </div>
      </main>

      <footer
        className="mini-footer mt-10"
        style={{
          background: "#22382f",
          color: "#fff",
          paddingTop: "30px",
          paddingBottom: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "bold",
              fontSize: "16px",
              color: "#e67e22",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e67e22"
              strokeWidth="2"
            >
              <path d="M12 3L2 8l10 5 10-5-10-5z" />
              <path d="M2 12l10 5 10-5" />
              <path d="M2 8v6" />
            </svg>
            Cô Trúc
          </div>
          <p style={{ fontSize: "13px", color: "#a0a0a0", margin: 0 }}>
            © {new Date().getFullYear()} — Trang quản lý chính thức.
          </p>
        </div>
      </footer>
    </>
  );
}
