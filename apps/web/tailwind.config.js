/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Refined dark — deep neutral-violet base with an indigo/violet accent.
        bg: "#0a0a0f",
        surface: "#14141d",
        "surface-2": "#1d1d29",
        line: "#2a2a3a",
        text: "#ececf1",
        muted: "#9393a6",
        accent: "#7c6bff",
        "accent-strong": "#5d44f5",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#fb7185",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.4)",
        // Soft violet glow for primary actions.
        glow: "0 10px 30px -12px rgba(124, 107, 255, 0.55)",
      },
      fontFamily: {
        sans: [
          "Manrope Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Distinctive, sporty numerals for the big HUD figures.
        display: [
          "Space Grotesk Variable",
          "Manrope Variable",
          "ui-sans-serif",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
