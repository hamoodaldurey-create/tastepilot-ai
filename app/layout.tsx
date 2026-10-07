import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TastePilot AI · Follow your taste",
  description: "Discover dining, travel, and films connected to the things you love, with Qloo-powered cultural intelligence.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
