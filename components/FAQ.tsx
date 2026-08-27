"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Con em nghỉ học cần báo thế nào?",
    answer:
      "Phụ huynh nhắn tin qua Zalo hoặc gọi điện cho cô trước 7h sáng để cô nắm được và chuẩn bị bài học bù cho con.",
  },
  {
    question: "Bài tập ở mục Học liệu có cần nộp lại không?",
    answer:
      "Đây là tài liệu để các con tự ôn luyện thêm ở nhà, không bắt buộc nộp lại. Cô sẽ chữa một số bài tiêu biểu vào tiết ôn tập trên lớp.",
  },
  {
    question: "Khi nào có kết quả các bài kiểm tra?",
    answer:
      "Kết quả thường được gửi qua Zalo nhóm lớp trong vòng 3–5 ngày sau khi kiểm tra, kèm nhận xét cụ thể cho từng con.",
  },
  {
    question: "Con có thể chơi trò chơi ở mục Trò chơi vào lúc nào?",
    answer:
      "Các trò chơi phù hợp để chơi sau khi hoàn thành bài tập, khoảng 15–20 phút mỗi lần để con vừa thư giãn vừa ôn lại kiến thức.",
  },
  {
    question: "Làm sao để đặt lịch gặp trực tiếp trao đổi về con?",
    answer:
      "Phụ huynh nhắn tin qua Zalo hoặc dùng form ở mục Liên hệ, cô sẽ sắp xếp vào khung giờ tư vấn Thứ 3 và Thứ 5 (16h–17h).",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq">
      <div className="section-head">
        <span className="kicker">Giải đáp</span>
        <h2>Câu hỏi thường gặp</h2>
        <p>
          Một số thắc mắc phụ huynh hay hỏi nhất — bấm vào câu hỏi để xem câu
          trả lời.
        </p>
      </div>

      <div className="faq-list" style={{ maxWidth: "800px", margin: "0 auto" }}>
        {faqs.map((item, index) => (
          <div
            key={index}
            style={{ borderBottom: "1px solid #e0dcd5", padding: "16px 0" }}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 600,
                color: "#333",
                fontSize: "16px",
                padding: "0",
              }}
            >
              {item.question}
              <span
                style={{
                  color: "#e67e22",
                  fontSize: "24px",
                  transition: "transform 0.3s ease",
                  transform:
                    openIndex === index ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                +
              </span>
            </button>

            <div
              style={{
                maxHeight: openIndex === index ? "200px" : "0",
                opacity: openIndex === index ? 1 : 0,
                overflow: "hidden",
                transition: "all 0.3s ease",
                fontSize: "14px",
                color: "#666",
                lineHeight: "1.6",
                marginTop: openIndex === index ? "12px" : "0",
              }}
            >
              {item.answer}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
