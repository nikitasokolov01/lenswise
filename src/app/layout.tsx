import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uselenswise.com"),
  applicationName: "LensWise",
  title: {
    default: "LensWise — Optical Quote Builder",
    template: "%s | LensWise",
  },
  description:
    "Build optical quotes, manage frame inventory, track sales, and coordinate multiple locations with LensWise.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LensWise",
    title: "LensWise — Optical Quote Builder",
    description:
      "Build optical quotes, manage frame inventory, track sales, and coordinate multiple locations with LensWise.",
  },
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
