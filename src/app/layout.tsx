import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call Intelligence · PestLaunch",
  description: "Every call graded, scored and coached against your own standards.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
