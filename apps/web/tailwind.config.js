/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Refined dark — deep neutral-violet base with an indigo/violet accent.
        bg: "#08080d",
        surface: "#111119",
        "surface-2": "#1a1a25",
        line: "#252533",
        text: "#f0f0f5",
        muted: "#9494a8",
        // Driven by CSS variables so the user can pick their accent in Settings.
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#fb7185",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        // Soft, layered elevation — reads as depth, not as a hard outline.
        card: "0 1px 2px rgba(0,0,0,0.35), 0 8px 24px -12px rgba(0,0,0,0.45)",
        // Floating chrome (nav bar, FAB).
        float: "0 8px 24px -6px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)",
        // Soft accent glow for primary actions (follows the chosen accent).
        glow: "0 10px 30px -12px rgb(var(--accent) / 0.55)",
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
