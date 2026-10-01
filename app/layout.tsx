import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Limon Panel",
  description: "Limon Yönetim Paneli",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Limon Panel",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { NotificationManager } from "@/components/NotificationManager";

export default function RootLayout({ children }: any) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className={`${jakarta.className} min-h-full flex flex-col bg-gray-50`}>
        <NotificationManager />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
