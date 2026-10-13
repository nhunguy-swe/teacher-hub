"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { useLuckyDraw } from "@/components/admin/AdminLuckyDrawContext";

const btnAmber =
  "flex-1 h-10 px-3.5 text-xs font-bold bg-amber-50! text-amber-700! border border-amber-200 rounded-xl opacity-100! hover:bg-amber-600! hover:text-white! hover:border-amber-600 transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer " +
  "disabled:bg-slate-50! disabled:text-slate-400! disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed";

const btnRose =
  "flex-1 h-10 px-3.5 text-xs font-bold bg-rose-50! text-rose-700! border border-rose-200 rounded-xl opacity-100! hover:bg-rose-600! hover:text-white! hover:border-rose-600 transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer " +
  "disabled:bg-slate-50! disabled:text-slate-400! disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed";

const SUGGESTED_ICONS = [
  "⭐",
  "🎯",
  "🪑",
  "👑",
  "🎁",
  "⏰",
  "💡",
  "🌟",
  "📚",
  "🏆",
  "🎉",
  "🍀",
  "🎮",
  "🍭",
  "🎧",
  "📝",
  "🔥",
  "💎",
  "🚀",
  "❤️",
];

const DEFAULT_ICON = "🎁";

// Tách emoji đầu chuỗi và phần nội dung. VD: "⭐ Miễn bài tập" -> ["⭐", "Miễn bài tập"]
const EMOJI_RE =
  /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*(.*)$/u;

function splitPrivilege(text: string): { icon: string; label: string } {
  const m = text.match(EMOJI_RE);
  if (m) return { icon: m[1], label: m[2] };
  return { icon: DEFAULT_ICON, label: text };
}

function joinPrivilege(icon: string, label: string) {
  const ic = icon.trim();
  const lb = label.trim();
  return ic ? `${ic} ${lb}` : lb;
}

const TrashIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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
);

const ChevronIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export default function PrivilegeManager() {
  const toast = useToast();
  const {
    privileges,
    addPrivilege,
    updatePrivilege,
    deletePrivilege,
    deletePrivileges,
  } = useLuckyDraw();

  // Form thêm
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [label, setLabel] = useState("");
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");

  // Modal sửa
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editIcon, setEditIcon] = useState(DEFAULT_ICON);
  const [editLabel, setEditLabel] = useState("");
  const [showEditIconDropdown, setShowEditIconDropdown] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);

  // Modal xóa từng mục
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Modal xóa nhanh
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Thu gọn / mở rộng panel
  const [isOpen, setIsOpen] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);

  const toggleOpen = () => {
    if (isOpen) {
      setOverflowVisible(false); // đóng: bật lại overflow-hidden ngay
      setIsOpen(false);
    } else {
      setIsOpen(true); // mở: overflow-visible được bật sau khi animate xong
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowIconDropdown(false);
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

  // Giữ lại index gốc để sửa/xóa đúng phần tử khi đang lọc
  const items = useMemo(
    () =>
      privileges.map((text, index) => ({
        index,
        text,
        ...splitPrivilege(text),
      })),
    [privileges],
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return items;
    return items.filter((it) => it.label.toLowerCase().includes(term));
  }, [items, searchTerm]);

  // ---------- Thêm ----------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    if (!addPrivilege(joinPrivilege(icon, label))) {
      toast.warning("Đặc quyền này đã tồn tại trong danh sách!");
      return;
    }
    toast.success(`Đã thêm đặc quyền "${label.trim()}"!`);
    setLabel("");
    setIcon(DEFAULT_ICON);
  };

  // ---------- Sửa ----------
  const handleOpenEdit = (index: number) => {
    const { icon: ic, label: lb } = splitPrivilege(privileges[index]);
    setEditingIndex(index);
    setEditIcon(ic);
    setEditLabel(lb);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null) return;
    if (!editLabel.trim()) {
      toast.warning("Nội dung đặc quyền không được để trống!");
      return;
    }
    if (!updatePrivilege(editingIndex, joinPrivilege(editIcon, editLabel))) {
      toast.warning("Đặc quyền này đã tồn tại trong danh sách!");
      return;
    }
    toast.success("Đã cập nhật đặc quyền!");
    setEditingIndex(null);
  };

  // ---------- Xóa từng mục ----------
  const handleConfirmDelete = () => {
    if (deleteIndex === null) return;
    deletePrivilege(deleteIndex);
    setDeleteIndex(null);
    toast.success("Đã xóa đặc quyền!");
  };

  // ---------- Xóa nhanh ----------
  const handleOpenBulk = () => {
    if (privileges.length === 0) {
      toast.warning("⚠️ Không có đặc quyền nào để xóa!");
      return;
    }
    setSelectedIdx([]);
    setShowBulkModal(true);
  };

  const toggleSelect = (index: number) => {
    setSelectedIdx((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const allSelected =
    items.length > 0 && items.every((it) => selectedIdx.includes(it.index));

  const handleSelectAll = () => {
    setSelectedIdx(allSelected ? [] : items.map((it) => it.index));
  };

  const handleRequestBulkDelete = () => {
    if (selectedIdx.length === 0) {
      toast.warning("⚠️ Vui lòng chọn ít nhất một đặc quyền để xóa!");
      return;
    }
    setConfirmBulkDelete(true);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedIdx.length;
    deletePrivileges(selectedIdx);
    toast.success(`Đã xóa ${count} đặc quyền!`);
    setConfirmBulkDelete(false);
    setShowBulkModal(false);
    setSelectedIdx([]);
  };

  const renderCard = (it: { index: number; icon: string; label: string }) => (
    <div className="h-full bg-white border border-amber-100 hover:border-amber-300 rounded-3xl p-3.5 shadow-sm hover:shadow transition-all flex flex-col justify-between min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg">{it.icon}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(it.index)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-100 transition-all cursor-pointer"
            title="Sửa đặc quyền"
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
            onClick={() => setDeleteIndex(it.index)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
            title="Xóa đặc quyền"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-800 mt-2 min-h-8 line-clamp-2 wrap-break-word">
        {it.label}
      </p>
    </div>
  );

  return (
    <>
      <div className="lg:col-span-12 bg-white p-6 rounded-3xl shadow-lg shadow-amber-950/5 border border-amber-200">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={isOpen}
            className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
          >
            <h3 className="text-sm font-extrabold text-slate-800">
              Quản lý đặc quyền
            </h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {privileges.length} đặc quyền
            </span>
            <span
              className={`ml-auto text-slate-400 transition-transform duration-300 ${
                isOpen ? "rotate-180" : ""
              }`}
            >
              <ChevronIcon />
            </span>
          </button>
        </div>

        {/* Vùng thu gọn / mở rộng mượt */}
        <div
          aria-hidden={!isOpen}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && isOpen) {
              setOverflowVisible(true);
            }
          }}
          className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out ${
            isOpen
              ? "grid-rows-[1fr] opacity-100 visible"
              : "grid-rows-[0fr] opacity-0 invisible"
          }`}
        >
          <div
            className={`min-h-0 ${
              overflowVisible ? "overflow-visible" : "overflow-hidden"
            }`}
          >
            <div className="space-y-4 pt-4">
              <p className="text-xs text-slate-400">
                Khi học sinh bấm &quot;Đặc quyền&quot;, hệ thống chọn ngẫu nhiên
                tối đa 8 đặc quyền từ danh sách này.
              </p>

              {/* Khung thêm + tìm kiếm (giống trang Tiêu chí) */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div
                    className="relative flex items-center h-10 sm:col-span-2"
                    ref={dropdownRef}
                  >
                    <input
                      className="w-full h-full pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none text-center shadow-sm"
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      placeholder="🎁"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIconDropdown(!showIconDropdown)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <ChevronIcon />
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
                            className="h-8 flex items-center justify-center text-lg hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-7">
                    <input
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Tên đặc quyền... (vd: Miễn 1 bài tập về nhà)"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3 flex gap-2">
                    <button type="submit" className={btnAmber}>
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
                      onClick={handleOpenBulk}
                      disabled={privileges.length === 0}
                      className={btnRose}
                    >
                      <TrashIcon />
                      Xóa
                    </button>
                  </div>
                </form>

                <div className="flex items-center justify-between pt-1">
                  <input
                    type="text"
                    className="w-full px-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm đặc quyền..."
                  />
                </div>
              </div>

              {/* Danh sách dạng thẻ */}
              {filteredItems.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  {privileges.length === 0
                    ? "Chưa có đặc quyền nào. Hãy thêm mới."
                    : "Không tìm thấy đặc quyền phù hợp."}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredItems.map((it) => (
                    <div
                      key={`${it.text}-${it.index}`}
                      className="min-w-0 h-full"
                    >
                      {renderCard(it)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL SỬA ĐẶC QUYỀN */}
      {editingIndex !== null && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-amber-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Chỉnh sửa đặc quyền
              </h3>
              <button
                onClick={() => setEditingIndex(null)}
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
                    placeholder="🎁"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowEditIconDropdown(!showEditIconDropdown)
                    }
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <ChevronIcon />
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
                  Tên đặc quyền
                </label>
                <input
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none shadow-sm"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Nhập tên đặc quyền..."
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50! text-slate-700! border border-slate-200 rounded-xl opacity-100! hover:bg-slate-200! hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50! text-amber-700! border border-amber-200 rounded-xl opacity-100! hover:bg-amber-600! hover:text-white! hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA TỪNG ĐẶC QUYỀN */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 z-80 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa đặc quyền này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Đặc quyền{" "}
                <strong className="text-slate-800">
                  &quot;{privileges[deleteIndex]}&quot;
                </strong>{" "}
                sẽ bị xóa khỏi danh sách. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteIndex(null)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA NHANH */}
      {showBulkModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Xóa nhanh đặc quyền
                </h3>
                <p className="text-xs text-slate-500">
                  Chọn các đặc quyền bạn muốn xóa khỏi danh sách
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                Chọn tất cả ({selectedIdx.length}/{items.length})
              </label>
              <span className="text-slate-400">
                Đã chọn {selectedIdx.length} mục
              </span>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1 max-h-[40vh] scroll-smooth">
              {items.map((it) => (
                <div
                  key={`${it.text}-${it.index}`}
                  onClick={() => toggleSelect(it.index)}
                  className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                    selectedIdx.includes(it.index)
                      ? "bg-rose-50/50 border-rose-200 shadow-2xs scale-[0.995]"
                      : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIdx.includes(it.index)}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 pointer-events-none"
                    />
                    <span className="text-base">{it.icon}</span>
                    <p className="text-xs font-bold text-slate-800">
                      {it.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRequestBulkDelete}
                disabled={selectedIdx.length === 0}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                Xóa các mục đã chọn ({selectedIdx.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XÁC NHẬN CUỐI TRƯỚC KHI XÓA HÀNG LOẠT */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-90 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedIdx.length} đặc quyền đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">{selectedIdx.length}</strong>{" "}
                đặc quyền đã chọn sẽ bị xóa. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer"
              >
                Xóa {selectedIdx.length} đặc quyền
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
