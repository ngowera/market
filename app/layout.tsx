import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nyasamarket.com | Secure asset marketplace",
  description: "Discover transparent, institution-led asset sales and recovery opportunities on nyasamarket.com.",
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
