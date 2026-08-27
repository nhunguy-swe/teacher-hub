"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(
        "Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư của bạn.",
      );
    } catch (err: unknown) {
      console.error(err);
      setError("Không tìm thấy tài khoản email này hoặc có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#193026",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      {/* Dấu cộng trang trí góc trên bên trái */}
      <svg
        className="chalk-doodle d1"
        width="45"
        height="45"
        viewBox="0 0 60 60"
        fill="none"
        stroke="#f5f1e8"
        strokeWidth="2"
        style={{ position: "absolute", top: "40px", left: "50px" }}
      >
        <circle cx="30" cy="30" r="20" />
        <path d="M22 30h16M30 22v16" />
      </svg>

      {/* Hình tam giác trang trí góc dưới bên phải */}
      <svg
        className="chalk-doodle d2"
        width="45"
        height="45"
        viewBox="0 0 60 60"
        fill="none"
        stroke="#f5f1e8"
        strokeWidth="2"
        style={{ position: "absolute", bottom: "40px", right: "50px" }}
      >
        <path d="M10 45L30 10l20 35H10z" />
      </svg>

      <div style={{ width: "100%", maxWidth: "440px", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#f5f1e8",
              marginBottom: "8px",
            }}
          >
            Khôi phục mật khẩu
          </h1>
          <p style={{ color: "#9bb0a5", fontSize: "14px", margin: 0 }}>
            Nhập email quản trị của bạn để nhận liên kết đặt lại mật khẩu.
          </p>
        </div>

        <div
          style={{
            background: "#fcfbfa",
            padding: "36px 40px",
            borderRadius: "20px",
            color: "#2c3e50",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          {message && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                background: "#e1f5fe",
                color: "#01579b",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                background: "#ffebee",
                color: "#c62828",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  color: "#555",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhap.email@admin.com"
                required
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "1px solid #dcd6cd",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  color: "#333",
                  outline: "none",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: "#dd6b38",
                color: "#fff",
                border: "none",
                padding: "14px",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "15px",
              }}
            >
              {loading ? "Đang gửi..." : "Gửi yêu cầu khôi phục"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link
            href="/admin/login"
            style={{
              color: "#9bb0a5",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 500,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e67e22")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9bb0a5")}
          >
            ← Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
