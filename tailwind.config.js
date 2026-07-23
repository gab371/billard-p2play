import { fontFamily } from "tailwindcss/defaultTheme"
import tailwindAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        felt: "#0e3b2e",
        feltDark: "#0a2c22",
        cushion: "#1b4d3a",
        brass: "#c9a14a",
      },
      fontFamily: {
        sans: ["Outfit", ...fontFamily.sans],
      },
    },
  },
  plugins: [tailwindAnimate],
}
