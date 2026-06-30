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
          50: "#eef7ff",
          100: "#d9ecff",
          500: "#2373c6",
          600: "#1d5fa5",
          700: "#174d86",
          900: "#102f50"
        }
      }
    }
  },
  plugins: []
};

export default config;
