import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "provopadel.com",
  description: "Padel tournament management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-900 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
