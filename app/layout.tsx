import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientField } from "@/components/AmbientField";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Was still create-next-app's placeholder, which meant the live lookup page
  // showed "Create Next App" in the tab and in link previews.
  title: "GameShare — Get your login code",
  description:
    "Enter your Shopee Order ID and Steam username to get your login details and a live Steam Guard code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Fixed background layer for every page — see app/globals.css. */}
        <AmbientField />
        {children}
      </body>
    </html>
  );
}
