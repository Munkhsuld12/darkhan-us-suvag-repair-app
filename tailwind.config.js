/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff7ff",
          100: "#dbeeff",
          200: "#bedfff",
          300: "#91c6ff",
          400: "#5ba6ff",
          500: "#2d83f3",
          600: "#1666d8",
          700: "#1553b4",
          800: "#18478f",
          900: "#183c74"
        },
        ink: {
          900: "#0f213d"
        },
        sand: "#f3f9ff",
        accent: "#1eb7e8"
      },
      boxShadow: {
        soft: "0 12px 28px rgba(15, 23, 42, 0.08)",
        card: "0 2px 10px rgba(15, 23, 42, 0.05)"
      },
      backgroundImage: {
        hero: "radial-gradient(circle at top left, rgba(30,183,232,0.10), transparent 30%), linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%)"
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

