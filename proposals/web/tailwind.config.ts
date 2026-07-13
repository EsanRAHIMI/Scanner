import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
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
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
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
    },
  },
  plugins: [],
};

export default config;
