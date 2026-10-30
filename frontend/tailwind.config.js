/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0d1117",
          card: "#0f1623",
          elevated: "#111827",
        },
        border: {
          subtle: "rgba(255,255,255,0.08)",
          glow: "rgba(59,130,246,0.3)",
        },
      },
    },
  },
  plugins: [],
};
