"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (err: unknown) {
      console.error(err);
      alert("Sai tài khoản hoặc mật khẩu!");
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
        position: "relative",
        overflow: "hidden",
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
        {/* Phần Logo & Tiêu đề trên */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "26px",
              fontWeight: "bold",
              color: "#e67e22",
              marginBottom: "6px",
            }}
          >
            <svg
              width="30"
              height="30"
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
          <p style={{ color: "#9bb0a5", fontSize: "14px", margin: 0 }}>
            Vui lòng đăng nhập để vào trang quản trị lớp học.
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
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                marginBottom: "6px",
                color: "#193026",
              }}
            >
              Đăng nhập giáo viên
            </h1>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              Vào trang quản lý để cập nhật lớp học của bạn
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
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
                placeholder="co.mai.3a@hoasenschool.edu.vn"
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

            <div style={{ marginBottom: "16px" }}>
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
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
                fontSize: "13px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#555",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" style={{ accentColor: "#e67e22" }} />
                Ghi nhớ đăng nhập
              </label>

              <Link
                href="/admin/forgot-password"
                style={{  
                  color: "#e67e22",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Quên mật khẩu?
              </Link>
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
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>

        {/* Liên kết về trang chủ */}
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link
            href="/"
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
            ← Về trang chủ lớp học
          </Link>
        </div>
      </div>
    </div>
  );
}
