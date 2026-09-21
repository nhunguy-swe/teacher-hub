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

interface GameItem {
  id: string;
  title: string;
  subject: string;
  link: string;
  grade: string;
  type: string;
}

interface Props {
  onAdded: () => void;
}

const DEFAULT_TYPES = ["Kahoot", "Wordwall"];
const DEFAULT_SUBJECTS = [
  "Tiếng Anh",
  "Toán",
  "Tiếng Việt",
  "Tự nhiên & Xã hội",
  "Khoa học",
];

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

export default function AdminGames({ onAdded }: Props) {
  const toast = useToast();
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Bộ lọc / sắp xếp
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modal thêm mới
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Tiếng Anh");
  const [customSubject, setCustomSubject] = useState("");
  const [link, setLink] = useState("");
  const [grade, setGrade] = useState("1");
  const [type, setType] = useState("Kahoot");
  const [customType, setCustomType] = useState("");

  // Modal xóa nhanh
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteSearch, setDeleteSearch] = useState("");

  // Modal chỉnh sửa
  const [editItem, setEditItem] = useState<GameItem | null>(null);
  const [isEditCustomType, setIsEditCustomType] = useState(false);
  const [editCustomType, setEditCustomType] = useState("");
  const [isEditCustomSubject, setIsEditCustomSubject] = useState(false);
  const [editCustomSubject, setEditCustomSubject] = useState("");

  // Popup xác nhận xóa 1 trò chơi
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<GameItem | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Popup xác nhận xóa hàng loạt (đè lên trên modal Xóa nhanh)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGames(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as GameItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const result = games.filter(
      (g) =>
        (gradeFilter === "all" || String(g.grade) === gradeFilter) &&
        g.title.toLowerCase().includes(search.toLowerCase().trim()),
    );
    if (sortBy === "title-asc")
      result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "title-desc")
      result.sort((a, b) => b.title.localeCompare(a.title));
    else if (sortBy === "grade")
      result.sort(
        (a, b) =>
          Number(a.grade) - Number(b.grade) || a.title.localeCompare(b.title),
      );
    return result;
  }, [games, search, gradeFilter, sortBy]);

  const stats = useMemo(() => {
    const kahoot = games.filter((g) => g.type === "Kahoot").length;
    const wordwall = games.filter((g) => g.type === "Wordwall").length;
    return {
      total: games.length,
      kahoot,
      wordwall,
      other: games.length - kahoot - wordwall,
    };
  }, [games]);

  const resetAddForm = () => {
    setTitle("");
    setLink("");
    setSubject("Tiếng Anh");
    setCustomSubject("");
    setGrade("1");
    setType("Kahoot");
    setCustomType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !link.trim()) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    const finalType = type === "Khác" ? customType.trim() : type;
    if (!finalType) {
      toast.warning("Vui lòng nhập tên loại game tùy chỉnh!");
      return;
    }
    const finalSubject = subject === "Khác" ? customSubject.trim() : subject;
    if (!finalSubject) {
      toast.warning("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "games"), {
        title: title.trim(),
        subject: finalSubject,
        link: link.trim(),
        grade,
        type: finalType,
        createdAt: serverTimestamp(),
      });
      toast.success("Đã thêm trò chơi thành công!");
      resetAddForm();
      setAddModalOpen(false);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (game: GameItem) => {
    const typeIsDefault = DEFAULT_TYPES.includes(game.type);
    const subjectIsDefault = DEFAULT_SUBJECTS.includes(game.subject);
    setEditItem({
      ...game,
      type: typeIsDefault ? game.type : "Khác",
      subject: subjectIsDefault ? game.subject : "Khác",
    });
    setIsEditCustomType(!typeIsDefault);
    setEditCustomType(typeIsDefault ? "" : game.type);
    setIsEditCustomSubject(!subjectIsDefault);
    setEditCustomSubject(subjectIsDefault ? "" : game.subject);
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const finalType = isEditCustomType ? editCustomType.trim() : editItem.type;
    if (!finalType) {
      toast.warning("Vui lòng nhập tên loại game tùy chỉnh!");
      return;
    }
    const finalSubject = isEditCustomSubject
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
      await updateDoc(doc(db, "games", editItem.id), {
        title: editItem.title.trim(),
        subject: finalSubject,
        link: editItem.link.trim(),
        grade: editItem.grade,
        type: finalType,
      });
      toast.success("Đã cập nhật trò chơi thành công!");
      setEditItem(null);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật trò chơi");
    } finally {
      setLoading(false);
    }
  };

  // Xóa 1 trò chơi (được gọi từ popup xác nhận)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteDoc(doc(db, "games", confirmDeleteItem.id));
      toast.success(`Đã xóa trò chơi "${confirmDeleteItem.title}"!`);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa!");
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
        selectedIds.map((id) => deleteDoc(doc(db, "games", id))),
      );
      toast.success(`Đã xóa ${count} trò chơi!`);
      setDeleteModalOpen(false);
      setSelectedIds([]);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xóa trò chơi.");
    } finally {
      setBatchDeleting(false);
      setConfirmBatchDelete(false);
    }
  };

  const deleteList = games.filter((g) =>
    g.title.toLowerCase().includes(deleteSearch.toLowerCase().trim()),
  );
  const allDeleteSelected =
    deleteList.length > 0 &&
    deleteList.every((g) => selectedIds.includes(g.id));

  const toggleSelectAll = () => {
    const ids = deleteList.map((g) => g.id);
    if (allDeleteSelected) {
      setSelectedIds(selectedIds.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...ids])));
    }
  };

  const typeBadge = (t: string) =>
    t === "Kahoot"
      ? "bg-purple-50 border-purple-100 text-purple-700"
      : t === "Wordwall"
        ? "bg-sky-50 border-sky-100 text-sky-700"
        : "bg-emerald-50 border-emerald-100 text-emerald-700";

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
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
            <line x1="6" y1="12" x2="10" y2="12" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <circle cx="15" cy="13" r="1" />
            <circle cx="18" cy="11" r="1" />
            <path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
          </svg>
          Trò chơi
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
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
            Thêm trò chơi
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            n: stats.total,
            l: "Tổng trò chơi",
            box: "bg-amber-50 border-amber-100",
            num: "text-amber-700",
            lab: "text-amber-700/70",
          },
          {
            n: stats.kahoot,
            l: "Kahoot",
            box: "bg-purple-50 border-purple-100",
            num: "text-purple-700",
            lab: "text-purple-700/70",
          },
          {
            n: stats.wordwall,
            l: "Wordwall",
            box: "bg-sky-50 border-sky-100",
            num: "text-sky-700",
            lab: "text-sky-700/70",
          },
          {
            n: stats.other,
            l: "Khác",
            box: "bg-emerald-50 border-emerald-100",
            num: "text-emerald-700",
            lab: "text-emerald-700/70",
          },
        ].map((s) => (
          <div
            key={s.l}
            className={`${s.box} border rounded-3xl px-4 py-3 text-center`}
          >
            <p className={`text-lg font-extrabold ${s.num} m-0`}>{s.n}</p>
            <p className={`text-[11px] font-semibold ${s.lab} m-0`}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Tìm kiếm / lọc / sắp xếp */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <input
            type="text"
            placeholder="Tìm kiếm trò chơi..."
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
        ← Vuốt ngang để xem thêm trò chơi →
      </p>
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 w-full shrink-0 sm:col-span-2 lg:col-span-3">
            {games.length === 0
              ? "Chưa có trò chơi nào."
              : "Không tìm thấy trò chơi phù hợp."}
          </p>
        ) : (
          filtered.map((g) => (
            <div
              key={g.id}
              className="w-full min-w-full shrink-0 snap-center snap-always sm:w-auto sm:min-w-0 sm:shrink bg-white p-6 rounded-3xl border border-sky-100 shadow-lg shadow-sky-900/5 space-y-4 flex flex-col justify-between transition-all hover:shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-linear-to-tr from-amber-400 to-rose-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <svg
                    width="26"
                    height="26"
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
                </div>
                <h4 className="font-extrabold text-slate-800 text-base m-0 line-clamp-2 w-full min-w-0 break-all">
                  {g.title}
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[11px] font-bold text-amber-700">
                    Lớp {g.grade}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeBadge(g.type)}`}
                  >
                    {g.type}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/40 p-3.5 rounded-3xl border border-amber-100/60 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Môn học</span>
                  <span className="font-bold text-slate-800">{g.subject}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-slate-500 font-medium">Liên kết</span>
                  <a
                    href={g.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sky-600 hover:underline truncate"
                  >
                    Mở trò chơi
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(g)}
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
                  onClick={() => setConfirmDeleteItem(g)}
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

      {/* POPUP THÊM TRÒ CHƠI */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Thêm trò chơi mới
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
                <label className={labelCls}>Tên trò chơi *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Ôn tập Unit 1 - Animals"
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Lớp</label>
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
                  <label className={labelCls}>Loại game</label>
                  <select
                    className={inputCls}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {DEFAULT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {type === "Khác" && (
                <div>
                  <label className={labelCls}>Nhập loại game tùy chỉnh</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Quizizz, Bizia..."
                    className={inputCustomCls}
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                  />
                </div>
              )}

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

              {subject === "Khác" && (
                <div>
                  <label className={labelCls}>Nhập tên môn học tùy chỉnh</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Địa lý, Giáo dục thể chất..."
                    className={inputCustomCls}
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Link trò chơi *</label>
                <input
                  type="url"
                  required
                  placeholder="Dán link trò chơi tại đây..."
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
                  {loading ? "Đang xử lý..." : "Thêm trò chơi"}
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
                Xóa trò chơi
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
                placeholder="Tìm kiếm trò chơi theo tên..."
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
                  Không có trò chơi nào.
                </p>
              ) : (
                deleteList.map((g) => {
                  const isSelected = selectedIds.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() =>
                        setSelectedIds(
                          isSelected
                            ? selectedIds.filter((id) => id !== g.id)
                            : [...selectedIds, g.id],
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
                            {g.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            Lớp {g.grade} - {g.subject}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-600 shrink-0">
                        {g.type}
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
                trò chơi
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
                Chỉnh sửa trò chơi
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
                <label className={labelCls}>Tên trò chơi *</label>
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
                  <label className={labelCls}>Lớp</label>
                  <select
                    className={inputCls}
                    value={editItem.grade}
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
                  <label className={labelCls}>Loại game</label>
                  <select
                    className={inputCls}
                    value={editItem.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIsEditCustomType(val === "Khác");
                      setEditItem({ ...editItem, type: val });
                    }}
                  >
                    {DEFAULT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {isEditCustomType && (
                <div>
                  <label className={labelCls}>Nhập loại game tùy chỉnh</label>
                  <input
                    className={inputCustomCls}
                    value={editCustomType}
                    onChange={(e) => setEditCustomType(e.target.value)}
                    placeholder="VD: Quizizz, Bizia..."
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Môn học</label>
                <select
                  className={inputCls}
                  value={editItem.subject}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIsEditCustomSubject(val === "Khác");
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

              {isEditCustomSubject && (
                <div>
                  <label className={labelCls}>Nhập tên môn học tùy chỉnh</label>
                  <input
                    className={inputCustomCls}
                    value={editCustomSubject}
                    onChange={(e) => setEditCustomSubject(e.target.value)}
                    placeholder="VD: Địa lý, Giáo dục thể chất..."
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Link trò chơi *</label>
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

      {/* POPUP XÁC NHẬN XÓA 1 TRÒ CHƠI */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa trò chơi?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa trò chơi{" "}
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
                Xóa {selectedIds.length} trò chơi đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIds.length}</strong>{" "}
                trò chơi đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
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
                  : `Xóa ${selectedIds.length} trò chơi`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
