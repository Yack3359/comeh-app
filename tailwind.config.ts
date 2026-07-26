import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#003B7A",
          foreground: "#FFFFFF",
          50: "#EFF6FF",
          100: "#DBEAFE",
          600: "#0050A4",
          700: "#003B7A",
          800: "#002C5C",
          900: "#001F42",
        },
        secondary: {
          DEFAULT: "#FFFFFF",
          foreground: "#10243E",
          muted: "#F3F6FA",
        },
        accent: {
          DEFAULT: "#E30613",
          foreground: "#FFFFFF",
          50: "#FFF1F2",
          600: "#E30613",
          700: "#BE0010",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        institutional: "0 18px 50px -28px rgba(0, 59, 122, 0.45)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
