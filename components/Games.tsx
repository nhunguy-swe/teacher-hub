"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

interface GameItem {
  id: string;
  title: string;
  subject: string;
  link: string;
  grade: string | number;
  type?: string;
  description?: string;
}

export default function Games() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("1");
  const [currentIndex, setCurrentIndex] = useState<{ [key: string]: number }>({
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  });

  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const updateItemsPerPage = () => {
      const w = window.innerWidth;
      if (w <= 640) setItemsPerPage(1);
      else if (w <= 900) setItemsPerPage(2);
      else setItemsPerPage(3);
    };
    updateItemsPerPage();
    window.addEventListener("resize", updateItemsPerPage);
    return () => window.removeEventListener("resize", updateItemsPerPage);
  }, []);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const q = query(collection(db, "games"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GameItem[];
        setGames(data);
      } catch (err) {
        console.error("Lỗi khi tải trò chơi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const handleShare = (title: string) => {
    if (navigator.share) {
      navigator
        .share({
          title: title,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Đã sao chép liên kết trò chơi!");
    }
  };

  const renderCardIcon = (subject: string) => {
    if (subject === "Toán") {
      return (
        <div className="card-icon ic-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </div>
      );
    }
    if (subject === "Tiếng Việt") {
      return (
        <div className="card-icon ic-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19V6a2 2 0 012-2h9l5 5v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="card-icon ic-3">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      </div>
    );
  };

  const getSubjectTagClass = (subject: string) => {
    if (subject === "Toán") return "tag-subject tag-toan";
    if (subject === "Tiếng Việt") return "tag-subject tag-van";
    return "tag-subject tag-tn";
  };

  const getTypeTagClass = (type?: string) => {
    if (type === "Trung bình") return "tag-subject tag-tb";
    if (type === "Nâng cao") return "tag-subject tag-nc";
    return "tag-subject tag-de";
  };

  const GAP = 24;

  return (
    <section id="trochoi">
      <div className="section-head">
        <span className="kicker">Vừa học vừa chơi</span>
        <h2>Trò chơi luyện tập theo khối lớp</h2>
        <p>
          Khám phá thế giới trò chơi bổ ích dành riêng cho các bé từ lớp 1 đến
          lớp 5 — nơi học sinh được thỏa sức vui chơi, ôn luyện kiến thức và
          củng cố bài học một cách tự nhiên, hiệu quả nhất.
        </p>
      </div>

      <div className="tabs-bar" id="gradeTabsBar">
        {[1, 2, 3, 4, 5].map((g) => (
          <button
            key={g}
            type="button"
            className={`tab-btn ${activeTab === String(g) ? "active" : ""}`}
            onClick={() => setActiveTab(String(g))}
          >
            Lớp {g}
          </button>
        ))}
      </div>

      <div id="gradePanels">
        {loading ? (
          <div
            className="text-center py-12"
            style={{ color: "#666", fontSize: "14px" }}
          >
            Đang tải danh sách trò chơi...
          </div>
        ) : (
          [1, 2, 3, 4, 5].map((g) => {
            const gradeStr = String(g);
            const currentGames = games.filter(
              (item) => String(item.grade) === gradeStr,
            );
            const maxIndex = Math.max(0, currentGames.length - itemsPerPage);

            const activeIndex = Math.min(currentIndex[gradeStr] || 0, maxIndex);
            const showArrows = currentGames.length > itemsPerPage;

            const handlePrev = () => {
              setCurrentIndex((prev) => ({
                ...prev,
                [gradeStr]: Math.max(0, (prev[gradeStr] || 0) - 1),
              }));
            };

            const handleNext = () => {
              setCurrentIndex((prev) => ({
                ...prev,
                [gradeStr]: Math.min(maxIndex, (prev[gradeStr] || 0) + 1),
              }));
            };

            return (
              <div
                key={g}
                className={`tab-panel ${activeTab === gradeStr ? "active" : ""}`}
                id={`grade${g}`}
                style={{ display: activeTab === gradeStr ? "block" : "none" }}
              >
                {showArrows && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <button
                      className={`slider-btn prev ${activeIndex === 0 ? "disabled" : ""}`}
                      onClick={handlePrev}
                      disabled={activeIndex === 0}
                      aria-label="Trước"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: activeIndex === 0 ? 0.4 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      className={`slider-btn next ${activeIndex >= maxIndex ? "disabled" : ""}`}
                      onClick={handleNext}
                      disabled={activeIndex >= maxIndex}
                      aria-label="Sau"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor:
                          activeIndex >= maxIndex ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: activeIndex >= maxIndex ? 0.4 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                )}

                {currentGames.length === 0 ? (
                  <div
                    className="text-center py-12"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#666",
                      border: "2px dashed #e2e8f0",
                      borderRadius: "12px",
                    }}
                  >
                    Chưa có trò chơi nào cho khối lớp {g}.
                  </div>
                ) : (
                  <div
                    style={{ overflow: "hidden", padding: "4px 2px 12px 2px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: `${GAP}px`,
                        transform: `translateX(calc(-${activeIndex} * ((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage} + ${GAP}px)))`,
                        transition:
                          "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
                      }}
                    >
                      {currentGames.map((item) => (
                        <div
                          className="card"
                          key={item.id}
                          style={{
                            flex: `0 0 calc((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage})`,
                            minWidth: `calc((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage})`,
                          }}
                        >
                          <button
                            className="share-btn"
                            onClick={() => handleShare(item.title)}
                            type="button"
                            aria-label="Chia sẻ"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                            </svg>
                          </button>

                          {renderCardIcon(item.subject)}

                          <div className="card-meta">
                            <span className={getSubjectTagClass(item.subject)}>
                              {item.subject}
                            </span>
                            <span className={getTypeTagClass(item.type)}>
                              {item.type || "Dễ"}
                            </span>
                          </div>

                          <h4>{item.title}</h4>
                          <p>
                            {item.description ||
                              "Trò chơi tương tác giúp học sinh nắm vững kiến thức bài học một cách hứng thú."}
                          </p>

                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link"
                            style={{
                              textDecoration: "none",
                              display: "inline-block",
                            }}
                          >
                            Chơi ngay →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
