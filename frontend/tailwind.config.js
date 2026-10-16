/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        surface: "#111827",
        "surface-elevated": "#1a2234",
        border: "#1f293d",
        primary: {
          DEFAULT: "#6366f1", // Indigo
          hover: "#4f46e5",
          light: "#818cf8",
        },
        accent: {
          DEFAULT: "#06b6d4", // Cyan
          hover: "#0891b2",
        },
        sinhala: {
          gold: "#f59e0b",
          maroon: "#881337",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        sinhala: ["var(--font-sinhala)", "Noto Sans Sinhala", "sans-serif"],
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        }
      }
    },
  },
  plugins: [],
};
