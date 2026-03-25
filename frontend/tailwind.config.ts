/** @type {import('tailwindcss').Config} */
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
          950: '#08080f',
          900: '#0f0f1a',
          800: '#16162a',
          700: '#1e1e38',
          600: '#2a2a4a',
          500: '#3a3a5c',
        },
        amber: {
          glow: '#f5c842',
          soft: '#f0a855',
          dim: 'rgba(245,200,66,0.15)',
        },
        jade: {
          DEFAULT: '#4ecdc4',
          dim: 'rgba(78,205,196,0.15)',
        },
        snow: '#f0ede8',
        mist: 'rgba(240,237,232,0.6)',
        ghost: 'rgba(240,237,232,0.3)',
      },
      // ── Thêm h-dvh, min-h-dvh cho dynamic viewport height ──
      height: {
        dvh: '100dvh',
      },
      minHeight: {
        dvh: '100dvh',
      },
      // top-14 = 56px = chiều cao navbar
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,200,66,0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(245,200,66,0)' },
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
        'ink-radial': 'radial-gradient(ellipse 80% 60% at 50% -10%, #1e1e38 0%, #08080f 70%)',
        'shimmer-gradient': 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
      },
    },
  },
  plugins: [],
}