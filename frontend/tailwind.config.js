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
      }
    }
  },
  plugins: []
};
