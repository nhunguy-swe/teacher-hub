"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

interface CriteriaItem {
  id: string;
  type: "pos" | "neg";
  icon: string;
  label: string;
  points: number;
}

const DEFAULT_PLUS_REASONS = [
  { icon: "⭐", label: "Trả lời đúng", points: 1 },
  { icon: "🌟", label: "Phát biểu tích cực", points: 1 },
  { icon: "💡", label: "Làm bài tốt", points: 2 },
  { icon: "📚", label: "Hoàn thành bài tập", points: 2 },
  { icon: "🤝", label: "Giúp đỡ bạn", points: 2 },
  { icon: "📈", label: "Có tiến bộ rõ rệt", points: 3 },
  { icon: "🏆", label: "Đạt điểm tốt", points: 5 },
];

const DEFAULT_MINUS_REASONS = [
  { icon: "🎒", label: "Quên đồ dùng học tập", points: 1 },
  { icon: "💬", label: "Nói chuyện riêng", points: 1 },
  { icon: "⚠️", label: "Chưa hoàn thành bài", points: 2 },
  { icon: "⏰", label: "Đi học muộn", points: 1 },
  { icon: "🤫", label: "Mất trật tự", points: 1 },
  { icon: "🧩", label: "Không hợp tác nhóm", points: 2 },
];

const SUGGESTED_ICONS = [
  "⭐",
  "🌟",
  "💡",
  "📚",
  "🤝",
  "📈",
  "🏆",
  "🎯",
  "🔥",
  "🏅",
  "🎒",
  "💬",
  "⚠️",
  "⏰",
  "🤫",
  "🧩",
  "❌",
  "📌",
  "📒",
  "✏️",
];

