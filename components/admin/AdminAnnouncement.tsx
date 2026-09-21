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

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  dateStr?: string;
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-400";
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

const getTodayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const formatDateToDisplay = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};
const formatDateToISO = (dateStr?: string) => {
  if (!dateStr) return getTodayISO();
  if (dateStr.includes("/")) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m}-${d}`;
  }
  return dateStr;
};

const BellIcon = ({ size = 14 }: { size?: number }) => (
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
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

export default function AdminAnnouncement({
  onAdded,
}: {
  onAdded?: () => void;
}) {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tìm kiếm / sắp xếp
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Modal thêm mới
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dateISO, setDateISO] = useState(getTodayISO());

  // Modal xóa nhanh
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteSearch, setDeleteSearch] = useState("");

  // Modal chỉnh sửa
  const [editItem, setEditItem] = useState<
    (AnnouncementItem & { dateISO: string }) | null
  >(null);

  // Popup xác nhận xóa 1 thông báo
  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<AnnouncementItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Popup xác nhận xóa hàng loạt (đè lên trên modal Xóa nhanh)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(
        snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as AnnouncementItem,
        ),
      );
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const kw = search.toLowerCase().trim();
    const result = announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(kw) ||
        (a.content || "").toLowerCase().includes(kw),
    );
    if (sortBy === "title-asc")
      result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "title-desc")
      result.sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }, [announcements, search, sortBy]);

  const resetAddForm = () => {
    setTitle("");
    setContent("");
    setDateISO(getTodayISO());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        content: content.trim(),
        dateStr: formatDateToDisplay(dateISO),
        createdAt: serverTimestamp(),
      });
      toast.success("Đã đăng thông báo mới!");
      resetAddForm();
      setAddModalOpen(false);
      onAdded?.();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi đăng thông báo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    if (!editItem.title.trim() || !editItem.content.trim()) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "announcements", editItem.id), {
        title: editItem.title.trim(),
        content: editItem.content.trim(),
        dateStr: formatDateToDisplay(editItem.dateISO || getTodayISO()),
      });
      setEditItem(null);
      toast.success("Đã cập nhật thông báo thành công!");
      onAdded?.();
    } catch (err) {
      console.error(err);
      toast.error("Cập nhật thất bại, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Xóa 1 thông báo (được gọi từ popup xác nhận)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteDoc(doc(db, "announcements", confirmDeleteItem.id));
      toast.success(`Đã xóa thông báo "${confirmDeleteItem.title}"!`);
      onAdded?.();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa thông báo");
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
        selectedIds.map((id) => deleteDoc(doc(db, "announcements", id))),
      );
      toast.success(`Đã xóa ${count} thông báo!`);
      setDeleteModalOpen(false);
      setSelectedIds([]);
      onAdded?.();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xóa thông báo.");
    } finally {
      setBatchDeleting(false);
      setConfirmBatchDelete(false);
    }
  };

  const deleteList = announcements.filter((a) =>
    a.title.toLowerCase().includes(deleteSearch.toLowerCase().trim()),
  );
  const allDeleteSelected =
    deleteList.length > 0 &&
    deleteList.every((a) => selectedIds.includes(a.id));

  const toggleSelectAll = () => {
    const ids = deleteList.map((a) => a.id);
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
            <BellIcon size={20} />
          </span>
          Thông báo
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setDateISO(getTodayISO());
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
            Thêm thông báo
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
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-amber-700 m-0">
            {announcements.length}
          </p>
          <p className="text-[11px] font-semibold text-amber-700/70 m-0">
            Tổng thông báo
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-sky-700 m-0">
            {filtered.length}
          </p>
          <p className="text-[11px] font-semibold text-sky-700/70 m-0">
            Đang hiển thị
          </p>
        </div>
      </div>

      {/* Tìm kiếm / sắp xếp */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-3">
          <input
            type="text"
            placeholder="Tìm kiếm thông báo..."
            className={searchCls}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={selectCls}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Mới đăng nhất</option>
          <option value="title-asc">Tiêu đề (A → Z)</option>
          <option value="title-desc">Tiêu đề (Z → A)</option>
        </select>
      </div>

      {/* Danh sách thẻ */}
      <p className="sm:hidden text-center text-[11px] text-slate-500 font-medium m-0">
        ← Vuốt ngang để xem thông báo khác →
      </p>

      {/* Danh sách thẻ */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 w-full shrink-0 lg:col-span-3">
            {announcements.length === 0
              ? "Chưa có thông báo nào."
              : "Không tìm thấy thông báo phù hợp."}
          </p>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="w-full min-w-full shrink-0 snap-center snap-always sm:w-auto sm:min-w-0 sm:shrink bg-white p-6 rounded-3xl border border-sky-100 shadow-lg shadow-sky-900/5 space-y-4 flex flex-col justify-between transition-all hover:shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-linear-to-tr from-amber-400 to-rose-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <BellIcon size={26} />
                </div>
                <h4 className="font-extrabold text-slate-800 text-base m-0 line-clamp-2 w-full min-w-0 break-all">
                  {item.title}
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[11px] font-bold text-amber-700">
                    {item.dateStr || "Chưa có ngày"}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/40 p-3.5 rounded-3xl border border-amber-100/60 text-xs">
                <p className="text-slate-600 m-0 line-clamp-3 min-h-12 whitespace-pre-line wrap-break-word">
                  {item.content || "Chưa có nội dung."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() =>
                    setEditItem({
                      ...item,
                      dateISO: formatDateToISO(item.dateStr),
                    })
                  }
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

      {/* POPUP THÊM THÔNG BÁO */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Đăng thông báo mới
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
                <label className={labelCls}>Tiêu đề *</label>
                <input
                  type="text"
                  required
                  placeholder="Tiêu đề thông báo..."
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className={labelCls}>Ngày đăng</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    className={inputCls}
                    value={dateISO}
                    onChange={(e) => setDateISO(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setDateISO(getTodayISO())}
                    className={`${btnGray} shrink-0`}
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Nội dung *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nội dung chi tiết thông báo..."
                  className={`${inputCls} resize-none`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
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
                  {loading ? "Đang gửi..." : "Đăng thông báo"}
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
                Xóa thông báo
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
                placeholder="Tìm kiếm thông báo theo tiêu đề..."
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
                  Không có thông báo nào.
                </p>
              ) : (
                deleteList.map((a) => {
                  const isSelected = selectedIds.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() =>
                        setSelectedIds(
                          isSelected
                            ? selectedIds.filter((id) => id !== a.id)
                            : [...selectedIds, a.id],
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
                            {a.title}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {a.content}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-600 shrink-0">
                        {a.dateStr || "—"}
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
                thông báo
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
                Chỉnh sửa thông báo
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
                <label className={labelCls}>Tiêu đề *</label>
                <input
                  className={inputCls}
                  value={editItem.title}
                  onChange={(e) =>
                    setEditItem({ ...editItem, title: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelCls}>Ngày đăng</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className={inputCls}
                    value={editItem.dateISO}
                    onChange={(e) =>
                      setEditItem({ ...editItem, dateISO: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditItem({ ...editItem, dateISO: getTodayISO() })
                    }
                    className={`${btnGray} shrink-0`}
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Nội dung *</label>
                <textarea
                  rows={5}
                  className={`${inputCls} resize-none`}
                  value={editItem.content}
                  onChange={(e) =>
                    setEditItem({ ...editItem, content: e.target.value })
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
                {loading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA 1 THÔNG BÁO */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa thông báo?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa thông báo{" "}
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
                Xóa {selectedIds.length} thông báo đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIds.length}</strong>{" "}
                thông báo đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
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
                  : `Xóa ${selectedIds.length} thông báo`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
