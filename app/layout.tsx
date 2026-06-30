import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCB QR Attendance",
  description: "QR check-in app for CCB small group attendance"
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
