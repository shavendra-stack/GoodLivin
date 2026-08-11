import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoodLivin Inventory",
  description: "Inventory and batch management workspace for GoodLivin.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-LK" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
