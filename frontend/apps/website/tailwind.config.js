/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme: `night` names the page and its surfaces (warm paper to white), `bone` the ink on them.
        // The mark's forest green, the ember accent and the canvas's change colours, deep enough for light.
        night: { DEFAULT: '#FFFFFF', 900: '#F6F6F4', 800: '#FFFFFF', 700: '#FFFFFF', 600: '#FAFAF9' },
        ink: '#1F1C1A',
        forest: { DEFAULT: '#0B2419', 800: '#0F2E21', 700: '#163D2D' },
        bone: { DEFAULT: '#16130F', soft: '#3A3530', muted: '#6B655E', faint: '#9A938B' },
        ember: { DEFAULT: '#EB6115', 600: '#C9500C', 400: '#F27A35', 300: '#D2550E' },
        added: '#16A34A',
        removed: '#E5484D',
        edited: '#D99A06',
        done: '#1BA672',
        // Hairlines of the page grid
        line: 'rgba(23, 23, 23, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hero: ['clamp(2.5rem, 5.4vw, 4.375rem)', { lineHeight: '1.04', letterSpacing: '-0.038em' }],
        title: ['clamp(1.875rem, 3.4vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
      },
      maxWidth: { page: '78rem' },
      keyframes: {
        dash: { to: { strokeDashoffset: '-40' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        'spin-reverse': { to: { transform: 'rotate(-360deg)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        breathe: { '0%,100%': { opacity: '0.55', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.06)' } },
      },
      animation: {
        dash: 'dash 1.6s linear infinite',
        orbit: 'spin 48s linear infinite',
        'orbit-slow': 'spin 72s linear infinite',
        'counter-orbit': 'spin-reverse 48s linear infinite',
        'counter-orbit-slow': 'spin-reverse 72s linear infinite',
        shimmer: 'shimmer 6s linear infinite',
        blink: 'blink 1s step-end infinite',
        breathe: 'breathe 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
