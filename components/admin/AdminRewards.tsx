"use client";

import { useState, useEffect, useRef } from "react";
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
  writeBatch,
} from "firebase/firestore";

interface RewardItem {
  id: string;
  icon: string;
  name: string;
  cost: number;
}
interface StudentItem {
  id: string;
  name: string;
  stars: number;
}

const REWARD_ICONS = [
  "🎁",
  "⭐",
  "🏆",
  "📘",
  "🎒",
  "🧸",
  "⚽",
  "🎨",
  "👑",
  "🚀",
];

export default function AdminRewards() {
  const toast = useToast();
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [icon, setIcon] = useState("🎁");
  const [name, setName] = useState("");
  const [cost, setCost] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [redeemFor, setRedeemFor] = useState<RewardItem | null>(null);
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [isEditIconDropdownOpen, setIsEditIconDropdownOpen] = useState(false);
  const [selectedRewards, setSelectedRewards] = useState<string[]>([]);

  // Thêm các state và ref này vào trong component AdminRewards
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);

  // State cho popup xác nhận xóa 1 phần quà
  const [confirmDeleteReward, setConfirmDeleteReward] =
    useState<RewardItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // State cho popup xác nhận xóa hàng loạt phần quà
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        iconDropdownRef.current &&
        !iconDropdownRef.current.contains(event.target as Node)
      ) {
        setShowIconDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "rewards"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRewards(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as RewardItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(
        snapshot.docs.map((d) => ({
          id: d.id,
          stars: 0,
          ...d.data(),
        })) as StudentItem[],
      );
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addDoc(collection(db, "rewards"), {
        icon: icon || "🎁",
        name: name.trim(),
        cost,
        createdAt: serverTimestamp(),
      });
      toast.success(`Đã thêm phần quà "${name.trim()}"!`);
      setName("");
      setIcon("🎁");
      setCost(10);
    } catch {
      toast.error("Lỗi khi thêm phần quà");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward || !editingReward.name.trim()) return;
    try {
      await updateDoc(doc(db, "rewards", editingReward.id), {
        icon: editingReward.icon || "🎁",
        name: editingReward.name.trim(),
        cost: editingReward.cost,
      });
      toast.success("Đã cập nhật phần quà thành công!");
      setEditingReward(null);
    } catch (error) {
      console.error("Lỗi khi cập nhật phần quà:", error);
      toast.error("Lỗi khi cập nhật phần quà");
    }
  };

  // Xóa 1 phần quà (được gọi từ popup xác nhận)
  const handleConfirmDeleteReward = async () => {
    if (!confirmDeleteReward) return;
    setDeletingId(confirmDeleteReward.id);
    try {
      await deleteDoc(doc(db, "rewards", confirmDeleteReward.id));
      toast.success(`Đã xóa phần quà "${confirmDeleteReward.name}"!`);
      setSelectedRewards((prev) =>
        prev.filter((id) => id !== confirmDeleteReward.id),
      );
    } catch (error) {
      console.error("Lỗi khi xóa phần quà:", error);
      toast.error("Lỗi khi xóa phần quà");
    } finally {
      setDeletingId(null);
      setConfirmDeleteReward(null);
    }
  };

  // Bấm nút "Xóa (n)" ở thanh công cụ → mở popup xác nhận
  const handleRequestBulkDelete = () => {
    if (selectedRewards.length === 0) return;
    setConfirmBulkDelete(true);
  };

  // Xóa hàng loạt sau khi đã xác nhận
  const handleConfirmBulkDelete = async () => {
    if (selectedRewards.length === 0) return;
    setBulkDeleting(true);
    try {
      const count = selectedRewards.length;
      const batch = writeBatch(db);
      selectedRewards.forEach((id) => {
        batch.delete(doc(db, "rewards", id));
      });
      await batch.commit();
      toast.success(`Đã xóa ${count} phần quà!`);
      setSelectedRewards([]);
    } catch (error) {
      console.error("Lỗi khi xóa các phần quà:", error);
      toast.error("Lỗi khi xóa các phần quà");
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const toggleSelectReward = (id: string) => {
    setSelectedRewards((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const filteredRewards = rewards.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const eligibleStudents = redeemFor
    ? students.filter((s) => (s.stars || 0) >= redeemFor.cost)
    : [];

  const confirmRedeem = async () => {
    if (!redeemFor || !selectedStudent) return;
    const s = students.find((x) => x.id === selectedStudent);
    if (!s || (s.stars || 0) < redeemFor.cost) {
      toast.warning("Học sinh không đủ điểm");
      return;
    }
    try {
      await updateDoc(doc(db, "students", s.id), {
        stars: (s.stars || 0) - redeemFor.cost,
      });
      await addDoc(collection(db, "activityLog"), {
        name: s.name,
        label: `Đổi quà: ${redeemFor.name}`,
        delta: -redeemFor.cost,
        createdAt: serverTimestamp(),
      });
      toast.success(`🎉 ${s.name} đã đổi thành công: ${redeemFor.name}`);
      setRedeemFor(null);
      setSelectedStudent("");
    } catch {
      toast.error("Lỗi khi đổi quà");
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 ">
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
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
          </svg>
          Trạm quà đổi điểm
        </h2>
      </div>

      <div className="space-y-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
        >
          {/* Ô chọn icon */}
          <div
            className="relative flex items-center h-10 sm:col-span-2"
            ref={iconDropdownRef}
          >
            <input
              className="w-full h-full pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-xs"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🎁"
            />
            <button
              type="button"
              onClick={() => setShowIconDropdown(!showIconDropdown)}
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

            {showIconDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1">
                {REWARD_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setIcon(emoji);
                      setShowIconDropdown(false);
                    }}
                    className="h-8 flex items-center justify-center text-lg hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ô Tên phần quà */}
          <div className="sm:col-span-5">
            <input
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên phần quà..."
              required
            />
          </div>

          {/* Ô Điểm số */}
          <div className="sm:col-span-2">
            <input
              type="number"
              min={1}
              className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-xs"
              value={cost}
              onChange={(e) => setCost(parseInt(e.target.value) || 1)}
              placeholder="Điểm"
            />
          </div>

          {/* Cụm nút Thêm & Xóa */}
          <div className="sm:col-span-3 flex gap-2">
            <button
              type="submit"
              className="flex-1 h-10 flex justify-center px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs items-center gap-1.5 cursor-pointer"
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
              onClick={handleRequestBulkDelete}
              disabled={selectedRewards.length === 0}
              className="flex-1 h-10 flex items-center justify-center px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs gap-1.5 disabled:opacity-50 cursor-pointer"
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
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Xóa{" "}
              {selectedRewards.length > 0 ? `(${selectedRewards.length})` : ""}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between pt-1">
          <input
            type="text"
            className="w-full h-10.5 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-xs placeholder:text-slate-400"
            placeholder="Tìm kiếm phần quà..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredRewards.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6 col-span-full">
            {rewards.length === 0
              ? "Chưa có phần quà nào."
              : "Không tìm thấy phần quà phù hợp."}
          </p>
        )}
        {filteredRewards.map((r) => {
          const isSelected = selectedRewards.includes(r.id);
          return (
            <div
              key={r.id}
              className={`relative bg-slate-50/70 border rounded-3xl p-4 text-center flex flex-col justify-between transition-all ${
                isSelected
                  ? "border-amber-400 bg-amber-50/20 shadow-xs"
                  : "border-slate-200/80"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSelectReward(r.id)}
                className={`absolute top-3 right-3 w-5 h-5 rounded-md border flex items-center justify-center text-xs transition ${
                  isSelected
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-slate-300 bg-white hover:border-slate-400"
                }`}
              >
                {isSelected && "✓"}
              </button>

              <div>
                <div className="text-3xl">{r.icon}</div>
                <p className="font-bold text-slate-800 text-xs mt-1.5">
                  {r.name}
                </p>
                <p className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2.5 py-1 rounded-full my-2">
                  ⭐ Đổi {r.cost} điểm
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  onClick={() => setEditingReward(r)}
                  className="py-1.5 px-2.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 transition-all flex items-center justify-center shadow-xs"
                  title="Sửa"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setRedeemFor(r)}
                  className="flex-1 py-1.5 bg-white text-emerald-600 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition-all flex items-center justify-center shadow-xs"
                  title="Đổi quà"
                >
                  <svg
                    className="w-4 h-4"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmDeleteReward(r)}
                  className="py-1.5 px-2.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all flex items-center justify-center shadow-xs"
                  title="Xóa"
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
          );
        })}
      </div>

      {editingReward && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <form
            onSubmit={handleUpdate}
            className="bg-white p-6 rounded-3xl  w-full max-w-sm border border-slate-100 shadow-xl space-y-4"
          >
            <h3 className="font-bold text-slate-800 text-base text-center">
              Chỉnh sửa phần quà
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <label className="text-xs text-slate-500 font-medium block mb-1">
                  Icon
                </label>
                <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl px-2 h-10.5 focus-within:border-amber-400">
                  <input
                    className="w-full text-center bg-transparent text-lg focus:outline-none cursor-pointer"
                    value={editingReward.icon}
                    onChange={(e) =>
                      setEditingReward({
                        ...editingReward,
                        icon: e.target.value,
                      })
                    }
                    onClick={() =>
                      setIsEditIconDropdownOpen(!isEditIconDropdownOpen)
                    }
                    required
                  />
                </div>

                {isEditIconDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 z-20">
                    {REWARD_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setEditingReward({ ...editingReward, icon: emoji });
                          setIsEditIconDropdownOpen(false);
                        }}
                        className="p-2 hover:bg-amber-50 rounded-lg text-center text-lg transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">
                  Tên phần quà
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-amber-400"
                  value={editingReward.name}
                  onChange={(e) =>
                    setEditingReward({ ...editingReward, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">
                  Điểm sao yêu cầu
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-amber-400"
                  value={editingReward.cost}
                  onChange={(e) =>
                    setEditingReward({
                      ...editingReward,
                      cost: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                />
              </div>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition"
              >
                Lưu thay đổi
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingReward(null);
                  setIsEditIconDropdownOpen(false);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        </div>
      )}

      {redeemFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-sm border border-[#EFE8D8] shadow-xl space-y-4">
            <div className="text-center">
              <div className="text-4xl">{redeemFor.icon}</div>
              <p className="font-extrabold text-slate-800 text-base m-0 mt-1">
                {redeemFor.name}
              </p>
              <p className="text-amber-700 font-bold text-xs">
                Yêu cầu ⭐ {redeemFor.cost}
              </p>
            </div>
            <select
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">-- Chọn học sinh --</option>
              {eligibleStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Có ⭐{s.stars})
                </option>
              ))}
            </select>
            {eligibleStudents.length === 0 && (
              <p className="text-[11px] text-rose-600 text-center">
                Không có học sinh nào đủ điểm.
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={confirmRedeem}
                disabled={!selectedStudent}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                Xác nhận đổi quà
              </button>
              <button
                onClick={() => {
                  setRedeemFor(null);
                  setSelectedStudent("");
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA 1 PHẦN QUÀ */}
      {confirmDeleteReward && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa phần quà này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa phần quà{" "}
                <strong className="text-slate-800">
                  &quot;{confirmDeleteReward.name}&quot;
                </strong>{" "}
                không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteReward(null)}
                disabled={deletingId === confirmDeleteReward.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReward}
                disabled={deletingId === confirmDeleteReward.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingId === confirmDeleteReward.id ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA HÀNG LOẠT PHẦN QUÀ */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedRewards.length} phần quà đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">
                  {selectedRewards.length}
                </strong>{" "}
                phần quà đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
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
                  : `Xóa ${selectedRewards.length} phần quà`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
