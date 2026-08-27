"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Contact() {
  const [name, setName] = useState("");
  const [studentInfo, setStudentInfo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "contacts"), {
        parentName: name,
        studentInfo: studentInfo,
        message: message,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setName("");
      setStudentInfo("");
      setMessage("");
    } catch (err) {
      console.error("Lỗi khi gửi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="lienhe">
      <div className="contact">
        {/* Cột trái */}
        <div>
          <span className="kicker">Kết nối với cô</span>
          <h2>Liên hệ</h2>
          <p className="lead">
            Có thắc mắc về bài học hay muốn trao đổi trực tiếp, phụ huynh có thể
            liên hệ qua các kênh dưới đây.
          </p>

          <div className="contact-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.92z" />
            </svg>
            0903 530 93
          </div>

          <div className="contact-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h16v16H4z" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            thanhtrucqn96@gmail.com
          </div>

          <div className="contact-item">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Trường tiểu học số 1 Hoài Nhơn Đông, Gia Lai
          </div>

          <div className="quick-connect">
            <a
              href="https://zalo.me/g/zwtgkh332"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.6 8.6 0 01-4-.96L3 20l1.05-3.4A8.5 8.5 0 1121 11.5z" />
              </svg>
              Nhóm Zalo lớp
            </a>
          </div>
        </div>

        {/* Cột phải: Form */}
        <form onSubmit={handleSubmit}>
          {success && (
            <p
              style={{
                color: "#2ecc71",
                fontWeight: 600,
                textAlign: "center",
                margin: 0,
                fontSize: "14px",
              }}
            >
              Gửi tin nhắn thành công!
            </p>
          )}

          <input
            type="text"
            placeholder="Tên phụ huynh"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Tên con / lớp"
            value={studentInfo}
            onChange={(e) => setStudentInfo(e.target.value)}
            required
          />

          <textarea
            placeholder="Nội dung cần trao đổi..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi tin nhắn"}
          </button>
        </form>
      </div>
    </section>
  );
}
