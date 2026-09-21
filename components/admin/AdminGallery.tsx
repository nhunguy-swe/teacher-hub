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

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-amber-400";
const labelCls = "font-semibold text-slate-600 block mb-1";
const closeBtnCls =
  "text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer";
const btnAmber =
  "px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5";
const btnRose =
  "px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5";
const btnGray =
  "px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5";
const searchCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors";
const selectCls =
  "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none";

export default function AdminGallery({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tìm kiếm / sắp xếp
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Modal thêm ảnh
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [titlePrefix, setTitlePrefix] = useState("");

  // Modal xóa nhanh
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteSearch, setDeleteSearch] = useState("");

  // Modal chỉnh sửa
  const [editItem, setEditItem] = useState<GalleryItem | null>(null);

  // Popup xác nhận xóa 1 ảnh
  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<GalleryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Popup xác nhận xóa hàng loạt (đè lên trên modal Xóa nhanh)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGallery(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GalleryItem),
      );
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const result = gallery.filter((g) =>
      g.title.toLowerCase().includes(search.toLowerCase().trim()),
    );
    if (sortBy === "title-asc")
      result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "title-desc")
      result.sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }, [gallery, search, sortBy]);

  // Chọn nhiều ảnh từ máy
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
            ? `${titlePrefix.trim()} (${i + 1})`
            : titlePrefix.trim()
          : file.name.split(".")[0];

        await addDoc(collection(db, "gallery"), {
          title: finalTitle,
          imageUrl: base64,
          createdAt: serverTimestamp(),
        });
      }
      toast.success(`Đã tải lên thành công ${files.length} ảnh!`);
      setTitlePrefix("");
      setAddModalOpen(false);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải ảnh lên.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    if (!editItem.title.trim()) {
      toast.warning("Tiêu đề ảnh không được để trống!");
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "gallery", editItem.id), {
        title: editItem.title.trim(),
      });
      setEditItem(null);
      toast.success("Đã cập nhật tiêu đề ảnh thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật tiêu đề ảnh");
    } finally {
      setLoading(false);
    }
  };

  // Xóa 1 ảnh (được gọi từ popup xác nhận)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteDoc(doc(db, "gallery", confirmDeleteItem.id));
      toast.success(`Đã xóa ảnh "${confirmDeleteItem.title}"!`);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xóa ảnh");
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
        selectedIds.map((id) => deleteDoc(doc(db, "gallery", id))),
      );
      toast.success(`Đã xóa ${count} ảnh!`);
      setDeleteModalOpen(false);
      setSelectedIds([]);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xóa ảnh.");
    } finally {
      setBatchDeleting(false);
      setConfirmBatchDelete(false);
    }
  };

  const deleteList = gallery.filter((g) =>
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Ảnh kỷ niệm
        </h2>
        <div className="flex items-center gap-2">
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
            Thêm ảnh
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
            {gallery.length}
          </p>
          <p className="text-[11px] font-semibold text-amber-700/70 m-0">
            Tổng số ảnh
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
            placeholder="Tìm kiếm ảnh theo tiêu đề..."
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

      {/* Lưới ảnh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 sm:col-span-2 lg:col-span-3">
            {gallery.length === 0
              ? "Chưa có ảnh kỷ niệm nào."
              : "Không tìm thấy ảnh phù hợp."}
          </p>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="min-w-0 bg-white p-6 rounded-3xl border border-sky-100 shadow-lg shadow-sky-900/5 space-y-4 flex flex-col justify-between transition-all hover:shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-3 min-w-0">
                <div className="w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="font-extrabold text-slate-800 text-base m-0 line-clamp-2 w-full min-w-0 break-all">
                  {item.title}
                </h4>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setEditItem(item)}
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

      {/* POPUP THÊM ẢNH */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Thêm nhiều ảnh kỷ niệm
              </h3>
              <button
                type="button"
                onClick={() => !loading && setAddModalOpen(false)}
                className={closeBtnCls}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500 m-0">
                Nhập tiêu đề (tùy chọn) và chọn nhiều ảnh từ máy tính.
              </p>

              <div>
                <label className={labelCls}>Tiêu đề chung</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hoạt động ngoại khóa..."
                  value={titlePrefix}
                  onChange={(e) => setTitlePrefix(e.target.value)}
                  className={inputCls}
                />
              </div>

              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-3xl bg-white transition shadow-2xs ${
                  loading
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:border-amber-500"
                }`}
              >
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
                <p className="text-center text-amber-600 font-bold animate-pulse m-0">
                  Đang xử lý và tải ảnh lên... Vui lòng đợi.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => setAddModalOpen(false)}
                className={`${btnGray} disabled:opacity-50`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÓA NHANH */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Xóa ảnh
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
                placeholder="Tìm kiếm ảnh theo tiêu đề..."
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
                  Không có ảnh nào.
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
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-rose-50/60 border-rose-200 text-rose-900"
                          : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.imageUrl}
                        alt={g.title}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0"
                      />
                      <p className="font-bold text-sm truncate m-0 min-w-0 flex-1">
                        {g.title}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
              <span className="text-xs font-semibold text-slate-500">
                Đã chọn:{" "}
                <strong className="text-rose-600">{selectedIds.length}</strong>{" "}
                ảnh
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

      {/* POPUP CHỈNH SỬA TIÊU ĐỀ */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Chỉnh sửa tiêu đề ảnh
              </h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className={closeBtnCls}
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editItem.imageUrl}
                alt={editItem.title}
                className="w-32 h-32 object-cover rounded-2xl border border-slate-100 shadow-xs"
              />
            </div>

            <div className="text-xs">
              <label className={labelCls}>Tiêu đề mới *</label>
              <input
                className={inputCls}
                value={editItem.title}
                onChange={(e) =>
                  setEditItem({ ...editItem, title: e.target.value })
                }
              />
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

      {/* POPUP XÁC NHẬN XÓA 1 ẢNH */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa ảnh này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa ảnh{" "}
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
                Xóa {selectedIds.length} ảnh đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIds.length}</strong>{" "}
                ảnh đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
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
                  : `Xóa ${selectedIds.length} ảnh`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
