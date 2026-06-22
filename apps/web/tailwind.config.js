/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        surface: "#121821",
        "surface-2": "#1a2330",
        line: "#243043",
        text: "#e6edf3",
        muted: "#8b98a9",
        accent: "#4f8cff",
        good: "#36d399",
        warn: "#fbbd23",
        bad: "#f87272",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
