import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content OS",
  description: "Cockpit editorial personal — calendario, banco y Client Brain",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
