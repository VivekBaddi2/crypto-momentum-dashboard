/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0A0D12", // page background
          900: "#0F131A", // panel background
          800: "#12161D", // card / row background
          700: "#1B212B", // borders
          600: "#2A3140", // hover borders
        },
        ink: {
          100: "#E6E9EF", // primary text
          300: "#A6AEBB", // secondary text
          500: "#7C8797", // muted text
        },
        amber: {
          400: "#E8B24C",
          500: "#D4A24C", // primary accent (ticker amber)
        },
        bull: {
          400: "#4FE3B5",
          500: "#3DD9A3", // buy / bullish
        },
        bear: {
          400: "#F5806A",
          500: "#F0654A", // sell / bearish
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        panel: "0 0 0 1px #1B212B",
      },
      keyframes: {
        "flash-bull": {
          "0%": { backgroundColor: "rgba(61, 217, 163, 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-bear": {
          "0%": { backgroundColor: "rgba(240, 101, 74, 0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        "slide-in": {
          "0%": { transform: "translateX(12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "flash-bull": "flash-bull 0.9s ease-out",
        "flash-bear": "flash-bear 0.9s ease-out",
        "slide-in": "slide-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
