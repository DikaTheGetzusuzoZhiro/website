import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Chat",
  description: "Live Chat Support"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
