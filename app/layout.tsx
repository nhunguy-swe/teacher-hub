import type { Metadata } from "next";
import { Be_Vietnam_Pro, Baloo_2, Mali } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${baloo2.variable} ${mali.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}