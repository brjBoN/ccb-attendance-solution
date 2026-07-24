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
          50: "#eef8f5",
          100: "#d8eee8",
          200: "#b9ded5",
          300: "#8cc7ba",
          400: "#59aa9a",
          500: "#318d7e",
          600: "#167365",
          700: "#125d53",
          800: "#124b44",
          900: "#123f3a",
          950: "#082623"
        }
      }
    }
  },
  plugins: []
};

export default config;
