"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        background: "#22382f",
        color: "#fff",
        paddingTop: "50px",
        marginTop: "60px",
      }}
    >
      <div
        className="wrap footer-inner"
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 20px 30px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        {/* Cột thông tin lớp & Logo */}
        <div className="footer-col" style={{ maxWidth: "500px" }}>
          <div
            className="logo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: "bold",
              fontSize: "20px",
              color: "#e67e22",
              marginBottom: "12px",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e67e22"
              strokeWidth="2"
            >
              <path d="M12 3L2 8l10 5 10-5-10-5z" />
              <path d="M2 12l10 5 10-5" />
              <path d="M2 8v6" />
            </svg>
            Cô Trúc
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "#c2c2c2",
              lineHeight: "1.6",
              margin: 0,
            }}
          >
            Website tổng hợp tài liệu học tập, trò chơi và thông tin lớp học của
            cô Trúc dành cho phụ huynh và học sinh.
          </p>
        </div>

        {/* Nút Quản trị */}
        <div>
          <Link
            href="/admin"
            style={{
              display: "inline-block",
              fontSize: "13px",
              fontWeight: 500,
              color: "#e67e22",
              background: "rgba(230, 126, 34, 0.1)",
              border: "1px solid rgba(230, 126, 34, 0.3)",
              padding: "8px 16px",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            🔐 Trang Quản Lý Giáo Viên
          </Link>
        </div>
      </div>

      <div
        className="footer-bottom"
        style={{
          textAlign: "center",
          padding: "20px 0",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: "13px",
          color: "#a0a0a0",
        }}
      >
        © {new Date().getFullYear()} — Trang lớp học chính thức
      </div>
    </footer>
  );
}
