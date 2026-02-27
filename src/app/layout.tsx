import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "百度网盘 · AList 下载器",
  description: "高速下载百度网盘文件，支持 4 种大文件下载模式",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body className={`${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
