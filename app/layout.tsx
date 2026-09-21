import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Baloo_2, Mali } from "next/font/google";
import RegisterServiceWorker from "./RegisterServiceWorker";
import PinAdminModal from "@/components/PinAdminModal";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const baloo2 = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700", "800"],
  variable: "--font-baloo-2",
  display: "swap",
});

const mali = Mali({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700"],
  variable: "--font-mali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lớp học cô Trúc",
  description: "Website thông tin lớp học",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Teacher Hub",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

const themeInitScript = `
try {
  var t = localStorage.getItem("theme") || "system";
  var d = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", d);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${beVietnamPro.variable} ${baloo2.variable} ${mali.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <RegisterServiceWorker />

        {/* 2. Đặt component modal PIN ở đây để chạy ngầm trên toàn bộ ứng dụng */}
        <PinAdminModal />

        {children}
      </body>
    </html>
  );
}
