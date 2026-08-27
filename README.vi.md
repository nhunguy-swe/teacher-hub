# Teacher Hub
[🇬🇧 ENGLISH](./README.md)

Website hỗ trợ giáo viên quản lý và chia sẻ nội dung giảng dạy, tài liệu học tập và các thông tin dành cho học sinh.

Dự án được xây dựng với **Next.js**, **React**, **TypeScript** và **Tailwind CSS**, hướng đến giao diện hiện đại, responsive và dễ sử dụng trên desktop, tablet và mobile.

---

## Tính năng

### Trang người dùng

* Trang chủ giới thiệu website.
* Giới thiệu giáo viên.
* Hiển thị thông báo.
* Hiển thị lịch học và lịch hoạt động.
* Quản lý và hiển thị tài liệu học tập.
* Thư viện hình ảnh.
* Trò chơi học tập.
* FAQ - Câu hỏi thường gặp.
* Thông tin liên hệ.
* Footer của website.
* Giao diện responsive trên desktop, tablet và mobile.

### Trang Admin

Khu vực quản trị dành cho giáo viên hoặc quản trị viên.

* Đăng nhập Admin.
* Quên mật khẩu.
* Dashboard quản trị.
* Quản lý thông báo.
* Quản lý liên hệ.
* Quản lý thư viện hình ảnh.
* Quản lý trò chơi.
* Quản lý tài liệu.
* Quản lý lịch học.

---

## Công nghệ sử dụng

* **Next.js** - Framework React dùng để xây dựng ứng dụng web.
* **React** - Thư viện xây dựng giao diện người dùng.
* **TypeScript** - Ngôn ngữ mở rộng của JavaScript với hệ thống kiểu dữ liệu.
* **Tailwind CSS** - Framework CSS dùng để xây dựng giao diện và responsive.
* **CSS** - Sử dụng cho các style tùy chỉnh.
* **JavaScript** - Sử dụng cho logic phía client.
* **Firebase** - Dự kiến sử dụng cho Authentication, Database và Storage.
* **Vercel** - Dự kiến sử dụng để triển khai ứng dụng.

---

## Cấu trúc thư mục

Cấu trúc thư mục chính của dự án:

```text
teacher-hub/
│
├── .next/                              # Thư mục build của Next.js
│
├── app/                                # Next.js App Router
│   │
│   ├── admin/                          # Khu vực quản trị
│   │   │
│   │   ├── forgot-password/
│   │   │   └── page.tsx                # Trang quên mật khẩu
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                # Trang đăng nhập Admin
│   │   │
│   │   ├── admin.css                   # CSS riêng cho Admin
│   │   └── page.tsx                    # Trang Admin
│   │
│   ├── globals.css                     # CSS global
│   ├── home.css                        # CSS trang chủ
│   ├── icon.svg                        # Icon website
│   ├── layout.tsx                      # Layout chung
│   └── page.tsx                        # Trang chủ
│
├── components/                         # Các React Component
│   │
│   ├── admin/
│   │   ├── AdminAnnouncements.tsx      # Quản lý thông báo
│   │   ├── AdminContact.tsx            # Quản lý liên hệ
│   │   ├── AdminDashboard.tsx           # Dashboard Admin
│   │   ├── AdminGallery.tsx            # Quản lý thư viện
│   │   ├── AdminGames.tsx              # Quản lý trò chơi
│   │   ├── AdminMaterials.tsx          # Quản lý tài liệu
│   │   └── AdminSchedule.tsx           # Quản lý lịch
│   │
│   ├── Announcement.tsx                # Hiển thị thông báo
│   ├── Contact.tsx                     # Khu vực liên hệ
│   ├── ContactForm.tsx                 # Form liên hệ
│   ├── FAQ.tsx                         # Câu hỏi thường gặp
│   ├── Footer.tsx                      # Footer
│   ├── Gallery.tsx                     # Thư viện hình ảnh
│   ├── Games.tsx                       # Trò chơi
│   ├── Hero.tsx                        # Hero section
│   ├── LearningMaterials.tsx           # Tài liệu học tập
│   ├── Navbar.tsx                      # Thanh điều hướng
│   └── Schedule.tsx                    # Lịch học
│
├── lib/                                # Helper và utilities dùng chung
├── public/                             # Static assets
│
├── .env.local                          # Environment variables local
├── .gitignore                          # Git ignore configuration
├── AGENTS.md                           # Hướng dẫn cho AI agents
├── CLAUDE.md                           # Hướng dẫn cho Claude
├── eslint.config.mjs                   # ESLint configuration
├── next-env.d.ts                       # Next.js TypeScript definitions
├── next.config.ts                      # Next.js configuration
├── package.json                        # Dependencies và scripts
├── package-lock.json                   # Dependency lock file
├── postcss.config.mjs                 # PostCSS configuration
├── README.md                           # Documentation
├── tailwind.config.ts                  # Tailwind configuration
└── tsconfig.json                       # TypeScript configuration
```

