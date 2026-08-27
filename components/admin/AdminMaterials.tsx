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

interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  link: string;
  category: "homework" | "slide";
}

export default function AdminMaterials({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Môn Toán");
  const [customSubject, setCustomSubject] = useState("");
  const [grade, setGrade] = useState("3");
  const [description, setDescription] = useState(
    "Tài liệu ôn tập và hỗ trợ học tập cho học sinh.",
  );
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<"homework" | "slide">("homework"); // Tab đang chọn để đăng
  const [activeTab, setActiveTab] = useState<"homework" | "slide">("homework"); // Tab đang xem danh sách

  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  // State phân trang và hiệu ứng
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const itemsPerPage = 3;

  // State quản lý Modal chỉnh sửa
  const [editItem, setEditItem] = useState<MaterialItem | null>(null);
  const [isEditCustom, setIsEditCustom] = useState(false);
  const [editCustomSubject, setEditCustomSubject] = useState("");

  const defaultSubjects = [
    "Môn Toán",
    "Môn Tiếng Việt",
    "Môn Tiếng Anh",
    "Môn Tự nhiên & Xã hội",
    "Kỹ năng sống",
  ];

  useEffect(() => {
    const q = query(collection(db, "materials"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMaterials(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MaterialItem),
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

  // Lọc danh sách theo tab đang xem
  const filteredMaterials = materials.filter(
    (item) => (item.category || "homework") === activeTab,
  );
  const visibleMaterials = filteredMaterials.slice(
    currentIndex,
    currentIndex + itemsPerPage,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.startsWith("http")) {
      alert(
        "Vui lòng dán link Google Drive hợp lệ (phải bắt đầu bằng http hoặc https)",
      );
      return;
    }

    const finalSubject = subject === "Khác" ? customSubject.trim() : subject;
    if (subject === "Khác" && !finalSubject) {
      alert("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "materials"), {
        title,
        subject: finalSubject,
        grade,
        description,
        link,
        category,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setLink("");
      setSubject("Môn Toán");
      setCustomSubject("");
      setGrade("3");
      setDescription("Tài liệu ôn tập và hỗ trợ học tập cho học sinh.");
      setCurrentIndex(0);
      alert("✅ Đã đăng tài liệu thành công!");
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi đăng bài");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: MaterialItem) => {
    if (defaultSubjects.includes(item.subject)) {
      setEditItem(item);
      setIsEditCustom(false);
      setEditCustomSubject("");
    } else {
      setEditItem({ ...item, subject: "Khác" });
      setIsEditCustom(true);
      setEditCustomSubject(item.subject);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const finalSubject = isEditCustom
      ? editCustomSubject.trim()
      : editItem.subject;
    if (isEditCustom && !finalSubject) {
      alert("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    try {
      await updateDoc(doc(db, "materials", editItem.id), {
        title: editItem.title,
        subject: finalSubject,
        grade: editItem.grade || "3",
        description: editItem.description || "",
        link: editItem.link,
        category: editItem.category || "homework",
      });
      setEditItem(null);
      alert("✅ Đã cập nhật tài liệu thành công!");
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi cập nhật tài liệu");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) return;
    try {
      await deleteDoc(doc(db, "materials", id));
      alert("✅ Đã xóa tài liệu thành công!");
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi xóa tài liệu");
    }
  };

  return (
    <div className="bg-white/90 p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Form đăng tài liệu */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card-head">
          <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
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
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            Đăng tài liệu (Google Drive)
          </h2>
        </div>

        {/* Chọn danh mục đăng - dạng pill trượt đồng bộ với tab bên dưới */}
        <div className="relative grid grid-cols-2 bg-amber-100/60 p-1 rounded-xl border border-amber-200/80 shadow-inner">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm border border-amber-200/50 transition-all duration-300 ease-in-out ${
              category === "homework" ? "left-1" : "left-[calc(50%+2px)]"
            }`}
          />

          <button
            type="button"
            onClick={() => setCategory("homework")}
            className={`relative z-10 px-4 py-2.5 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-2 ${
              category === "homework"
                ? "text-emerald-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
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
              className="shrink-0"
            >
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span>Bài tập</span>
          </button>

          <button
            type="button"
            onClick={() => setCategory("slide")}
            className={`relative z-10 px-4 py-2.5 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-2 ${
              category === "slide"
                ? "text-emerald-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
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
              className="shrink-0"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Slide bài giảng</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Khối lớp
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-500 transition"
            >
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Môn học</label>
            <select
              className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-500 transition"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {defaultSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
              <option value="Khác">Khác</option>
            </select>
          </div>
        </div>

        {subject === "Khác" && (
          <div className="field">
            <input
              type="text"
              placeholder="Nhập tên môn học mới..."
              className="w-full p-3 bg-white border border-amber-500 rounded-xl text-slate-700 text-sm focus:outline-none"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              required
            />
          </div>
        )}

        <div className="field">
          <input
            type="text"
            placeholder="Tên tài liệu..."
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <textarea
            placeholder="Mô tả ngắn tài liệu..."
            rows={2}
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <input
            type="url"
            placeholder="Dán link Google Drive tại đây..."
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#E06D53] hover:bg-[#D05D43] py-3 rounded-xl text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Đang gửi..." : "Đăng tài liệu"}
        </button>
      </form>

      {/* Danh sách quản lý tài liệu */}
      <div className="border-t border-[#EFE8D8] pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
          Danh sách tài liệu đã đăng:
        </h4>

          {/* Chuyển tab xem danh sách - dạng pill trượt giống phần Lời nhắn */}
          <div className="relative grid grid-cols-2 bg-amber-100/60 p-1 rounded-xl border border-amber-200/80 shadow-inner shrink-0 w-full sm:w-auto">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm border border-amber-200/50 transition-all duration-300 ease-in-out ${
                activeTab === "homework" ? "left-1" : "left-[calc(50%+2px)]"
              }`}
            />

            <button
              type="button"
              onClick={() => {
                setActiveTab("homework");
                setCurrentIndex(0);
              }}
              className={`relative z-10 px-4 py-2.5 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-2 ${
                activeTab === "homework"
                  ? "text-emerald-700"
                  : "text-slate-600 hover:text-slate-900"
              }`}
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
                className="shrink-0"
              >
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              <span>Bài tập</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                  activeTab === "homework"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {
                  materials.filter(
                    (i) => (i.category || "homework") === "homework",
                  ).length
                }
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("slide");
                setCurrentIndex(0);
              }}
              className={`relative z-10 px-4 py-2.5 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-2 ${
                activeTab === "slide"
                  ? "text-emerald-700"
                  : "text-slate-600 hover:text-slate-900"
              }`}
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
                className="shrink-0"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Slide bài giảng</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                  activeTab === "slide"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {materials.filter((i) => i.category === "slide").length}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`space-y-3 transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
        >
          {filteredMaterials.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">
              Hiện chưa có tài liệu nào trong mục này.
            </div>
          ) : (
            visibleMaterials.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white border border-[#E7DFCE] rounded-xl flex justify-between items-center gap-4 shadow-2xs"
              >
                <div className="overflow-hidden space-y-1">
                  <div className="flex gap-1.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-md">
                      {item.subject}
                    </span>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-md">
                      Lớp {item.grade || "3"}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm truncate">
                    {item.title}
                  </h5>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
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
        {filteredMaterials.length > itemsPerPage && (
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
                currentIndex + itemsPerPage >= filteredMaterials.length ||
                isAnimating
              }
              className="w-9 h-9 rounded-full border border-[#E7DFCE] bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition-all cursor-pointer shadow-2xs"
            >
              ❯
            </button>
          </div>
        )}
      </div>

      {/* MODAL CHỈNH SỬA TÀI LIỆU */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
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
              Chỉnh sửa tài liệu
            </h3>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Phân loại tab
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                value={editItem.category || "homework"}
                onChange={(e) =>
                  setEditItem({
                    ...editItem,
                    category: e.target.value as "homework" | "slide",
                  })
                }
              >
                <option value="homework">Bài tập</option>
                <option value="slide">Slide bài giảng</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Khối lớp
                </label>
                <select
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                  value={editItem.grade || "3"}
                  onChange={(e) =>
                    setEditItem({ ...editItem, grade: e.target.value })
                  }
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Môn học
                </label>
                <select
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                  value={editItem.subject}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Khác") {
                      setIsEditCustom(true);
                      setEditItem({ ...editItem, subject: "Khác" });
                    } else {
                      setIsEditCustom(false);
                      setEditItem({ ...editItem, subject: val });
                    }
                  }}
                >
                  {defaultSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            {isEditCustom && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Nhập tên môn học tùy chỉnh
                </label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-500 rounded-xl text-slate-800 text-xs font-medium focus:outline-none"
                  value={editCustomSubject}
                  onChange={(e) => setEditCustomSubject(e.target.value)}
                  placeholder="Nhập tên môn..."
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Tên tài liệu
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                value={editItem.title}
                onChange={(e) =>
                  setEditItem({ ...editItem, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Mô tả ngắn
              </label>
              <textarea
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none resize-none"
                value={editItem.description || ""}
                onChange={(e) =>
                  setEditItem({ ...editItem, description: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Link Google Drive
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                value={editItem.link}
                onChange={(e) =>
                  setEditItem({ ...editItem, link: e.target.value })
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