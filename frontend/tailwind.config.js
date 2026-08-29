/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        aurora: {
          // Flat iOS/iMessage-style palette: system blue for actions/links, system
          // green for toggles and success (matching the iOS Switch default), soft
          // grays for text/borders instead of near-black. No gradients.
          purple: "#007AFF",
          accent: "#007AFF",
          "accent-hover": "#0066D6",
          "accent-soft": "#E8F1FF",
          blue: "#007AFF",
          cyan: "#007AFF",
          success: "#34C759",
          "success-soft": "#E6F9EA",
          warning: "#FF9500",
          "warning-soft": "#FFF2E0",
          error: "#FF3B30",
          "error-soft": "#FFEBEA",
          bg: "#FFFFFF",
          surface: "#FFFFFF",
          border: "#E5E5EA",
          text: "#1C1C1E",
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
