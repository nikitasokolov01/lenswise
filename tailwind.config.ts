import type { Config } from "tailwindcss";

/** Palette color that reads its RGB channels from a CSS variable so the whole
 *  theme can be swapped (light / dark) without changing any component class. */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: v("--c-navy-50"),
          100: v("--c-navy-100"),
          200: v("--c-navy-200"),
          300: v("--c-navy-300"),
          400: v("--c-navy-400"),
          500: v("--c-navy-500"),
          600: v("--c-navy-600"),
          700: v("--c-navy-700"),
          800: v("--c-navy-800"),
          900: v("--c-navy-900"),
          950: v("--c-navy-950"),
        },
        teal: {
          50: v("--c-teal-50"),
          100: v("--c-teal-100"),
          200: v("--c-teal-200"),
          300: v("--c-teal-300"),
          400: v("--c-teal-400"),
          500: v("--c-teal-500"),
          600: v("--c-teal-600"),
          700: v("--c-teal-700"),
          800: v("--c-teal-800"),
          900: v("--c-teal-900"),
        },
        paper: v("--c-paper"),
        white: v("--c-white"),
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(22, 28, 41, 0.06), 0 1px 3px 0 rgba(22, 28, 41, 0.08)",
        card: "0 1px 3px 0 rgba(22, 28, 41, 0.08)",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
    },
  },
  plugins: [],
};

export default config;
