"use client";

export default function Hero() {
  return (
    <header className="hero">
      {/* Các hình vẽ phấn trang trí */}
      <svg
        className="chalk-doodle d1"
        viewBox="0 0 60 60"
        fill="none"
        stroke="#f5f1e8"
        strokeWidth="2"
      >
        <circle cx="30" cy="30" r="20" />
        <path d="M22 30h16M30 22v16" />
      </svg>
      <svg
        className="chalk-doodle d2"
        viewBox="0 0 60 60"
        fill="none"
        stroke="#f5f1e8"
        strokeWidth="2"
      >
        <path d="M10 45L30 10l20 35H10z" />
      </svg>

      <div className="hero-inner">
        <div>
          <span className="eyebrow">✎ Xin chào, cô là</span>
          <h1>
            Cô Trúc
            <br />
            <span>Lớp 4A4 – Trường Tiểu học số 1 Hoài Nhơn Đông</span>
          </h1>
          <p className="sub">
            Đây là góc nhỏ để phụ huynh và các con theo dõi bài học, tài liệu và
            những khoảnh khắc đáng yêu ở lớp.
          </p>
          <div className="hero-buttons">
            <a href="#materials" className="btn-primary">
              Xem góc học tập
            </a>
            <a href="#lienhe" className="btn-ghost">
              Liên hệ
            </a>
          </div>
        </div>

        {/* Khối huy hiệu / thông tin tóm tắt */}
        <div className="hero-badge">
          <div className="badge-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7z" />
            </svg>
            Giáo viên chủ nhiệm lớp 4A4
          </div>
          <div className="badge-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M8 2v4M16 2v4M3 10h18" />
            </svg>
            Giờ tư vấn: Thứ 2 & 6, 7h–17h
          </div>
          <div className="badge-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h16v12H5.2L4 17.5V4z" />
            </svg>
            Phản hồi bài tập trong 24 giờ
          </div>
        </div>
      </div>

      <div className="tear"></div>
    </header>
  );
}
