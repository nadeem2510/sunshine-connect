/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          500: '#9333ea',
          600: '#7B2D9B',
          700: '#6B2489',
        },
        sunshine: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#F5A623',
          500: '#e8961a',
          600: '#d97706',
        },
      },
    },
  },
  plugins: [],
};
