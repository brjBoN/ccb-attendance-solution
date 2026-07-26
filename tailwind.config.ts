import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#b9d6ff",
          300: "#86b8ff",
          400: "#4c92ff",
          500: "#1f73ff",
          600: "#0866ff",
          700: "#0754d6",
          800: "#0a45ad",
          900: "#0c3b88",
          950: "#071f3f"
        }
      }
    }
  },
  plugins: []
};

export default config;
