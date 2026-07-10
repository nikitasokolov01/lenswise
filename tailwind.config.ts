import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f2f5f8",
          100: "#e3e9ef",
          200: "#c3d0dd",
          300: "#98abc0",
          400: "#66809f",
          500: "#496182",
          600: "#39496a",
          700: "#2d3a54",
          800: "#212a3d",
          900: "#161c29",
          950: "#0d111a",
        },
        teal: {
          50: "#eefbfb",
          100: "#d5f3f4",
          200: "#aee5e8",
          300: "#78d1d7",
          400: "#3fb4bd",
          500: "#2497a1",
          600: "#1f7a84",
          700: "#1e646c",
          800: "#1e515a",
          900: "#1b444c",
        },
        paper: "#faf8f3",
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