---

## Cài đặt

### 1. Clone repository

Tải repository về máy tính:

```bash
git clone <repository-url>
```

Di chuyển vào thư mục dự án:

```bash
cd teacher-hub
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Chạy môi trường development

```bash
npm run dev
```

Sau đó mở trình duyệt tại:

```text
http://localhost:3000
```

---

## Biến môi trường

Nếu dự án sử dụng Firebase hoặc các dịch vụ bên ngoài, hãy tạo file `.env.local`.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Không commit thông tin nhạy cảm, private key hoặc secret key lên GitHub.

File `.env.local` nên được thêm vào `.gitignore`.

---

## Kiến trúc Component

Dự án được chia thành hai nhóm component chính.

### Public Components

Các component dành cho người dùng:

```text
Navbar
Hero
Announcement
LearningMaterials
Schedule
Gallery
Games
FAQ
Contact
ContactForm
Footer
```

Các component này được sử dụng để xây dựng giao diện website chính.

### Admin Components

Các component dành cho khu vực quản trị:

```text
AdminDashboard
AdminAnnouncements
AdminContact
AdminGallery
AdminGames
AdminMaterials
AdminSchedule
```

Mỗi component Admin phụ trách một chức năng quản lý riêng.

---

## Admin

Khu vực Admin được đặt tại `/admin`.

Các trang Admin hiện có:

```text
/admin
/admin/login
/admin/forgot-password
```

Admin có thể quản lý thông báo, liên hệ, hình ảnh, trò chơi, tài liệu và lịch học.

Trong các phiên bản tiếp theo, hệ thống có thể được mở rộng với Firebase Authentication, Database, Storage và phân quyền người dùng.

---

## 📱 Responsive

Website được thiết kế responsive và hỗ trợ nhiều kích thước màn hình:

* Desktop
* Laptop
* Tablet
* Mobile

Các breakpoint và style responsive được quản lý thông qua Tailwind CSS kết hợp với CSS tùy chỉnh.

---

## Build Production

Build project cho môi trường production:

```bash
npm run build
```

Chạy phiên bản production:

```bash
npm start
```

---

## Deploy

Dự án được định hướng triển khai trên Vercel.

Quy trình triển khai cơ bản:

```text
GitHub Repository
        │
        ▼
      Vercel
        │
        ▼
  Next.js Build
        │
        ▼
   Production
```

Khi deploy, cần cấu hình Environment Variables trên Vercel nếu dự án sử dụng Firebase hoặc các dịch vụ bên ngoài.

---

## Git Workflow

Các thay đổi có thể được commit bằng:

```bash
git add .
git commit -m "feat: update teacher hub"
git push
```

### Quy ước Commit

```text
feat:      Thêm chức năng mới
fix:       Sửa lỗi
style:     Thay đổi giao diện / CSS
refactor:  Thay đổi cấu trúc code
docs:      Cập nhật tài liệu
chore:     Cập nhật cấu hình hoặc dependency
```

Ví dụ:

```bash
git commit -m "feat: add admin schedule management"
```

---

# QUY ĐỊNH SỬ DỤNG

> **NGHIÊM CẤM SỬ DỤNG DỰ ÁN NÀY DƯỚI BẤT KỲ HÌNH THỨC NÀO NẾU CHƯA ĐƯỢC SỰ CHO PHÉP CỦA CHỦ SỞ HỮU.**

Dự án **Teacher Hub** là dự án cá nhân và toàn bộ mã nguồn, giao diện, thiết kế, nội dung, hình ảnh, tài liệu, cấu trúc thư mục, component và các thành phần liên quan thuộc quyền quản lý của chủ sở hữu.

Việc repository được công khai không có nghĩa là mã nguồn được cấp phép sử dụng tự do.

---

### Teacher Hub

Nền tảng cá nhân dành cho giáo viên, học sinh và tài liệu học tập.

**© 2026 Teacher Hub — All Rights Reserved.**
