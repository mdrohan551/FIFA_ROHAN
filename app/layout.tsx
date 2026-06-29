import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveTV",
  description: "A local-first live TV player powered by your M3U playlist"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
