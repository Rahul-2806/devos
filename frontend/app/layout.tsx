import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "DevOS — AI-Powered Developer Operating System",
  description:
    "A unified intelligent platform: AI code review, personal knowledge graph, ML-driven DSA prep, system design vision chat, and career analytics — all in one.",
  keywords: ["developer tools", "AI", "code review", "LeetCode", "system design", "career analytics"],
  authors: [{ name: "Rahul", url: "https://rahulaiportfolio.online" }],
  openGraph: {
    title: "DevOS — AI-Powered Developer Operating System",
    description: "5 AI-powered modules to make you a better software engineer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#0a0a0f] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
