/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf6",
          100: "#d6f9e8",
          400: "#34d399",
          500: "#0ea472",
          600: "#0b8a5f",
          700: "#0a704e",
        },
      },
    },
  },
  plugins: [],
};
