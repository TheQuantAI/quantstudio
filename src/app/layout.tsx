import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuantStudio — Quantum Circuit IDE | TheQuantCloud",
  description:
    "Write quantum code once, run anywhere. QuantStudio is the web IDE for TheQuantCloud platform — build, simulate, and deploy quantum circuits with QuantSDK.",
  keywords: [
    "quantum computing",
    "quantum circuit",
    "IDE",
    "QuantSDK",
    "TheQuantCloud",
    "simulator",
    "IBM Quantum",
    "IonQ",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
