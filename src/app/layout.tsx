import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astra-Nomical",
  description: "Experience real exoplanets as living worlds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