export default function AdminCriteria() {
  const toast = useToast();
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [type, setType] = useState<"pos" | "neg">("pos");
  const [icon, setIcon] = useState("⭐");
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State cho custom Type dropdown
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // State cho Modal Sửa
  const [editingItem, setEditingItem] = useState<CriteriaItem | null>(null);
  const [editIcon, setEditIcon] = useState("⭐");
  const [editLabel, setEditLabel] = useState("");
  const [editPoints, setEditPoints] = useState(1);
  const [showEditIconDropdown, setShowEditIconDropdown] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // State cho Modal Xóa từng mục riêng lẻ
  const [deletingItem, setDeletingItem] = useState<CriteriaItem | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);

  // State cho Modal Xóa Nhanh hiển thị danh sách chọn
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTab, setBulkTab] = useState<"pos" | "neg">("pos");

  // State cho popup xác nhận cuối cùng trước khi xóa hàng loạt
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // State cho ô tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");

  const [listTab, setListTab] = useState<"pos" | "neg">("pos"); // tab đang xem trên điện thoại

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowIconDropdown(false);
      }
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTypeDropdown(false);
      }
      if (
        editDropdownRef.current &&
        !editDropdownRef.current.contains(event.target as Node)
      ) {
        setShowEditIconDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const initDefaults = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "criteria"));
        if (querySnapshot.empty) {
          for (const item of DEFAULT_PLUS_REASONS) {
            await addDoc(collection(db, "criteria"), {
              type: "pos",
              icon: item.icon,
              label: item.label,
              points: item.points,
              createdAt: serverTimestamp(),
            });
          }
          for (const item of DEFAULT_MINUS_REASONS) {
            await addDoc(collection(db, "criteria"), {
              type: "neg",
              icon: item.icon,
              label: item.label,
              points: -Math.abs(item.points),
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        console.error("Lỗi tự động nạp tiêu chí mặc định:", error);
      }
    };
    initDefaults();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "criteria"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CriteriaItem[];
      setCriteria(data);
    });
    return () => unsubscribe();
  }, []);

  // Lọc tiêu chí dựa trên từ khóa tìm kiếm
  const filteredCriteria = useMemo(() => {
    if (!searchTerm.trim()) return criteria;
    return criteria.filter((item) =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );
  }, [criteria, searchTerm]);

  const posList = filteredCriteria.filter((c) => c.type === "pos");
  const negList = filteredCriteria.filter((c) => c.type === "neg");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "criteria"), {
        type,
        icon: icon || "⭐",
        label: label.trim(),
        points: type === "neg" ? -Math.abs(points) : Math.abs(points),
        createdAt: serverTimestamp(),
      });
      toast.success(`Đã thêm tiêu chí "${label.trim()}"!`);
      setLabel("");
      setIcon("⭐");
      setPoints(1);
    } catch {
      toast.error("Lỗi khi thêm tiêu chí");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: CriteriaItem) => {
    setEditingItem(item);
    setEditIcon(item.icon || "⭐");
    setEditLabel(item.label);
    setEditPoints(Math.abs(item.points));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editLabel.trim()) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "criteria", editingItem.id), {
        icon: editIcon || "⭐",
        label: editLabel.trim(),
        points:
          editingItem.type === "neg"
            ? -Math.abs(editPoints)
            : Math.abs(editPoints),
      });
      toast.success("Đã cập nhật tiêu chí thành công!");
      setEditingItem(null);
    } catch (error) {
      console.error("Lỗi khi cập nhật tiêu chí:", error);
      toast.error("Lỗi khi cập nhật tiêu chí");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setDeletingSingle(true);
    try {
      await deleteDoc(doc(db, "criteria", deletingItem.id));
      toast.success(`Đã xóa tiêu chí "${deletingItem.label}"!`);
      setDeletingItem(null);
    } catch (error) {
      console.error("Lỗi khi xóa tiêu chí:", error);
      toast.error("Lỗi khi xóa tiêu chí");
    } finally {
      setDeletingSingle(false);
    }
  };

  const handleOpenBulkDelete = () => {
    if (criteria.length === 0) {
      toast.warning("⚠️ Không có tiêu chí nào để xóa!");
      return;
    }
    setSelectedIds([]);
    setBulkTab("pos");
    setShowBulkDeleteModal(true);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const currentTabList =
    bulkTab === "pos"
      ? criteria.filter((c) => c.type === "pos")
      : criteria.filter((c) => c.type === "neg");

  const handleSelectAllCurrentTab = () => {
    const currentIds = currentTabList.map((c) => c.id);
    const allSelected = currentIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...currentIds]));
      setSelectedIds(merged);
    }
  };

  // Bấm "Xóa các mục đã chọn" trong modal chọn danh sách → mở popup xác nhận cuối cùng
  const handleRequestBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.warning("⚠️ Vui lòng chọn ít nhất một tiêu chí để xóa!");
      return;
    }
    setConfirmBulkDelete(true);
  };

  // Thực hiện xóa hàng loạt sau khi đã xác nhận
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const count = selectedIds.length;
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const docRef = doc(db, "criteria", id);
        batch.delete(docRef);
      });
      await batch.commit();
      toast.success(`Đã xóa ${count} tiêu chí!`);
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Lỗi khi xóa nhanh:", error);
      toast.error("Lỗi khi xóa các tiêu chí đã chọn");
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const renderCriteriaCard = (c: CriteriaItem) => {
    const isPos = c.type === "pos";
    return (
      <div
        className={`bg-white border ${
          isPos
            ? "border-emerald-100 hover:border-emerald-300"
            : "border-rose-100 hover:border-rose-300"
        } rounded-3xl p-3.5 shadow-sm hover:shadow transition-all flex flex-col justify-between min-w-0`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-lg">{c.icon}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(c)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-100 transition-all cursor-pointer"
                title="Sửa tiêu chí"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </button>
              <button
                onClick={() => setDeletingItem(c)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
                title="Xóa tiêu chí"
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
              </button>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2 line-clamp-2 wrap-break-word">
            {c.label}
          </p>
        </div>
        <div
          className={`mt-3 pt-2 border-t ${
            isPos ? "border-emerald-50" : "border-rose-50"
          }`}
        >
          <span
            className={`text-xs font-extrabold ${
              isPos ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {isPos ? "+" : "-"}
            {Math.abs(c.points)} điểm
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
            <svg
              className="w-5 h-5 text-amber-600"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Tiêu chí thi đua
          </h2>
        </div>
      </div>

      <div className="space-y-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
        {" "}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
        >
          <div className="relative sm:col-span-3" ref={typeDropdownRef}>
            <button
              type="button"
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5 truncate">
                {type === "pos" ? "🌟 Cộng điểm" : "⚠️ Trừ điểm"}
              </span>
              <svg
                className="w-4 h-4 text-slate-400 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showTypeDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setType("pos");
                    setShowTypeDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    type === "pos"
                      ? "bg-amber-50 text-amber-700 font-bold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  🌟 Cộng điểm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("neg");
                    setShowTypeDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    type === "neg"
                      ? "bg-amber-50 text-amber-700 font-bold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  ⚠️ Trừ điểm
                </button>
              </div>
            )}
          </div>

          <div
            className="relative flex items-center h-10 sm:col-span-2"
            ref={dropdownRef}
          >
            <input
              className="w-full h-full pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-sm"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="⭐"
            />
            <button
              type="button"
              onClick={() => setShowIconDropdown(!showIconDropdown)}
              className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showIconDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1">
                {SUGGESTED_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => {
                      setIcon(ic);
                      setShowIconDropdown(false);
                    }}
                    className="h-8 flex items-center justify-center text-lg hover:bg-amber-50 rounded-lg transition-all"
                  >
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            <input
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tên tiêu chí..."
              required
            />
          </div>

          <div className="sm:col-span-1">
            <input
              type="number"
              min={1}
              className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-sm"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="sm:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 flex justify-center px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs items-center gap-1.5"
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
              Thêm
            </button>
            <button
              type="button"
              onClick={handleOpenBulkDelete}
              disabled={loading || criteria.length === 0}
              className="flex-1 h-10 flex items-center justify-center px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs gap-1.5"
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
              Xóa
            </button>
          </div>
        </form>
        {/* Thanh tìm kiếm tiêu chí */}
        <div className="flex items-center justify-between pt-1">
          <input
            type="text"
            className="w-full px-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm tiêu chí thi đua..."
          />
        </div>
      </div>

      {/* Danh sách chính ngoài giao diện */}
      {/* Tab chuyển Cộng / Trừ: chỉ hiện trên điện thoại */}
      <div className="lg:hidden relative grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${
            listTab === "pos" ? "left-1" : "left-[calc(50%+2px)]"
          }`}
        />
        <button
          type="button"
          onClick={() => setListTab("pos")}
          className={`relative z-10 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            listTab === "pos" ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          🌟 Cộng điểm ({posList.length})
        </button>
        <button
          type="button"
          onClick={() => setListTab("neg")}
          className={`relative z-10 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            listTab === "neg" ? "text-rose-700" : "text-slate-500"
          }`}
        >
          ⚠️ Trừ điểm ({negList.length})
        </button>
      </div>

      {/* Danh sách chính */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột Cộng điểm */}
        <div className={listTab === "pos" ? "block" : "hidden lg:block"}>
          <p className="hidden lg:flex text-xs font-extrabold uppercase tracking-wider text-emerald-700 items-center gap-1.5 mb-3">
            <span>🌟</span> Tỏa sáng (Cộng điểm) ({posList.length})
          </p>
          {posList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              Không tìm thấy tiêu chí cộng điểm phù hợp.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {posList.map((c) => (
                <div key={c.id} className="min-w-0">
                  {renderCriteriaCard(c)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột Trừ điểm */}
        <div className={listTab === "neg" ? "block" : "hidden lg:block"}>
          <p className="hidden lg:flex text-xs font-extrabold uppercase tracking-wider text-rose-700 items-center gap-1.5 mb-3">
            <span>⚠️</span> Cần cố gắng (Trừ điểm) ({negList.length})
          </p>
          {negList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              Không tìm thấy tiêu chí trừ điểm phù hợp.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {negList.map((c) => (
                <div key={c.id}>{renderCriteriaCard(c)}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Sửa tiêu chí */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl  shadow-xl border border-amber-200  w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100  pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Chỉnh sửa tiêu chí
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Biểu tượng (Icon)
                </label>
                <div
                  className="relative flex items-center h-10"
                  ref={editDropdownRef}
                >
                  <input
                    className="w-full h-full pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-sm"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    placeholder="⭐"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowEditIconDropdown(!showEditIconDropdown)
                    }
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showEditIconDropdown && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1">
                      {SUGGESTED_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => {
                            setEditIcon(ic);
                            setShowEditIconDropdown(false);
                          }}
                          className="h-8 flex items-center justify-center text-lg hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên tiêu chí
                </label>
                <input
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Nhập tên tiêu chí..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điểm
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm"
                  value={editPoints}
                  onChange={(e) => setEditPoints(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={savingEdit}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa từng mục */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl  shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa tiêu chí này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa tiêu chí{" "}
                <strong className="text-slate-800">
                  &quot;{deletingItem.label}&quot;
                </strong>{" "}
                không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={deletingSingle}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingSingle}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingSingle ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa Nhanh (chọn danh sách) */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl  shadow-xl border border-slate-100 w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100  pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Xóa nhanh tiêu chí
                </h3>
                <p className="text-xs text-slate-500">
                  Chọn các tiêu chí bạn muốn xóa khỏi danh sách
                </p>
              </div>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${
                  bulkTab === "pos" ? "left-1" : "left-[calc(50%+2px)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setBulkTab("pos")}
                className={`relative z-10 py-2 px-3 text-xs font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  bulkTab === "pos"
                    ? "text-emerald-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>🌟</span> Cộng điểm (
                {criteria.filter((c) => c.type === "pos").length})
              </button>
              <button
                type="button"
                onClick={() => setBulkTab("neg")}
                className={`relative z-10 py-2 px-3 text-xs font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  bulkTab === "neg"
                    ? "text-rose-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>⚠️</span> Trừ điểm (
                {criteria.filter((c) => c.type === "neg").length})
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    currentTabList.length > 0 &&
                    currentTabList.every((c) => selectedIds.includes(c.id))
                  }
                  onChange={handleSelectAllCurrentTab}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                Chọn tất cả tab này (
                {
                  currentTabList.filter((c) => selectedIds.includes(c.id))
                    .length
                }
                /{currentTabList.length})
              </label>
              <span className="text-slate-400">
                Đã chọn tổng cộng {selectedIds.length} mục
              </span>
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1 space-y-2 pr-1 max-h-[40vh] scroll-smooth">
              {currentTabList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Không có tiêu chí nào trong mục này.
                </p>
              ) : (
                currentTabList.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => toggleSelectId(c.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedIds.includes(c.id)
                        ? "bg-rose-50/50 border-rose-200 shadow-2xs scale-[0.995]"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 pointer-events-none"
                      />
                      <span className="text-base">{c.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {c.label}
                        </p>
                        <span
                          className={`text-[10px] font-semibold ${c.type === "pos" ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {c.type === "pos" ? "Cộng điểm" : "Trừ điểm"} (
                          {c.points > 0 ? `+${c.points}` : c.points})
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRequestBulkDelete}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                Xóa các mục đã chọn ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận cuối cùng trước khi xóa hàng loạt (đè lên trên modal chọn danh sách) */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedIds.length} tiêu chí đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIds.length}</strong>{" "}
                tiêu chí đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {bulkDeleting
                  ? "Đang xóa..."
                  : `Xóa ${selectedIds.length} tiêu chí`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
