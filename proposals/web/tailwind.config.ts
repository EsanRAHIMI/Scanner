import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lorenzo brand palette (mirrors the products app design system).
        brand: {
          white: '#FFFFFF',
          'light-gray': '#DCDCDC',
          'medium-gray': '#A0A0A0',
          'dark-gray': '#787878',
          black: '#1E1E1E',
          burgundy: '#500F28',
        },
        accent: {
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
        },
      },
      boxShadow: {
        'brand-card': '0 8px 30px -12px rgba(30,30,30,0.12)',
        'brand-card-hover': '0 20px 40px -16px rgba(80,15,40,0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
