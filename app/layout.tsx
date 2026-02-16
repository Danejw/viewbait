import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getInitialAuthState } from "@/lib/server/data/auth";
import { TourOverlay } from "@/tourkit/app/TourOverlay";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "ViewBait - Create Viral Thumbnails with AI",
  description: "AI-powered thumbnail generation that helps creators design eye-catching, conversion-optimized thumbnails in seconds.",
};

export const viewport = {
  themeColor: "#b91c3c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAuthState = await getInitialAuthState();
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers initialAuthState={initialAuthState}>
          {children}
          <TourOverlay />
        </Providers>
      </body>
    </html>
  );
}
