import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "LensWise — Optical Quote Builder",
  description:
    "LensWise: a multi-tenant, in-office optical quote builder. No patient-identifying information is collected or stored.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#161c29",
};

/**
 * Runs before first paint so the correct palette is applied with no flash of
 * the wrong theme. Reads the same localStorage key the ThemeProvider uses and
 * resolves "system" against the OS preference.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('lenswise:theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
