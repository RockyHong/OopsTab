/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/*.html',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#328E6E',
        secondary: '#67AE6E',
        accent: '#90C67C',
        surface: '#E1EEBC',
        danger: '#EF4444',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}; 