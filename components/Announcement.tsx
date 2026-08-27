"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  dateStr?: string;
  createdAt?: unknown;
}

export default function Announcement() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const itemsPerPage = 3;

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const q = query(
          collection(db, "announcements"),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as AnnouncementItem[];
        setAnnouncements(data);
      } catch (err) {
        console.error("Lỗi khi tải thông báo:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const handlePageChange = (newIndex: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsAnimating(false);
    }, 150);
  };

  const handlePrev = () => {
    const nextIndex = Math.max(currentIndex - itemsPerPage, 0);
    handlePageChange(nextIndex);
  };

  const handleNext = () => {
    const nextIndex =
      currentIndex + itemsPerPage < announcements.length
        ? currentIndex + itemsPerPage
        : currentIndex;
    handlePageChange(nextIndex);
  };

  const visibleAnnouncements = announcements.slice(
    currentIndex,
    currentIndex + itemsPerPage,
  );

  return (
    <section id="announcement">
      <div className="section-head mb-4">
        <span className="kicker">Cập nhật</span>
        <h2>Thông báo lớp</h2>
      </div>

      {/* Danh sách với hiệu ứng transition mượt mà */}
      <div
        className={`announce-list transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
      >
        {loading ? (
          <p style={{ textAlign: "center", padding: "20px", color: "#666" }}>
            Đang tải thông báo...
          </p>
        ) : announcements.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              padding: "30px",
              color: "#666",
              border: "2px dashed #e2e8f0",
              borderRadius: "12px",
            }}
          >
            Chưa có thông báo nào từ cô giáo.
          </p>
        ) : (
          visibleAnnouncements.map((item) => (
            <div key={item.id} className="announce">
              <span className="date">{item.dateStr || "Mới"}</span>
              <div>
                <h5>{item.title}</h5>
                <p style={{ whiteSpace: "pre-line" }}>{item.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Nút chuyển trang nằm ở dưới cùng và được căn giữa */}
      {announcements.length > itemsPerPage && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0 || isAnimating}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 shadow-2xs transition-all"
            title="Trang trước"
          >
            ❮
          </button>
          <button
            onClick={handleNext}
            disabled={
              currentIndex + itemsPerPage >= announcements.length || isAnimating
            }
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 shadow-2xs transition-all"
            title="Trang sau"
          >
            ❯
          </button>
        </div>
      )}
    </section>
  );
}
