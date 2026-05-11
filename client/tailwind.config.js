/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ygo-gold': '#F5C542',
        'ygo-dark': '#1A1A2E',
        'ygo-blue': '#3B82F6',
        'ygo-red': '#EF4444',
        'ygo-purple': '#7C3AED',
        'ygo-field': '#0F0F1E',
      },
      width: {
        'card': '80px',
      },
      height: {
        'card': '112px',
      },
    },
  },
  plugins: [],
}