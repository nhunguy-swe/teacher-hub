"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  dateStr?: string;
}

export default function AdminAnnouncement({
  onAdded,
}: {
  onAdded?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dateISO, setDateISO] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  // State phân trang và hiệu ứng
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const itemsPerPage = 3;

  const [editItem, setEditItem] = useState<
    (AnnouncementItem & { dateISO?: string }) | null
  >(null);

  // Helper functions
  const getTodayISO = () => new Date().toISOString().split("T")[0];
  const formatDateToDisplay = (isoString: string) => {
    const [year, month, day] = isoString.split("-");
    return `${day}/${month}/${year}`;
  };
  const formatDateToISO = (dateStr?: string) => {
    if (!dateStr) return getTodayISO();
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as AnnouncementItem[];
      setAnnouncements(data);
    });
    return () => unsubscribe();
  }, []);

  const handlePageChange = (newIndex: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsAnimating(false);
    }, 150);
  };

  const visibleAnnouncements = announcements.slice(
    currentIndex,
    currentIndex + itemsPerPage,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title,
        content,
        dateStr: formatDateToDisplay(dateISO),
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setContent("");
      setDateISO(getTodayISO());
      setCurrentIndex(0);
      alert("✅ Đã đăng thông báo mới!");
      if (onAdded) onAdded();
    } catch {
      alert("❌ Lỗi khi đăng thông báo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    await updateDoc(doc(db, "announcements", editItem.id), {
      title: editItem.title,
      content: editItem.content,
      dateStr: formatDateToDisplay(editItem.dateISO || getTodayISO()),
    });
    setEditItem(null);
    alert("✅ Đã cập nhật thành công!");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Cô có chắc chắn muốn xóa thông báo này?")) {
      await deleteDoc(doc(db, "announcements", id));
      if (onAdded) onAdded();
    }
  };

  return (
    <div className="bg-white/95 p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 m-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600"
          >
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Đăng thông báo mới
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Tiêu đề thông báo..."
            className="sm:col-span-2 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <input
              type="date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setDateISO(getTodayISO())}
              className="text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200/60 font-medium transition"
            >
              Hôm nay
            </button>
          </div>
        </div>
        <textarea
          placeholder="Nội dung chi tiết thông báo..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          {loading ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
          {loading ? "Đang gửi..." : "Đăng thông báo"}
        </button>
      </form>

      <div className="border-t border-amber-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900/70 mb-3 flex items-center gap-1.5">
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
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Danh sách thông báo ({announcements.length}):
        </h4>
        <div
          className={`space-y-3 transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
        >
          {visibleAnnouncements.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Chưa có thông báo nào.
            </p>
          ) : (
            visibleAnnouncements.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white border border-slate-200/80 rounded-2xl flex justify-between items-start gap-4 shadow-2xs"
              >
                <div className="flex-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md inline-flex items-center gap-1">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {item.dateStr}
                  </span>
                  <h5 className="font-bold text-slate-800 text-sm mt-1">
                    {item.title}
                  </h5>
                  <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line">
                    {item.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setEditItem({
                        ...item,
                        dateISO: formatDateToISO(item.dateStr),
                      })
                    }
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
                    </svg>
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-700 hover:text-white bg-rose-50 hover:bg-red-600 text-xs px-3.5 py-2 border border-red-200 rounded-xl transition-all font-semibold shadow-2xs"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {announcements.length > itemsPerPage && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() =>
                handlePageChange(Math.max(currentIndex - itemsPerPage, 0))
              }
              disabled={currentIndex === 0 || isAnimating}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center transition-all"
            >
              ❮
            </button>
            <button
              onClick={() => handlePageChange(currentIndex + itemsPerPage)}
              disabled={
                currentIndex + itemsPerPage >= announcements.length ||
                isAnimating
              }
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center transition-all"
            >
              ❯
            </button>
          </div>
        )}
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 m-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-600"
              >
                <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
              Chỉnh sửa thông báo
            </h3>
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
              value={editItem.title}
              onChange={(e) =>
                setEditItem({ ...editItem, title: e.target.value })
              }
            />
            <input
              type="date"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
              value={editItem.dateISO || getTodayISO()}
              onChange={(e) =>
                setEditItem({ ...editItem, dateISO: e.target.value })
              }
            />
            <textarea
              rows={5}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
              value={editItem.content}
              onChange={(e) =>
                setEditItem({ ...editItem, content: e.target.value })
              }
            />
            <div className="flex gap-2.5">
              <button
                onClick={handleUpdate}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition"
              >
                Lưu thay đổi
              </button>
              <button
                onClick={() => setEditItem(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}