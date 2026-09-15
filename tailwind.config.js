/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#050510', // Deep Void (NOT pure black - reduces banding)
        surface: '#1E1E1E', // Card/Ad Background
        primary: '#8B5CF6', // Neon Purple - Action
        success: '#34D399', // Mint Green - Dopamine
        textMain: '#E5E5E5', // Off-White
        textMuted: '#A1A1AA', // Grey
      },
    },
  },
  plugins: [],
};
