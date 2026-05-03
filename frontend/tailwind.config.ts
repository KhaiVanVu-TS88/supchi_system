/** @type {import('tailwindcss').Config} */
/**
 * Educational light UI — Notion × Duolingo × Anki
 * BG #FFFFFF / #F7F9FC · Surface #FDFEFE · Brand #4CAF88
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
        ink: {
          950: '#F7F9FC',
          900: '#FFFFFF',
          800: '#F7F9FC',
          700: '#FDFEFE',
          600: '#E8F6EF',
          500: '#D1FAE5',
        },
        /** Interactive accent slot — soft green brand */
        amber: {
          glow: '#4CAF88',
          soft: '#6FD3A5',
          dim: 'rgba(76, 175, 136, 0.18)',
        },
        jade: {
          DEFAULT: '#E8F6EF',
          dim: 'rgba(209, 250, 229, 0.65)',
        },
        snow: '#1F2937',
        mist: '#6B7280',
        ghost: '#9CA3AF',
        brand: {
          DEFAULT: '#4CAF88',
          hover: '#6FD3A5',
          highlight: '#E8F6EF',
          active: '#D1FAE5',
        },
        edu: {
          warn: '#FFB020',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      boxShadow: {
        edu: '0 1px 2px rgba(31, 41, 55, 0.04), 0 2px 8px rgba(31, 41, 55, 0.06)',
        'edu-md':
          '0 4px 6px -1px rgba(31, 41, 55, 0.06), 0 8px 20px -4px rgba(31, 41, 55, 0.07)',
        'edu-lg':
          '0 12px 28px -6px rgba(31, 41, 55, 0.1), 0 4px 12px -2px rgba(31, 41, 55, 0.05)',
      },
      borderRadius: {
        edu: '14px',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(76, 175, 136, 0.45)' },
          '50%': { boxShadow: '0 0 0 7px rgba(76, 175, 136, 0)' },
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
          'radial-gradient(ellipse 120% 90% at 50% -25%, rgba(232, 246, 239, 0.85) 0%, rgba(247, 249, 252, 0.5) 42%, #FFFFFF 72%, #FFFFFF 100%)',
        'shimmer-gradient':
          'linear-gradient(90deg, rgba(243, 244, 246, 0.8) 0%, rgba(232, 246, 239, 0.9) 50%, rgba(243, 244, 246, 0.8) 100%)',
      },
    },
  },
  plugins: [],
}
