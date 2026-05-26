import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Theorem's Harness",
    template: "%s | Theorem's Harness",
  },
  description: "Public showroom for Theorem's Harness, cross-agent coordination, and Context Theorem SDK surfaces.",
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
