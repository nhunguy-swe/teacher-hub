"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
}

const GAP = 24;

export default function Gallery() {
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

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
    const fetchPhotos = async () => {
      try {
        const q = query(
          collection(db, "gallery"),
          orderBy("createdAt", "desc"),
          limit(12),
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as GalleryItem[];
        setPhotos(data);
      } catch (err) {
        console.error("Lỗi khi tải album ảnh:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPhotos();
  }, []);

  const maxIndex = Math.max(0, photos.length - itemsPerPage);

  const activeIndex = Math.min(currentIndex, maxIndex);
  const showArrows = photos.length > itemsPerPage;

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  return (
    <section id="thuvien">
      <div className="section-head">
        <span className="kicker">Khoảnh khắc lớp học</span>
        <h2>Thư viện ảnh</h2>
        <p>
          Một vài hình ảnh hoạt động của các con trong lớp và các buổi ngoại
          khóa.
        </p>
      </div>

      {loading ? (
        <div
          className="text-center py-12"
          style={{ color: "#666", fontSize: "14px" }}
        >
          Đang tải thư viện ảnh...
        </div>
      ) : photos.length === 0 ? (
        <div
          className="text-center py-12"
          style={{
            color: "#666",
            fontSize: "14px",
            border: "1px dashed #ddd",
            borderRadius: "12px",
          }}
        >
          Chưa có hình ảnh kỷ niệm nào được đăng.
        </div>
      ) : (
        <div>
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
                  cursor: activeIndex >= maxIndex ? "not-allowed" : "pointer",
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

          <div style={{ overflow: "hidden", padding: "4px 2px 12px 2px" }}>
            <div
              style={{
                display: "flex",
                gap: `${GAP}px`,
                transform: `translateX(calc(-${activeIndex} * ((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage} + ${GAP}px)))`,
                transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            >
              {photos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedImage(item)}
                  className="card"
                  style={{
                    cursor: "pointer",
                    overflow: "hidden",
                    padding: "12px",
                    flex: `0 0 calc((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage})`,
                    minWidth: `calc((100% - ${(itemsPerPage - 1) * GAP}px) / ${itemsPerPage})`,
                  }}
                >
                  <div
                    style={{
                      height: "200px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "#f5f5f5",
                      marginBottom: "12px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title || "Ảnh kỷ niệm"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.3s ease",
                      }}
                    />
                  </div>
                  <h4
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      margin: "0",
                      textAlign: "center",
                      color: "#333",
                    }}
                  >
                    {item.title || "Khoảnh khắc lớp học"}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "20px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "#f1f1f1",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontWeight: "bold",
                color: "#555",
              }}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.title}
              style={{
                maxHeight: "70vh",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: "8px",
                marginBottom: "16px",
              }}
            />

            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #eee",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: "#333",
                  fontSize: "15px",
                }}
              >
                {selectedImage.title}
              </p>

              <a
                href={selectedImage.imageUrl}
                target="_blank"
                download={`${selectedImage.title || "anh_ky_niem"}.jpg`}
                rel="noopener noreferrer"
                style={{
                  background: "linear-gradient(135deg, #ff7675, #fab1a0)",
                  color: "#fff",
                  textDecoration: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                }}
              >
                📥 Tải ảnh về máy
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
