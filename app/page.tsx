"use client";

import { useState, useEffect } from "react";
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
import "./home.css";

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", checkScroll);
    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
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
    </>
  );
}
