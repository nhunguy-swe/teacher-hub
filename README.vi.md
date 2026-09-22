# Teacher Hub

[🇬🇧 English](./README.md)

**Teacher Hub** là một website giúp giáo viên quản lý và chia sẻ nội dung giảng dạy, theo dõi tiến độ học tập của học sinh, và tổ chức các hoạt động thi đua trong lớp — tất cả trong cùng một nơi.

Dự án được xây dựng bằng **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, và **Firebase**, gồm một trang web công khai dành cho phụ huynh/học sinh và một khu quản trị đầy đủ chức năng cho giáo viên, với giao diện hiện đại, responsive trên desktop, tablet, mobile, cùng chế độ **dark mode** được hỗ trợ toàn diện.

🔗 **Demo trực tiếp:** [teacher-hub-jet.vercel.app](https://teacher-hub-jet.vercel.app)

---

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt](#cài-đặt)
- [Biến môi trường](#biến-môi-trường)
- [Các lệnh có sẵn](#các-lệnh-có-sẵn)
- [Responsive](#responsive)
- [Dark Mode](#dark-mode)
- [Build cho Production](#build-cho-production)
- [Triển khai (Deployment)](#triển-khai-deployment)
- [Quy trình Git](#quy-trình-git)
- [Điều khoản sử dụng](#điều-khoản-sử-dụng)

---

## Tính năng

### Trang chủ (Public Site)

- **Trang giới thiệu** — phần hero giới thiệu giáo viên chủ nhiệm và lớp học.
- **Thông báo lớp** — danh sách thông báo có phân trang, cập nhật theo thời gian thực.
- **Thời khóa biểu** — lịch học buổi sáng/chiều, đồng bộ trực tiếp từ Firestore, hỗ trợ **xuất file Excel chỉ với một cú nhấp** (`.xlsx`, có gộp ô, viền, định dạng sẵn).
- **Góc học tập** — slide bài giảng và bài tập, lọc theo tab (Slide / Bài tập), có gắn nhãn môn học và nút chia sẻ.
- **Trò chơi giáo dục** — trò chơi luyện tập theo khối lớp (1–5), lọc theo môn học và mức độ.
- **Thư viện ảnh** — album ảnh hoạt động lớp học dạng cuộn ngang, kèm chế độ xem phóng to và tải ảnh về máy.
- **Hỏi đáp (FAQ)** — accordion câu hỏi thường gặp, bấm để mở rộng câu trả lời.
- **Liên hệ** — thông tin liên hệ và form gửi tin nhắn.
- **Giao diện responsive** — tối ưu cho desktop, tablet và mobile.
- **Dark mode** — hỗ trợ đầy đủ chế độ sáng/tối trên toàn bộ các mục.

### Hệ thống thi đua lớp học

- **Điểm tuần** — mỗi học sinh bắt đầu tuần với điểm nền, được cộng/trừ theo các mục ghi nhận hoạt động trong tuần.
- **Sao tích lũy** — điểm tích lũy dài hạn cho từng học sinh, hiển thị song song với điểm tuần.
- **Thi đua tổ** — học sinh được chia theo tổ; xếp hạng tổ tính từ tổng điểm thành viên cộng với điểm thưởng/phạt riêng của tổ, cập nhật theo thời gian thực.
- **Bảng vàng** — vinh danh các học sinh có điểm tuần cao nhất.
- **Thẻ đặc quyền & bốc thăm** — giáo viên tạo các "thẻ đặc quyền" làm phần thưởng (áp dụng cho học sinh, tổ, hoặc cả hai); học sinh/tổ được chọn sẽ quay và mở thẻ ngẫu nhiên, kết quả được ghi lại vào lịch sử hoạt động.
- **Sơ đồ lớp** — bố trí chỗ ngồi có thể chỉnh sửa và in trực tiếp, với style in riêng đảm bảo hiển thị đúng màu ở cả chế độ sáng và tối.

### Khu quản trị (Admin Dashboard)

Khu vực bảo mật bằng mật khẩu dành cho giáo viên/quản trị viên, xác thực qua Firebase Authentication:

- Đăng nhập quản trị và khôi phục mật khẩu.
- Bảng điều khiển quản trị trung tâm.
- **Học sinh** — quản lý danh sách học sinh, ảnh đại diện, tổ nhóm và số sao.
- **Sơ đồ lớp** — xây dựng và in bố trí chỗ ngồi.
- **Thi đua tổ** — quản lý điểm thưởng và xếp hạng các tổ.
- **Thẻ đặc quyền** — thêm/sửa/xóa thẻ đặc quyền; vận hành tính năng bốc thăm.
- **Thông báo** — thêm/sửa/xóa thông báo lớp.
- **Thời khóa biểu** — chỉnh sửa lịch học theo tuần; xuất Excel.
- **Góc học tập** — quản lý slide bài giảng và bài tập.
- **Trò chơi giáo dục** — quản lý kho trò chơi theo khối lớp/môn học.
- **Thư viện ảnh** — tải lên và quản lý ảnh lớp học.
- **Liên hệ** — xem và quản lý tin nhắn gửi từ form liên hệ.
- **Thông báo dạng toast** — phản hồi thành công/lỗi/thông tin nhất quán cho mọi thao tác quản trị.

---

## Công nghệ sử dụng

| Nhóm | Công nghệ |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Thư viện UI | [React](https://react.dev/) |
| Ngôn ngữ | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + CSS tùy chỉnh (theming, dark mode, style khi in) |
| Backend / Dữ liệu | [Firebase](https://firebase.google.com/) — Authentication, Firestore, Storage |
| Xuất Excel | [xlsx-js-style](https://www.npmjs.com/package/xlsx-js-style) |
| Hosting | [Vercel](https://vercel.com/) |

---

## Cấu trúc thư mục

```
teacher-hub/
├── app/              # Next.js App Router — trang, layout, route quản trị
├── components/       # Các component UI dùng chung (trang chủ + quản trị)
├── lib/              # Cấu hình Firebase, hàm xử lý dữ liệu (vd: tính điểm tuần)
├── public/           # Tài nguyên tĩnh
├── AGENTS.md         # Hướng dẫn cho AI coding agent làm việc trong repo
├── CLAUDE.md         # Hướng dẫn riêng cho Claude khi làm việc với dự án
├── README.md         # Bản tiếng Anh
└── README.vi.md      # File này
```

---

## Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/nhunguy-swe/teacher-hub.git
cd teacher-hub
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Thiết lập biến môi trường

Xem phần [Biến môi trường](#biến-môi-trường) bên dưới.

### 4. Chạy môi trường phát triển

```bash
npm run dev
```

Sau đó mở trình duyệt tại:

```
http://localhost:3000
```

---

## Biến môi trường

Dự án sử dụng Firebase cho Authentication, Firestore và Storage. Tạo file `.env.local` ở thư mục gốc dự án:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> ⚠️ Không commit file `.env.local` hoặc bất kỳ khóa bí mật/riêng tư nào lên GitHub. File này cần được liệt kê trong `.gitignore`.

---

## Các lệnh có sẵn

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build ứng dụng cho production |
| `npm start` | Chạy bản build production |
| `npm run lint` | Kiểm tra code bằng ESLint |

---

## Responsive

Trang web được thiết kế responsive đầy đủ, với các breakpoint riêng cho:

- Desktop
- Laptop
- Tablet
- Mobile (bao gồm menu điều hướng dạng hamburger)

Layout và khoảng cách được xử lý bằng Tailwind CSS kết hợp với CSS responsive tùy chỉnh (`@media` ở các mốc 900px, 640px và 400px).

---

## Dark Mode

Teacher Hub hỗ trợ đầy đủ giao diện tối, được bật bằng class `.dark` trên phần tử gốc:

- Các màu theme (nền, chữ, viền, thẻ nhãn, badge) được khai báo dưới dạng biến CSS và định nghĩa lại dưới `.dark`.
- Bảng màu của Tailwind được ghi đè ngay ở cấp biến, nên các class tiện ích như `bg-amber-50` hay `text-slate-600` tự động đổi theo dark mode — không cần viết tay `dark:` cho từng chỗ.
- Sơ đồ lớp có bộ token màu riêng (`--sc-*`) để đảm bảo hiển thị đúng cả trên màn hình lẫn khi in, ở cả hai chế độ sáng/tối.

---

## Build cho Production

Build dự án cho production:

```bash
npm run build
```

Chạy bản build production ở máy local:

```bash
npm start
```

---

## Triển khai (Deployment)

Dự án được triển khai trên **Vercel**.

```
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

Khi triển khai, nhớ cấu hình đầy đủ **Biến môi trường** (xem phần trên) trong cài đặt dự án trên Vercel.

---

## Quy trình Git

```bash
git add .
git commit -m "feat: thêm tính năng mới"
git push
```

### Quy ước commit

Dự án tuân theo phong cách rút gọn của [Conventional Commits](https://www.conventionalcommits.org/):

| Tiền tố | Dùng cho |
|---|---|
| `feat:` | Thêm tính năng mới |
| `fix:` | Sửa lỗi |
| `style:` | Thay đổi giao diện / CSS (không đổi logic) |
| `refactor:` | Tái cấu trúc code, không đổi hành vi |
| `docs:` | Cập nhật tài liệu |
| `chore:` | Cập nhật cấu hình hoặc dependency |

Ví dụ:

```bash
git commit -m "feat: thêm tính năng bốc thăm thẻ đặc quyền cho tổ"
```

---

## Điều khoản sử dụng

> **MỌI HÌNH THỨC SỬ DỤNG DỰ ÁN NÀY ĐỀU BỊ NGHIÊM CẤM NẾU KHÔNG CÓ SỰ CHO PHÉP TRƯỚC TỪ CHỦ SỞ HỮU.**

**Teacher Hub** là dự án cá nhân. Toàn bộ mã nguồn, giao diện, thiết kế, nội dung, hình ảnh, tài liệu, cấu trúc thư mục, component và các tài sản liên quan đều thuộc quyền sở hữu và kiểm soát của chủ dự án.

Việc công khai repository này không đồng nghĩa với việc mã nguồn được cấp phép sử dụng, sao chép hay phân phối lại tự do.

---

### Teacher Hub

Nền tảng cá nhân dành cho một giáo viên, học sinh của cô, và các tài liệu học tập được chia sẻ.

**© 2026 Teacher Hub — Bảo lưu mọi quyền.**
