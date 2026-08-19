import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMERA | محرر كتالوج التصنيع والتشطيب",
  description: "محرر عربي احترافي لإنشاء كتالوجات التصنيع والتشطيب وتصديرها بصيغة PDF.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/assets/images/omera-logo-transparent.png",
    shortcut: "/assets/images/omera-logo-transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
