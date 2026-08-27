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

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
}

export default function AdminGallery({ onAdded }: { onAdded: () => void }) {
  const [titlePrefix, setTitlePrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // State phân trang và hiệu ứng
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const itemsPerPage = 3;

  // State quản lý Modal chỉnh sửa
  const [editItem, setEditItem] = useState<GalleryItem | null>(null);

  // Lắng nghe dữ liệu realtime từ Firestore
  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGallery(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GalleryItem),
      );
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

  const visibleGallery = gallery.slice(
    currentIndex,
    currentIndex + itemsPerPage,
  );

  // Xử lý khi chọn nhiều ảnh từ máy
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const finalTitle = titlePrefix.trim()
          ? files.length > 1
            ? `${titlePrefix} (${i + 1})`
            : titlePrefix
          : file.name.split(".")[0];

        await addDoc(collection(db, "gallery"), {
          title: finalTitle,
          imageUrl: base64,
          createdAt: serverTimestamp(),
        });
      }

      setTitlePrefix("");
      setCurrentIndex(0);
      alert(`✅ Đã tải lên thành công ${files.length} ảnh!`);
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi tải ảnh lên.");
    } finally {
      setLoading(false);
    }
  };

  // Cập nhật tiêu đề ảnh sau khi sửa
  const handleUpdate = async () => {
    if (!editItem) return;
    if (!editItem.title.trim()) {
      alert("Tiêu đề ảnh không được để trống!");
      return;
    }

    try {
      await updateDoc(doc(db, "gallery", editItem.id), {
        title: editItem.title.trim(),
      });
      setEditItem(null);
      alert("✅ Đã cập nhật tiêu đề ảnh thành công!");
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi cập nhật tiêu đề ảnh");
    }
  };

  // Xóa ảnh
  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa ảnh này?")) return;
    try {
      await deleteDoc(doc(db, "gallery", id));
      alert("✅ Đã xóa ảnh thành công!");
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi xóa ảnh");
    }
  };

  return (
    <div className="bg-white/90 p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Form thêm ảnh */}
      <div className="space-y-4">
        <div className="card-head">
          <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Thêm Nhiều Ảnh Kỷ Niệm
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Nhập tiêu đề (tùy chọn) và chọn nhiều ảnh từ máy tính.
        </p>

        <div className="field">
          <input
            type="text"
            placeholder="Ví dụ: Hoạt động ngoại khóa..."
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
          />
        </div>

        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#E7DFCE] rounded-2xl cursor-pointer bg-white hover:border-amber-500 transition shadow-2xs">
          <div className="flex flex-col items-center justify-center pt-4 pb-5 px-4 text-center">
            <svg
              className="w-7 h-7 mb-2 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16V4M12 4l-4 4M12 4l4 4"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"
              />
            </svg>
            <span className="text-xs text-slate-600 font-semibold">
              Nhấn để chọn nhiều ảnh
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesChange}
            className="hidden"
            disabled={loading}
          />
        </label>

        {loading && (
          <div className="text-center text-xs text-amber-600 font-bold animate-pulse">
            Đang xử lý và tải ảnh lên... Vui lòng đợi.
          </div>
        )}
      </div>

      {/* Danh sách ảnh đã đăng */}
      <div className="border-t border-[#EFE8D8] pt-5 space-y-4">
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
          Danh sách ảnh đã đăng ({gallery.length}):
        </h4>

        <div
          className={`space-y-3 transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
        >
          {gallery.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">
              Chưa có ảnh kỷ niệm nào.
            </div>
          ) : (
            visibleGallery.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50/80 border border-[#E7DFCE] rounded-xl flex justify-between items-center gap-4 shadow-2xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-12 h-12 object-cover rounded-lg border border-[#E7DFCE] shrink-0"
                  />
                  <div className="overflow-hidden">
                    <h5 className="font-bold text-slate-800 text-sm truncate">
                      {item.title}
                    </h5>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditItem(item)}
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
                    type="button"
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

        {/* Nút phân trang */}
        {gallery.length > itemsPerPage && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() =>
                handlePageChange(Math.max(currentIndex - itemsPerPage, 0))
              }
              disabled={currentIndex === 0 || isAnimating}
              className="w-9 h-9 rounded-full border border-[#E7DFCE] bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition-all cursor-pointer shadow-2xs"
            >
              ❮
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentIndex + itemsPerPage)}
              disabled={
                currentIndex + itemsPerPage >= gallery.length || isAnimating
              }
              className="w-9 h-9 rounded-full border border-[#E7DFCE] bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition-all cursor-pointer shadow-2xs"
            >
              ❯
            </button>
          </div>
        )}
      </div>

      {/* MODAL CHỈNH SỬA TIÊU ĐỀ ẢNH */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
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
              Chỉnh sửa tiêu đề ảnh
            </h3>

            <div className="flex justify-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editItem.imageUrl}
                alt={editItem.title}
                className="w-24 h-24 object-cover rounded-xl border border-[#E7DFCE] shadow-xs"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Tiêu đề mới
              </label>
              <input
                className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 transition"
                value={editItem.title}
                onChange={(e) =>
                  setEditItem({ ...editItem, title: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition"
              >
                Lưu thay đổi
              </button>
              <button
                type="button"
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