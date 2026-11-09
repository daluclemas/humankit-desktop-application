import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HumanKit — Understand your signals",
  description:
    "A little toolkit for understanding and interacting with human signals.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="pb-6">{children}</div>
      </body>
    </html>
  );
}
