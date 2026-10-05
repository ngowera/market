import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMRP | Collateral Marketplace",
  description: "Discover institution-approved assets across Malawi. Auctions, fixed-price sales and secure collection.",
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
