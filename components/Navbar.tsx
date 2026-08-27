"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="sticky top-0 z-40">
      <div className="nav-inner">
        {/* Logo của cô */}
        <Link href="/" className="logo" onClick={closeMenu}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3L2 8l10 5 10-5-10-5z" />
            <path d="M2 12l10 5 10-5" />
            <path d="M2 8v6" />
          </svg>
          Cô Trúc
        </Link>

        {/* Các liên kết menu (đã thêm lại mục Thông báo và khớp id với page.tsx) */}
        <div className={`nav-links ${isOpen ? "open" : ""}`} id="navLinks">
          <a href="#announcement" onClick={closeMenu}>
            Thông báo
          </a>
          <a href="#schedule" onClick={closeMenu}>
            Lịch dạy
          </a>
          <a href="#materials" onClick={closeMenu}>
            Tài liệu
          </a>
          <a href="#trochoi" onClick={closeMenu}>
            Trò chơi
          </a>
          <a href="#thuvien" onClick={closeMenu}>
            Hình ảnh
          </a>
          <a href="#faq" onClick={closeMenu}>
            Hỏi đáp
          </a>
          <a href="#lienhe" onClick={closeMenu}>
            Liên hệ
          </a>
        </div>

        {/* Nút hành động & Nút menu trên điện thoại */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/admin"
            className="nav-cta btn-primary"
            onClick={closeMenu}
          >
            Quản trị
          </Link>
          <button
            className="menu-btn"
            id="menuBtn"
            aria-label="Mở menu"
            onClick={toggleMenu}
          >
            ☰
          </button>
        </div>
      </div>
    </nav>
  );
}
