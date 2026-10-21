import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PC Monitor — Monitoring perangkat",
  description: "Pantau ketersediaan perangkat PC dari satu dashboard terpusat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
