"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Thêm useRouter để chuyển hướng
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Announcement from "@/components/Announcement";
import Schedule from "@/components/Schedule";
import LearningMaterials from "@/components/LearningMaterials";
import Gallery from "@/components/Gallery";
import Games from "@/components/Games";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/ToastProvider";
import "./home.css";

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const router = useRouter();

  // Kiểm tra trạng thái ghi nhớ khi vừa mở app
  useEffect(() => {
    const lastRoute = localStorage.getItem("last_visited_route");
    const isAdminLogged = localStorage.getItem("is_admin_logged");

    // Nếu trước đó đang ở trang admin và đã đăng nhập, tự động đá về thẳng admin
    if (lastRoute && isAdminLogged === "true") {
      router.replace(lastRoute);
      return; // Dừng không chạy tiếp logic render trang chủ nữa
    }

    const checkScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", checkScroll);
    return () => window.removeEventListener("scroll", checkScroll);
  }, [router]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <ToastProvider>
      {/* Thanh điều hướng */}
      <Navbar />

      {/* Phần giới thiệu đầu trang */}
      <Hero />

      {/* Nội dung chính - Sử dụng cấu trúc wrap chuẩn từ home.css */}
      <main>
        <div className="wrap" style={{ padding: "40px 28px" }}>
          <section id="announcement">
            <Announcement />
          </section>

          <section id="schedule">
            <Schedule />
          </section>

          <section id="materials">
            <LearningMaterials />
          </section>

          <section id="trochoi">
            <Games />
          </section>

          <section id="thuvien">
            <Gallery />
          </section>

          <section id="faq">
            <FAQ />
          </section>

          <section id="lienhe">
            <Contact />
          </section>
        </div>
      </main>

      {/* Chân trang */}
      <Footer />

      {/* Nút Về đầu trang */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Về đầu trang"
          className="back-to-top"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 50,
            background: "#b45309",
            color: "#fff",
            fontWeight: "bold",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          ↑
        </button>
      )}
    </ToastProvider>
  );
}
