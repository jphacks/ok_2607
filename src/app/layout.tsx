import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TriOne",
  description: "3択から選ぶだけで、やることとやらないことが決まるタスク管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
