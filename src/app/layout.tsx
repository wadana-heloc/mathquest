import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathQuest — Enter the Number Wilds",
  description:
    "A browser-based math adventure game for gifted children. Math is the only currency of power.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Grain noise texture overlay */}
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}