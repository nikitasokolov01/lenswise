import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { NavBar } from "@/components/layout/NavBar";

export const metadata: Metadata = {
  title: "LensWise — Optical Quote Builder",
  description:
    "LensWise: an anonymous, in-office optical quote builder proof of concept. No patient-identifying information is collected or stored.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#161c29",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
