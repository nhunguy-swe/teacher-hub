"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface ItemData {
  id: string;
  parentName?: string;
  name?: string;
  sender?: string;
  studentInfo?: string;
  subject?: string;
  message?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

interface AdminContactProps {
  messages: ItemData[];
  onToggleStatus: (id: string, currentStatus: string) => void;
  onDelete: (colName: string, id: string) => void;
}

export default function AdminContact({
  messages,
  onToggleStatus,
  onDelete,
}: AdminContactProps) {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // State cho popup xác nhận xóa lời nhắn
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ItemData | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingMessages = messages.filter((item) => item.status !== "resolved");
  const resolvedMessages = messages.filter(
    (item) => item.status === "resolved",
  );
  const displayedMessages =
    activeTab === "pending" ? pendingMessages : resolvedMessages;

  const totalPages = Math.ceil(displayedMessages.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = displayedMessages.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleTabChange = (tab: "pending" | "resolved") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Lấy tên phụ huynh hiển thị, dùng chung cho danh sách và popup xác nhận
  const getSenderName = (item: ItemData) =>
    String(item.parentName || item.name || item.sender || "Phụ huynh ẩn danh");

  // Xử lý xóa lời nhắn (được gọi từ popup xác nhận)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await onDelete("contacts", confirmDeleteItem.id);
      toast.success(
        `Đã xóa lời nhắn của "${getSenderName(confirmDeleteItem)}"!`,
      );
    } catch (error) {
      console.error("Lỗi khi xóa lời nhắn:", error);
      toast.error("Xóa lời nhắn thất bại, vui lòng thử lại!");
    } finally {
      setDeletingId(null);
      setConfirmDeleteItem(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
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
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Lời nhắn từ phụ huynh
        </h2>

        <div className="relative flex bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200/65 shrink-0 w-full sm:w-85">
          {/* Lớp nền trượt (Slider background) */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-2xs transition-all duration-300 ease-in-out ${
              activeTab === "pending" ? "left-1" : "left-[calc(50%+2px)]"
            }`}
          />

          <button
            onClick={() => handleTabChange("pending")}
            className={`relative z-10 flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "pending"
                ? "text-amber-700"
                : "text-slate-500 hover:text-slate-700"
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
            >
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
            </svg>
            Chưa giải quyết
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200/80 text-slate-500"
              }`}
            >
              {pendingMessages.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("resolved")}
            className={`relative z-10 flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "resolved"
                ? "text-amber-700"
                : "text-slate-500 hover:text-slate-700"
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
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Đã giải quyết
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "resolved"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200/80 text-slate-500"
              }`}
            >
              {resolvedMessages.length}
            </span>
          </button>
        </div>
      </div>

      <div className="item-list">
        {displayedMessages.length === 0 ? (
          <div
            className="py-8 text-center rounded-3xl border border-dashed flex flex-col items-center gap-2 text-sm font-medium transition-all duration-300"
            style={{
              background: "var(--chalk)",
              borderColor: "var(--paper-line)",
              color: "var(--ink-soft)",
            }}
          >
            {activeTab === "pending" ? (
              <>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-500"
                >
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Tuyệt vời! Không có lời nhắn nào cần giải quyết.
              </>
            ) : (
              "Chưa có lời nhắn nào được đánh dấu hoàn thành."
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 transition-all duration-300 ease-in-out">
              {currentItems.map((item) => {
                const senderName = getSenderName(item);
                const studentInfo = String(
                  item.studentInfo ||
                    item.subject ||
                    item.class ||
                    "Chưa cập nhật lớp",
                );
                const msgContent = String(item.message || item.content || "");
                const isResolved = item.status === "resolved";

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 border rounded-3xl  shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ease-out transform ${
                      isResolved
                        ? "bg-slate-50/80 border-slate-200 opacity-75"
                        : "bg-white border-slate-200/80 hover:shadow-md hover:border-amber-300/60"
                    }`}
                  >
                    <div className="space-y-2.5 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-bold text-base flex items-center gap-1.5 ${
                            isResolved
                              ? "line-through text-slate-500"
                              : "text-slate-900"
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
                            className="text-rose-500"
                          >
                            <circle cx="12" cy="10" r="3" />
                            <path d="M12 2a8 8 0 00-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 00-8-8z" />
                          </svg>
                          Phụ huynh: {senderName}
                        </span>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full border inline-flex items-center gap-1 ${
                            isResolved
                              ? "bg-slate-200 text-slate-600 border-slate-300"
                              : "bg-amber-50 text-amber-800 border-amber-200/80"
                          }`}
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
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                          </svg>
                          Con/Lớp: {studentInfo}
                        </span>
                      </div>
                      <div
                        className={`text-sm leading-relaxed p-3.5 rounded-xl border ${
                          isResolved
                            ? "bg-slate-100/80 text-slate-500 border-slate-200 line-through"
                            : "bg-slate-50/70 text-slate-700 border-slate-100"
                        }`}
                      >
                        <span className="font-semibold text-xs text-slate-400 block mb-1 uppercase tracking-wider">
                          Nội dung nhắn:
                        </span>
                        {msgContent}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          onToggleStatus(item.id, item.status || "pending");
                          toast.success(
                            isResolved
                              ? "Đã hoàn tác trạng thái lời nhắn!"
                              : "Đã đánh dấu lời nhắn là hoàn thành!",
                          );
                        }}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                          isResolved
                            ? "text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-200 "
                            : "text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200"
                        }`}
                      >
                        {isResolved ? (
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
                            <path d="M9 14l-4-4 4-4" />
                            <path d="M5 10h11a4 4 0 010 8h-1" />
                          </svg>
                        ) : (
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
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {isResolved ? "Hoàn tác" : "Đã xong"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteItem(item)}
                        className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100  px-2 transition-all duration-300">
                <span className="text-xs text-slate-500 font-medium">
                  Trang{" "}
                  <span className="font-bold text-slate-700">
                    {currentPage}
                  </span>{" "}
                  / {totalPages} (Tổng {displayedMessages.length} lời nhắn)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 flex items-center gap-1.5 shadow-2xs ${
                      currentPage === 1
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                        : "bg-white text-slate-700 border-amber-200 hover:bg-amber-100 hover:text-amber-900 active:scale-95"
                    }`}
                  >
                    <span>&lt;</span>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 flex items-center gap-1.5 shadow-2xs ${
                      currentPage === totalPages
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                        : "bg-white text-slate-700 border-amber-200 hover:bg-amber-100 hover:text-amber-900 active:scale-95"
                    }`}
                  >
                    <span>&gt;</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POPUP XÁC NHẬN XÓA LỜI NHẮN */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa lời nhắn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa lời nhắn của{" "}
                <strong className="text-slate-800">
                  &quot;{getSenderName(confirmDeleteItem)}&quot;
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
    </div>
  );
}
