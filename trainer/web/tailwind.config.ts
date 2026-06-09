import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          white: '#FFFFFF',
          'light-gray': '#DCDCDC',
          'medium-gray': '#A0A0A0',
          'dark-gray': '#787878',
          black: '#1E1E1E',
          burgundy: '#500F28',
        },
      },
      boxShadow: {
        'brand-card': '0 8px 30px -12px rgba(30,30,30,0.12)',
        'brand-card-hover': '0 20px 40px -16px rgba(80,15,40,0.22)',
        'brand-panel': '0 12px 40px -20px rgba(30,30,30,0.14)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
