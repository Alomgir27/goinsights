/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"]
      },
      colors: {
        brand: "#171717",
        muted: "#737373",
        border: "#e5e5e5",
        surface: "#fafafa"
      },
      animation: {
        "fade-up": "fadeUp 0.3s ease-out"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px) translateX(-50%)" },
          "100%": { opacity: "1", transform: "translateY(0) translateX(-50%)" }
        }
      }
    }
  },
  plugins: []
};
