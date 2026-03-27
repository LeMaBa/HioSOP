/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Malteser Corporate Identity — Red #E2001A
        primary: {
          50:  "#fff0f1",
          100: "#ffdde0",
          200: "#ffb3b9",
          300: "#ff8089",
          400: "#ff4d5a",
          500: "#ff1a2b",
          600: "#e2001a",  // Malteser Red
          700: "#b80015",
          800: "#8f0010",
          900: "#66000b",
        },
      },
    },
  },
  plugins: [],
};
