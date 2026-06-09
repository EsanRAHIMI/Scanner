import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Lorenzo brand palette (mirrors the frontend dashboard design system).
        brand: {
          white: '#FFFFFF',
          'light-gray': '#DCDCDC',
          'medium-gray': '#A0A0A0',
          'dark-gray': '#787878',
          black: '#1E1E1E',
          burgundy: '#500F28',
        },
        // The accent color used across the products app was emerald. We remap the
        // entire `emerald` ramp to a burgundy scale so every existing accent usage
        // (selection, focus rings, buttons, group borders, etc.) becomes on-brand
        // automatically — without touching hundreds of call sites. Status colors
        // (green / red / amber / sky) are intentionally left untouched.
        emerald: {
          50: '#FCF2F6',
          100: '#F8E3EC',
          200: '#F0C6D8',
          300: '#E29DBA',
          400: '#CE6B93',
          500: '#B0426F',
          600: '#7E1F44',
          700: '#500F28',
          800: '#420C21',
          900: '#380A1C',
          950: '#24060F',
        },
      },
      boxShadow: {
        'brand-card': '0 8px 30px -12px rgba(30,30,30,0.12)',
        'brand-card-hover': '0 20px 40px -16px rgba(80,15,40,0.22)',
        'brand-panel': '0 12px 40px -20px rgba(30,30,30,0.14)',
      },
    },
  },
  plugins: [],
};

export default config;
