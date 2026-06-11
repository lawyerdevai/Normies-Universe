import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const robotastic = localFont({
  src: "./fonts/robotastic.ttf",
  variable: "--font-robotastic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Normie Universe",
  description: "A living map of the Normies holder galaxy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${robotastic.variable} h-full`}
    >
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  );
}
