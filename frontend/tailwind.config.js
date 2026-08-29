/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        aurora: {
          // Flat, single-accent palette — Trello/Atlassian/GHL-style blue, no gradients.
          purple: "#0C66E4",
          accent: "#0C66E4",
          "accent-hover": "#0955C5",
          "accent-soft": "#E9F2FF",
          blue: "#0C66E4",
          cyan: "#0C66E4",
          success: "#1F845A",
          "success-soft": "#DCFFF1",
          warning: "#B76E00",
          "warning-soft": "#FFF3D6",
          error: "#C9372C",
          "error-soft": "#FFECEB",
          bg: "#F7F8F9",
          surface: "#FFFFFF",
          border: "#DFE1E6",
          text: "#172B4D",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 1px 2px 0 rgba(9, 30, 66, 0.08), 0 0 1px 0 rgba(9, 30, 66, 0.14)",
        "glass-hover": "0 4px 8px -2px rgba(9, 30, 66, 0.12), 0 0 1px 0 rgba(9, 30, 66, 0.16)",
      },
      borderRadius: {
        xl: "0.5rem",
        "2xl": "0.625rem",
        "3xl": "0.75rem",
      },
      transitionDuration: {
        DEFAULT: "300ms",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-in": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 300ms ease-in-out",
        "slide-in": "slide-in 300ms ease-in-out",
      },
    },
  },
  plugins: [],
};
