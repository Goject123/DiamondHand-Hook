import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DiamondHand Loyalty Hook",
  description: "A Uniswap v4 Hook demo that rewards long-term holders with lower swap fees.",
  icons: {
    icon: "/logo/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
