/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        aurora: {
          purple: "#7928ca",
          blue: "#0ea5e9",
          cyan: "#06b6d4",
          success: "#10b981",
          warning: "#f97316",
          error: "#ec4899",
          bg: "#0f172a",
          text: "#f8fafc",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        glass: "12px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.37)",
        "glass-hover": "0 12px 40px 0 rgba(121, 40, 202, 0.35)",
      },
      backgroundImage: {
        "aurora-gradient": "linear-gradient(135deg, #7928ca 0%, #0ea5e9 50%, #06b6d4 100%)",
        "aurora-radial": "radial-gradient(circle at top left, rgba(121,40,202,0.25), transparent 50%), radial-gradient(circle at bottom right, rgba(14,165,233,0.25), transparent 50%)",
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
