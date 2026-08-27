"use client";

import { useState } from "react";

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
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

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

  return (
    <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-amber-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600"
          >
            <path d="M4 4h16v16H4z" />
            <path d="M22 6l-10 7L2 6" />
          </svg>
          Lời nhắn từ phụ huynh
        </h2>

        <div className="relative flex bg-amber-100/60 p-1 rounded-xl border border-amber-200/80 shadow-inner shrink-0 w-full sm:w-auto">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm border border-amber-200/50 transition-all duration-300 ease-in-out ${
              activeTab === "pending" ? "left-1" : "left-[calc(50%+2px)]"
            }`}
          />

          <button
            onClick={() => handleTabChange("pending")}
            className={`relative z-10 flex-1 sm:flex-none px-4 py-2 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === "pending"
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
            >
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
            </svg>{" "}
            Chưa giải quyết
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "pending"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {pendingMessages.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("resolved")}
            className={`relative z-10 flex-1 sm:flex-none px-4 py-2 text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === "resolved"
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
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>{" "}
            Đã giải quyết
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "resolved"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {resolvedMessages.length}
            </span>
          </button>
        </div>
      </div>

      <div className="item-list">
        {displayedMessages.length === 0 ? (
          <div className="py-8 text-center text-slate-500 bg-white/50 rounded-2xl border border-dashed border-slate-200 transition-all duration-300 flex flex-col items-center gap-2">
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
                const senderName = String(
                  item.parentName ||
                    item.name ||
                    item.sender ||
                    "Phụ huynh ẩn danh",
                );
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
                    className={`p-4 sm:p-5 border rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ease-out transform ${
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
                        onClick={() =>
                          onToggleStatus(item.id, item.status || "pending")
                        }
                        className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                          isResolved
                            ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white"
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
                        onClick={() => onDelete("contacts", item.id)}
                        className="text-red-700 hover:text-white bg-rose-50 hover:bg-red-600 text-xs px-3.5 py-2 border border-red-200 rounded-xl transition-all font-semibold shadow-2xs"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-amber-100 px-2 transition-all duration-300">
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
                    ◀ Trước
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
                    Sau ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}