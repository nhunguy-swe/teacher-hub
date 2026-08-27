"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  link: string;
  grade?: string;
  category?: string;
  description?: string;
  createdAt?: unknown;
}

export default function LearningMaterials() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [activeTab, setActiveTab] = useState<"slide" | "baitap">("slide");
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const q = query(
          collection(db, "materials"),
          orderBy("createdAt", "desc"),
          limit(15),
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as MaterialItem[];
        setMaterials(data);
      } catch (err) {
        console.error("Lỗi tải tài liệu:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
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
      alert("Đã sao chép liên kết tài liệu vào bộ nhớ tạm!");
    }
  };

  const getSubjectStyle = (subject: string = "") => {
    const s = subject.toLowerCase();
    if (s.includes("toán")) {
      return {
        backgroundColor: "#e6f4ea",
        color: "#137333",
        border: "1px solid #ceead6",
      };
    }
    if (s.includes("việt") || s.includes("văn")) {
      return {
        backgroundColor: "#fce8e6",
        color: "#c5221f",
        border: "1px solid #fad2cf",
      };
    }
    if (s.includes("anh") || s.includes("ngoại ngữ")) {
      return {
        backgroundColor: "#e8f0fe",
        color: "#1a73e8",
        border: "1px solid #d2e3fc",
      };
    }
    if (s.includes("tự nhiên") || s.includes("xã hội") || s.includes("tn")) {
      return {
        backgroundColor: "#fef7e0",
        color: "#b06000",
        border: "1px solid #fef1c7",
      };
    }
    if (s.includes("kỹ năng") || s.includes("đạo đức")) {
      return {
        backgroundColor: "#f3e8fd",
        color: "#8430ce",
        border: "1px solid #e9d5fd",
      };
    }
    if (s.includes("thể dục") || s.includes("nhạc") || s.includes("mỹ thuật")) {
      return {
        backgroundColor: "#e4f7fb",
        color: "#007b83",
        border: "1px solid #c8edf4",
      };
    }
    return {
      backgroundColor: "#f1f3f4",
      color: "#3c4043",
      border: "1px solid #dadce0",
    };
  };

  const filteredMaterials = materials.filter((item) => {
    if (activeTab === "slide") {
      return item.category === "slide";
    }
    return item.category !== "slide";
  });

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  return (
    <section id="materials">
      <div className="section-head">
        <span className="kicker">Góc học tập</span>
        <h2> Slide bài giảng & Bài tập </h2>
        <p>
          Tài liệu ôn tập và slide bài giảng cập nhật hằng tuần — phụ huynh có
          thể tải về hoặc chia sẻ cho các bạn trong lớp cùng học.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div className="tabs-bar" id="hlTabsBar" style={{ margin: 0 }}>
          <button
            className={`tab-btn ${activeTab === "slide" ? "active" : ""}`}
            onClick={() => setActiveTab("slide")}
            type="button"
          >
            Slide bài giảng
          </button>
          <button
            className={`tab-btn ${activeTab === "baitap" ? "active" : ""}`}
            onClick={() => setActiveTab("baitap")}
            type="button"
          >
            Bài tập
          </button>
        </div>

        {filteredMaterials.length > 3 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={scrollLeft}
              className="materials-nav-btn"
              aria-label="Cuộn trái"
              type="button"
            >
              ‹
            </button>
            <button
              onClick={scrollRight}
              className="materials-nav-btn"
              aria-label="Cuộn phải"
              type="button"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div id="hlPanels">
        {loading ? (
          <p style={{ textAlign: "center", padding: "30px", color: "#666" }}>
            Đang tải tài liệu...
          </p>
        ) : filteredMaterials.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              padding: "30px",
              color: "#666",
              border: "2px dashed #e2e8f0",
              borderRadius: "12px",
            }}
          >
            Hiện chưa có tài liệu nào trong mục này.
          </p>
        ) : (
          <div>
            <div ref={scrollRef} className="materials-scroll">
              {filteredMaterials.map((item, index) => {
                const iconClass = `ic-${(index % 3) + 1}`;
                const customSubjectStyle = getSubjectStyle(item.subject);

                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      flex: "0 0 calc(33.333% - 16px)",
                      minWidth: "min(290px, 78vw)",
                      scrollSnapAlign: "start",
                      position: "relative",
                    }}
                  >
                    <button
                      className="share-btn"
                      onClick={() => handleShare(item.title)}
                      aria-label="Chia sẻ"
                      type="button"
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

                    <div className={`card-icon ${iconClass}`}>
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

                    <div className="card-meta">
                      <span
                        className="tag-subject"
                        style={{
                          ...customSubjectStyle,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {item.subject}
                      </span>
                      <span className="tag-subject tag-de">
                        {" "}
                        Lớp {item.grade}
                      </span>
                    </div>

                    <h4>{item.title}</h4>
                    <p>{item.description}</p>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                      style={{
                        display: "inline-block",
                        marginTop: "15px",
                        textDecoration: "none",
                      }}
                    >
                      {activeTab === "slide" ? "Xem slide →" : "Xem bài tập →"}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
