/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: '#0b0e14',
          panel: '#121721',
          border: '#222b3a',
          walnut: '#6b4423',
          concrete: '#2d333b',
          steel: '#181c24',
          amber: '#d97706',
          blue: '#3b82f6',
          emerald: '#10b981',
        }
      }
    },
  },
  plugins: [],
}
