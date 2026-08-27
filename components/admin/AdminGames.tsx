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

export default function AdminGames({ onAdded }: Props) {
  const [games, setGames] = useState<GameItem[]>([]);

  // Form thêm mới (không còn dùng chung cho sửa nữa)
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Tiếng Anh");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [link, setLink] = useState("");
  const [grade, setGrade] = useState("1");
  const [type, setType] = useState("Kahoot");
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState("");

  const [loading, setLoading] = useState(false);

  // State phân trang và hiệu ứng danh sách
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const itemsPerPage = 3;

  // State quản lý Modal chỉnh sửa (tách riêng khỏi form thêm mới)
  const [editItem, setEditItem] = useState<GameItem | null>(null);
  const [isEditCustomType, setIsEditCustomType] = useState(false);
  const [editCustomType, setEditCustomType] = useState("");
  const [isEditCustomSubject, setIsEditCustomSubject] = useState(false);
  const [editCustomSubject, setEditCustomSubject] = useState("");

  const defaultTypes = ["Kahoot", "Wordwall"];
  const defaultSubjects = [
    "Tiếng Anh",
    "Toán",
    "Tiếng Việt",
    "Tự nhiên & Xã hội",
    "Khoa học",
  ];

  // Lắng nghe dữ liệu realtime từ Firestore
  useEffect(() => {
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as GameItem[];
      setGames(data);
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

  const visibleGames = games.slice(currentIndex, currentIndex + itemsPerPage);

  // Mở modal sửa, điền sẵn dữ liệu của game được chọn
  const handleOpenEdit = (game: GameItem) => {
    const typeIsDefault = defaultTypes.includes(game.type);
    const subjectIsDefault = defaultSubjects.includes(game.subject);

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

  const handleDelete = async (id: string) => {
    if (confirm("Bạn có chắc muốn xóa trò chơi này không?")) {
      try {
        await deleteDoc(doc(db, "games", id));
        alert("✅ Đã xóa thành công!");
        onAdded();
      } catch (err) {
        console.error(err);
        alert("❌ Lỗi khi xóa!");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !link) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    const finalType = type === "Khác" ? customType.trim() : type;
    if (type === "Khác" && !finalType) {
      alert("Vui lòng nhập tên loại game tùy chỉnh!");
      return;
    }

    const finalSubject = subject === "Khác" ? customSubject.trim() : subject;
    if (subject === "Khác" && !finalSubject) {
      alert("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "games"), {
        title,
        subject: finalSubject,
        link,
        grade,
        type: finalType,
        createdAt: serverTimestamp(),
      });
      alert("✅ Đã thêm trò chơi thành công!");

      setTitle("");
      setLink("");
      setSubject("Tiếng Anh");
      setIsCustomSubject(false);
      setCustomSubject("");
      setGrade("1");
      setType("Kahoot");
      setIsCustomType(false);
      setCustomType("");
      setCurrentIndex(0);
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Có lỗi xảy ra, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Cập nhật trò chơi từ modal sửa
  const handleUpdate = async () => {
    if (!editItem) return;

    const finalType = isEditCustomType
      ? editCustomType.trim()
      : editItem.type;
    if (isEditCustomType && !finalType) {
      alert("Vui lòng nhập tên loại game tùy chỉnh!");
      return;
    }

    const finalSubject = isEditCustomSubject
      ? editCustomSubject.trim()
      : editItem.subject;
    if (isEditCustomSubject && !finalSubject) {
      alert("Vui lòng nhập tên môn học tùy chỉnh!");
      return;
    }

    if (!editItem.title || !finalSubject || !editItem.link) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    try {
      await updateDoc(doc(db, "games", editItem.id), {
        title: editItem.title,
        subject: finalSubject,
        link: editItem.link,
        grade: editItem.grade,
        type: finalType,
      });
      alert("✅ Đã cập nhật trò chơi thành công!");
      setEditItem(null);
      onAdded();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi cập nhật trò chơi");
    }
  };

  return (
    <div className="bg-white/90 p-6 rounded-3xl border border-amber-200/60 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Form Đăng Trò Chơi Mới */}
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
              <line x1="6" y1="12" x2="10" y2="12" />
              <line x1="8" y1="10" x2="8" y2="14" />
              <circle cx="15" cy="13" r="1" />
              <circle cx="18" cy="11" r="1" />
              <path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z" />
            </svg>
            Đăng Trò Chơi Mới
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Lớp</label>
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
            <label className="text-xs text-slate-500 mb-1 block">
              Loại Game
            </label>
            <select
              value={type}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Khác") {
                  setIsCustomType(true);
                  setType("Khác");
                } else {
                  setIsCustomType(false);
                  setType(val);
                }
              }}
              className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-500 transition"
            >
              {defaultTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="Khác">Khác</option>
            </select>
          </div>
        </div>

        {isCustomType && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Nhập loại game tùy chỉnh
            </label>
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="VD: Quizizz, Bizia..."
              className="w-full p-3 bg-white border border-amber-500 rounded-xl text-slate-700 text-sm focus:outline-none transition"
              required
            />
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Môn học</label>
          <select
            value={subject}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "Khác") {
                setIsCustomSubject(true);
                setSubject("Khác");
              } else {
                setIsCustomSubject(false);
                setSubject(val);
              }
            }}
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-500 transition"
          >
            {defaultSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Khác">Khác</option>
          </select>
        </div>

        {isCustomSubject && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Nhập tên môn học tùy chỉnh
            </label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="VD: Địa lý, Giáo dục thể chất..."
              className="w-full p-3 bg-white border border-amber-500 rounded-xl text-slate-700 text-sm focus:outline-none transition"
              required
            />
          </div>
        )}

        <div className="field">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Ôn tập Unit 1 - Animals"
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
            required
          />
        </div>

        <div className="field">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Dán link trò chơi tại đây..."
            className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#E06D53] hover:bg-[#D05D43] py-3 rounded-xl text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Đang xử lý..." : "Đăng Trò Chơi"}
        </button>
      </form>

      {/* Danh sách Trò Chơi */}
      <div className="border-t border-[#EFE8D8] pt-5 space-y-4">
        <div className="flex items-center justify-between">
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
          Danh sách trò chơi đã đăng ({games.length}):
        </h4>
        </div>

        <div
          className={`space-y-3 transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
        >
          {games.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Chưa có trò chơi nào.
            </p>
          ) : (
            visibleGames.map((game) => (
              <div
                key={game.id}
                className="p-3.5 bg-white border border-[#E7DFCE] rounded-xl flex justify-between items-center gap-4 shadow-2xs"
              >
                <div className="overflow-hidden space-y-1">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-md">
                    Lớp {game.grade} • {game.subject} •{" "}
                    <span className="text-emerald-700 font-bold">
                      {game.type}
                    </span>
                  </span>
                  <h5 className="font-bold text-slate-800 text-sm truncate">
                    {game.title}
                  </h5>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(game)}
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
                    onClick={() => handleDelete(game.id)}
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
        {games.length > itemsPerPage && (
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
                currentIndex + itemsPerPage >= games.length || isAnimating
              }
              className="w-9 h-9 rounded-full border border-[#E7DFCE] bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center text-slate-600 transition-all cursor-pointer shadow-2xs"
            >
              ❯
            </button>
          </div>
        )}
      </div>

      {/* MODAL CHỈNH SỬA TRÒ CHƠI */}
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
              Chỉnh sửa trò chơi
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Lớp
                </label>
                <select
                  className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none"
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
                <label className="text-xs text-slate-500 mb-1 block">
                  Loại Game
                </label>
                <select
                  className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none"
                  value={editItem.type}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Khác") {
                      setIsEditCustomType(true);
                      setEditItem({ ...editItem, type: "Khác" });
                    } else {
                      setIsEditCustomType(false);
                      setEditItem({ ...editItem, type: val });
                    }
                  }}
                >
                  {defaultTypes.map((t) => (
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
                <label className="text-xs text-slate-500 mb-1 block">
                  Nhập loại game tùy chỉnh
                </label>
                <input
                  className="w-full p-3 bg-white border border-amber-500 rounded-xl text-slate-700 text-sm focus:outline-none"
                  value={editCustomType}
                  onChange={(e) => setEditCustomType(e.target.value)}
                  placeholder="VD: Quizizz, Bizia..."
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Môn học
              </label>
              <select
                className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none"
                value={editItem.subject}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Khác") {
                    setIsEditCustomSubject(true);
                    setEditItem({ ...editItem, subject: "Khác" });
                  } else {
                    setIsEditCustomSubject(false);
                    setEditItem({ ...editItem, subject: val });
                  }
                }}
              >
                {defaultSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Khác">Khác</option>
              </select>
            </div>

            {isEditCustomSubject && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Nhập tên môn học tùy chỉnh
                </label>
                <input
                  className="w-full p-3 bg-white border border-amber-500 rounded-xl text-slate-700 text-sm focus:outline-none"
                  value={editCustomSubject}
                  onChange={(e) => setEditCustomSubject(e.target.value)}
                  placeholder="VD: Địa lý, Giáo dục thể chất..."
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Tên trò chơi
              </label>
              <input
                className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400"
                value={editItem.title}
                onChange={(e) =>
                  setEditItem({ ...editItem, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Link trò chơi
              </label>
              <input
                className="w-full p-3 bg-white border border-[#E7DFCE] rounded-xl text-slate-700 text-sm focus:outline-none focus:border-amber-400"
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