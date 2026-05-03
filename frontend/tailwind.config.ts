/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

/**
 * Soft modern UI — warm beige surfaces, fresh green brand, soft contrast.
 * Page #F4F3EF · Card #FAFAF7 · Primary #A6D97A · Accent #7FBF6A · Emphasis #2F6B2F
 */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        /** Warm neutrals (merge with default gray for hovers / borders) */
        gray: {
          ...defaultTheme.colors.gray,
          50: '#F9F8F5',
          100: '#EEEDE8',
          200: '#DCDCDC',
        },
        ink: {
          950: '#EEEDE8',
          900: '#FAFAF7',
          800: '#F4F3EF',
          700: '#FAFAF7',
          600: '#E8F0E0',
          500: '#DCEBCF',
        },
        /** Legacy slot name — maps to brand greens */
        amber: {
          glow: '#A6D97A',
          soft: '#7FBF6A',
          dim: 'rgba(166, 217, 122, 0.22)',
        },
        jade: {
          DEFAULT: '#E8F0E0',
          dim: 'rgba(166, 217, 122, 0.35)',
        },
        snow: '#333333',
        mist: '#666666',
        ghost: '#8C8C8C',
        brand: {
          DEFAULT: '#A6D97A',
          hover: '#7FBF6A',
          highlight: '#EDF5E6',
          active: '#DCEBCF',
        },
        edu: {
          warn: '#E8A838',
          error: '#D95C5C',
          info: '#5B8FC7',
        },
        /**
         * AI subtitle panel — beige canvas, card surfaces, green accent, clear type scale.
         */
        sub: {
          panel: '#F4F3EF',
          card: '#FAFAF7',
          active: '#EAF6E3',
          accent: '#7FBF6A',
          ink: '#222222',
          muted: '#666666',
          time: '#999999',
          pinyin: '#6FAF6A',
          line: '#E6E4DF',
        },
        /** Main app tab bar — beige rail, green active state, monochrome stroke icons */
        navtab: {
          bar: '#F4F3EF',
          text: '#777777',
          icon: '#888888',
          activeBg: '#EAF6E3',
          activeText: '#2F6B2F',
          activeIcon: '#5FAE55',
        },
      },
      boxShadow: {
        edu: '0 1px 2px rgba(0, 0, 0, 0.05), 0 4px 14px rgba(0, 0, 0, 0.05)',
        'edu-md':
          '0 2px 6px rgba(0, 0, 0, 0.05), 0 8px 20px rgba(0, 0, 0, 0.06)',
        'edu-lg':
          '0 4px 12px rgba(0, 0, 0, 0.05), 0 16px 40px rgba(0, 0, 0, 0.06)',
        'sub-card': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'sub-active':
          '0 2px 14px rgba(127, 191, 106, 0.12), 0 0 0 1px rgba(127, 191, 106, 0.18)',
      },
      borderRadius: {
        edu: '16px',
      },
      height: {
        dvh: '100dvh',
      },
      minHeight: {
        dvh: '100dvh',
      },
      top: {
        14: '3.5rem',
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-amber': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(166, 217, 122, 0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(166, 217, 122, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
        'fade-in': 'fade-in 0.25s ease-out',
        'pulse-amber': 'pulse-amber 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      backgroundImage: {
        'ink-radial':
          'radial-gradient(ellipse 120% 95% at 50% -20%, rgba(166, 217, 122, 0.18) 0%, rgba(244, 243, 239, 0.9) 45%, #F4F3EF 70%, #F4F3EF 100%)',
        'shimmer-gradient':
          'linear-gradient(90deg, rgba(238, 237, 232, 0.95) 0%, rgba(232, 240, 224, 0.85) 50%, rgba(238, 237, 232, 0.95) 100%)',
      },
    },
  },
  plugins: [],
}
