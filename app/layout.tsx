import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { ThemeProvider } from "@/components/ThemeProvider";
import MainLayout from "@/components/MainLayout";
import { AuthProvider } from "@/lib/context/AuthContext";
import { CaptchaProvider } from "@/components/CaptchaProvider";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { AestheticProvider } from "@/lib/context/AestheticContext";

export const metadata: Metadata = {
  title: {
    default: "TESVİKSOR AI - Yatırım Teşvik Rehberi",
    template: "%s | TESVİKSOR AI",
  },
  description:
    "Yatırım Teşvik Mevzuatı Analiz Sistemi. Yapay zeka destekli yatırım teşvik rehberi ve mevzuat analizi.",
  keywords: [
    "yatırım teşvik",
    "mevzuat analizi",
    "AI rehber",
    "teşvik robotu",
    "Türkiye yatırım teşvikleri",
    "yapay zeka danışman",
  ],
  authors: [{ name: "TESVİKSOR AI Team" }],
  creator: "TESVİKSOR AI",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://tesviksor.ai", // Replace with real domain if different
    title: "TESVİKSOR AI - Yatırım Teşvik Rehberi",
    description:
      "Yapay zeka ile yatırım teşvik mevzuatını saniyeler içinde analiz edin.",
    siteName: "TESVİKSOR AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "TESVİKSOR AI - Yatırım Teşvik Rehberi",
    description:
      "Yapay zeka ile yatırım teşvik mevzuatını saniyeler içinde analiz edin.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AestheticProvider>
            <CaptchaProvider>
              <AuthProvider>
                <MainLayout>{children}</MainLayout>
              </AuthProvider>
            </CaptchaProvider>
          </AestheticProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
