"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
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

type Category = "homework" | "slide";

const DEFAULT_SUBJECTS = [
  "Môn Toán",
  "Môn Tiếng Việt",
  "Môn Tiếng Anh",
  "Môn Tự nhiên & Xã hội",
  "Kỹ năng sống",
];
const DEFAULT_DESCRIPTION = "Tài liệu ôn tập và hỗ trợ học tập cho học sinh.";

const inputCls =
  "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-400";
const inputCustomCls =
  "w-full px-3.5 py-2.5 bg-white border border-amber-500 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none";
const labelCls = "font-semibold text-slate-600 block mb-1";
const closeBtnCls =
  "text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer";
const btnAmber =
  "px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap";
const btnRose =
  "px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap";
const btnGray =
  "px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5";
const searchCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors";
const selectCls =
  "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none";

const BookIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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
);

const SlideIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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
);

// Thanh chuyển tab dạng pill trượt (dùng cho cả form đăng và danh sách)
function CategoryPill({
  value,
  onChange,
  counts,
}: {
  value: Category;
  onChange: (c: Category) => void;
  counts?: Record<Category, number>;
}) {
  const items: { key: Category; label: string; icon: React.ReactNode }[] = [
    { key: "slide", label: "Slide bài giảng", icon: <SlideIcon /> },
    { key: "homework", label: "Bài tập", icon: <BookIcon /> },
  ];
  return (
    <div className="relative grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200/65 gap-1 w-full">
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-2xs transition-all duration-300 ease-in-out ${
          value === "slide" ? "left-1" : "left-[calc(50%+2px)]"
        }`}
      />
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={`relative z-10 px-2 sm:px-4 py-2.5 text-[11px] sm:text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
            value === it.key
              ? "text-amber-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {it.icon}
          <span>{it.label}</span>
          {counts && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                value === it.key
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200/80 text-slate-500"
              }`}
            >
              {counts[it.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function AdminMaterials({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tab đang xem + bộ lọc
  const [activeTab, setActiveTab] = useState<Category>("slide");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modal thêm mới
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Môn Toán");
  const [customSubject, setCustomSubject] = useState("");
  const [grade, setGrade] = useState("3");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<Category>("slide");

  // Modal xóa nhanh
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteSearch, setDeleteSearch] = useState("");

  // Modal chỉnh sửa
  const [editItem, setEditItem] = useState<MaterialItem | null>(null);
  const [isEditCustom, setIsEditCustom] = useState(false);
  const [editCustomSubject, setEditCustomSubject] = useState("");

  // Popup xác nhận xóa 1 tài liệu
  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<MaterialItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Popup xác nhận xóa hàng loạt (đè lên trên modal Xóa nhanh)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "materials"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMaterials(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MaterialItem),
      );
    });
    return () => unsubscribe();
  }, []);

  const counts = useMemo(
    () => ({
      homework: materials.filter(
        (i) => (i.category || "homework") === "homework",
      ).length,
      slide: materials.filter((i) => i.category === "slide").length,
    }),
    [materials],
  );

  const filtered = useMemo(() => {
    const result = materials.filter(
      (m) =>
        (m.category || "homework") === activeTab &&
        (gradeFilter === "all" || String(m.grade || "3") === gradeFilter) &&
        m.title.toLowerCase().includes(search.toLowerCase().trim()),
    );
    if (sortBy === "title-asc")
      result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "title-desc")
      result.sort((a, b) => b.title.localeCompare(a.title));
    else if (sortBy === "grade")
      result.sort(
        (a, b) =>
          Number(a.grade || 3) - Number(b.grade || 3) ||
          a.title.localeCompare(b.title),
      );
    return result;
  }, [materials, activeTab, gradeFilter, search, sortBy]);

  const resetAddForm = () => {
    setTitle("");
    setLink("");
    setSubject("Môn Toán");
    setCustomSubject("");
    setGrade("3");
    setDescription(DEFAULT_DESCRIPTION);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.startsWith("http")) {
      toast.warning(
        "Vui lòng dán link Google Drive hợp lệ (phải bắt đầu bằng http hoặc https)",
      );
      return;
    }
    const finalSubject = subject === "Khác" ? customSubject.trim() : subject;
    if (!finalSubject) {
      toast.warning("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "materials"), {
        title: title.trim(),
        subject: finalSubject,
        grade,
        description,
        link: link.trim(),
        category,
        createdAt: serverTimestamp(),
      });
      toast.success("Đã đăng tài liệu thành công!");
      setActiveTab(category);
      resetAddForm();
      setAddModalOpen(false);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi đăng bài");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: MaterialItem) => {
    if (DEFAULT_SUBJECTS.includes(item.subject)) {
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
    if (!finalSubject) {
      toast.warning("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }
    if (!editItem.title.trim() || !editItem.link.trim()) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "materials", editItem.id), {
        title: editItem.title.trim(),
        subject: finalSubject,
        grade: editItem.grade || "3",
        description: editItem.description || "",
        link: editItem.link.trim(),
        category: editItem.category || "homework",
      });
      setEditItem(null);
      toast.success("Đã cập nhật tài liệu thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật tài liệu");
    } finally {
      setLoading(false);
    }
  };

  // Xóa 1 tài liệu (được gọi từ popup xác nhận)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteDoc(doc(db, "materials", confirmDeleteItem.id));
      toast.success(`Đã xóa tài liệu "${confirmDeleteItem.title}"!`);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa tài liệu");
    } finally {
      setDeletingId(null);
      setConfirmDeleteItem(null);
    }
  };

  // Bấm "Xóa các mục đã chọn" trong modal Xóa nhanh → mở popup xác nhận cuối cùng
  const handleRequestBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmBatchDelete(true);
  };

  // Xóa hàng loạt sau khi đã xác nhận
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setBatchDeleting(true);
    try {
      const count = selectedIds.length;
      await Promise.all(
        selectedIds.map((id) => deleteDoc(doc(db, "materials", id))),
      );
      toast.success(`Đã xóa ${count} tài liệu!`);
      setDeleteModalOpen(false);
      setSelectedIds([]);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xóa tài liệu.");
    } finally {
      setBatchDeleting(false);
      setConfirmBatchDelete(false);
    }
  };

  const deleteList = materials.filter((m) =>
    m.title.toLowerCase().includes(deleteSearch.toLowerCase().trim()),
  );
  const allDeleteSelected =
    deleteList.length > 0 &&
    deleteList.every((m) => selectedIds.includes(m.id));

  const toggleSelectAll = () => {
    const ids = deleteList.map((m) => m.id);
    if (allDeleteSelected) {
      setSelectedIds(selectedIds.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...ids])));
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <span className="text-amber-600">
            <BookIcon size={20} />
          </span>
          Tài liệu (Google Drive)
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setCategory(activeTab);
              setAddModalOpen(true);
            }}
            className={btnAmber}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Thêm tài liệu
          </button>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className={btnRose}
          >
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Xóa nhanh
          </button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-amber-700 m-0">
            {materials.length}
          </p>
          <p className="text-[11px] font-semibold text-amber-700/70 m-0">
            Tổng tài liệu
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-sky-700 m-0">
            {counts.slide}
          </p>
          <p className="text-[11px] font-semibold text-sky-700/70 m-0">
            Slide bài giảng
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-emerald-700 m-0">
            {counts.homework}
          </p>
          <p className="text-[11px] font-semibold text-emerald-700/70 m-0">
            Bài tập
          </p>
        </div>
      </div>

      {/* Chuyển tab */}
      <CategoryPill value={activeTab} onChange={setActiveTab} counts={counts} />

      {/* Tìm kiếm / lọc / sắp xếp */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            className={searchCls}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={selectCls}
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          <option value="all">Tất cả các lớp</option>
          {[1, 2, 3, 4, 5].map((g) => (
            <option key={g} value={g}>
              Lớp {g}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Mới đăng nhất</option>
          <option value="title-asc">Tên (A → Z)</option>
          <option value="title-desc">Tên (Z → A)</option>
          <option value="grade">Theo lớp</option>
        </select>
      </div>

      {/* Danh sách thẻ */}
      <p className="sm:hidden text-center text-[11px] text-slate-500 font-medium m-0">
        ← Vuốt ngang để xem thêm tài liệu →
      </p>
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 w-full shrink-0 sm:col-span-2 lg:col-span-3">
            Hiện chưa có tài liệu nào phù hợp trong mục này.
          </p>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="w-full min-w-full shrink-0 snap-center snap-always sm:w-auto sm:min-w-0 sm:shrink bg-white p-6 rounded-3xl border border-sky-100 shadow-lg shadow-sky-900/5 space-y-4 flex flex-col justify-between transition-all hover:shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-linear-to-tr from-sky-400 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                  {item.category === "slide" ? (
                    <SlideIcon size={26} />
                  ) : (
                    <BookIcon size={26} />
                  )}
                </div>
                <h4 className="font-extrabold text-slate-800 text-base m-0 line-clamp-2 w-full min-w-0 break-all">
                  {item.title}
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[11px] font-bold text-amber-700">
                    {item.subject}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-700">
                    Lớp {item.grade || "3"}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/40 p-3.5 rounded-3xl border border-amber-100/60 space-y-2 text-xs">
                <p className="text-slate-600 m-0 line-clamp-2 min-h-8">
                  {item.description || "Chưa có mô tả."}
                </p>
                <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-100/60">
                  <span className="text-slate-500 font-medium">Liên kết</span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sky-600 hover:underline truncate"
                  >
                    Mở tài liệu
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-100 transition-all cursor-pointer"
                  title="Sửa"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmDeleteItem(item)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
                  title="Xóa"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POPUP THÊM TÀI LIỆU */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Đăng tài liệu mới
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className={closeBtnCls}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className={labelCls}>Phân loại</label>
                <CategoryPill value={category} onChange={setCategory} />
              </div>

              <div>
                <label className={labelCls}>Tên tài liệu *</label>
                <input
                  type="text"
                  required
                  placeholder="Tên tài liệu..."
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Khối lớp</label>
                  <select
                    className={inputCls}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Môn học</label>
                  <select
                    className={inputCls}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    {DEFAULT_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {subject === "Khác" && (
                <div>
                  <label className={labelCls}>Nhập tên môn học tùy chỉnh</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên môn học mới..."
                    className={inputCustomCls}
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Mô tả ngắn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn tài liệu..."
                  className={`${inputCls} resize-none`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className={labelCls}>Link Google Drive *</label>
                <input
                  type="url"
                  required
                  placeholder="Dán link Google Drive tại đây..."
                  className={inputCls}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2.5 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className={btnGray}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`${btnAmber} disabled:opacity-50`}
                >
                  {loading ? "Đang gửi..." : "Đăng tài liệu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP XÓA NHANH */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Xóa tài liệu
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className={closeBtnCls}
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 my-3">
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu theo tên..."
                value={deleteSearch}
                onChange={(e) => setDeleteSearch(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-rose-300 transition-all"
              />
              <button
                type="button"
                onClick={toggleSelectAll}
                className={btnGray}
              >
                {allDeleteSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1 max-h-87.5">
              {deleteList.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">
                  Không có tài liệu nào.
                </p>
              ) : (
                deleteList.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() =>
                        setSelectedIds(
                          isSelected
                            ? selectedIds.filter((id) => id !== m.id)
                            : [...selectedIds, m.id],
                        )
                      }
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-rose-50/60 border-rose-200 text-rose-900"
                          : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                        />
                        <div className="overflow-hidden">
                          <p className="font-bold text-sm truncate">
                            {m.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            Lớp {m.grade || "3"} - {m.subject}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-600 shrink-0">
                        {m.category === "slide" ? "Slide" : "Bài tập"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
              <span className="text-xs font-semibold text-slate-500">
                Đã chọn:{" "}
                <strong className="text-rose-600">{selectedIds.length}</strong>{" "}
                tài liệu
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className={btnGray}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleRequestBatchDelete}
                  disabled={selectedIds.length === 0}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-md ${
                    selectedIds.length > 0
                      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                      : "bg-slate-300 cursor-not-allowed shadow-none"
                  }`}
                >
                  Xóa các mục đã chọn ({selectedIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP CHỈNH SỬA */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Chỉnh sửa tài liệu
              </h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className={closeBtnCls}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={labelCls}>Phân loại</label>
                <CategoryPill
                  value={editItem.category || "homework"}
                  onChange={(c) => setEditItem({ ...editItem, category: c })}
                />
              </div>

              <div>
                <label className={labelCls}>Tên tài liệu *</label>
                <input
                  className={inputCls}
                  value={editItem.title}
                  onChange={(e) =>
                    setEditItem({ ...editItem, title: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Khối lớp</label>
                  <select
                    className={inputCls}
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
                  <label className={labelCls}>Môn học</label>
                  <select
                    className={inputCls}
                    value={editItem.subject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIsEditCustom(val === "Khác");
                      setEditItem({ ...editItem, subject: val });
                    }}
                  >
                    {DEFAULT_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {isEditCustom && (
                <div>
                  <label className={labelCls}>Nhập tên môn học tùy chỉnh</label>
                  <input
                    className={inputCustomCls}
                    value={editCustomSubject}
                    onChange={(e) => setEditCustomSubject(e.target.value)}
                    placeholder="Nhập tên môn..."
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Mô tả ngắn</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none`}
                  value={editItem.description || ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelCls}>Link Google Drive *</label>
                <input
                  className={inputCls}
                  value={editItem.link}
                  onChange={(e) =>
                    setEditItem({ ...editItem, link: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button onClick={() => setEditItem(null)} className={btnGray}>
                Hủy bỏ
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className={`${btnAmber} disabled:opacity-50`}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA 1 TÀI LIỆU */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa tài liệu?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa tài liệu{" "}
                <strong className="text-slate-800">
                  &quot;{confirmDeleteItem.title}&quot;
                </strong>{" "}
                không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={deletingId === confirmDeleteItem.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDeleteItem.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingId === confirmDeleteItem.id ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA HÀNG LOẠT (đè lên trên modal Xóa nhanh) */}
      {confirmBatchDelete && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedIds.length} tài liệu đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIds.length}</strong>{" "}
                tài liệu đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBatchDelete(false)}
                disabled={batchDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={batchDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {batchDeleting
                  ? "Đang xóa..."
                  : `Xóa ${selectedIds.length} tài liệu`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
