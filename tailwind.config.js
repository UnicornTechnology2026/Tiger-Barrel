/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f3',
          100: '#fde3e5',
          200: '#fbcbd0',
          300: '#f7a1aa',
          400: '#ef6574',
          500: '#e1202e',
          600: '#c81a28',
          700: '#a31522',
          800: '#82131d',
          900: '#6e2028',
          950: '#3f0f15',
        },
        gold: {
          300: '#e8d48a',
          400: '#d4b25a',
          500: '#b8923f',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}