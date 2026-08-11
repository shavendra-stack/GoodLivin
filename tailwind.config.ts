import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17352B",
        forest: {
          50: "#F0F6F2",
          100: "#DCEBE2",
          200: "#B9D7C5",
          300: "#8EBDA1",
          400: "#5D9F78",
          500: "#347653",
          600: "#245D40",
          700: "#1C4A34",
          800: "#183B2C",
          900: "#153126",
        },
        sage: "#C8D9C6",
        canvas: "#F8F7F2",
        sand: "#EEEDE5",
        peach: "#F5DCC9",
        amber: "#C9862C",
        charcoal: {
          900: "#000000",
          800: "#141414",
          700: "#1C1C1C",
          600: "#242424",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 53, 43, 0.08)",
        lift: "0 12px 32px rgba(23, 53, 43, 0.10)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
