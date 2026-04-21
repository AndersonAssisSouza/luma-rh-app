/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        luma: {
          purple:  '#9b66f4',
          purplel: '#b98af7',
          gold:    '#ffd000',
          goldd:   '#c8950a',
          dark1:   '#2a2535',
          dark2:   '#322d42',
          dark3:   '#3c3650',
          ink:     '#0f0f1a',
          ink2:    '#1a1a2e',
          ink3:    '#111122',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn .25s ease both',
        'slide-up':   'slideUp .3s cubic-bezier(.16,1,.3,1) both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: .6 } },
      }
    }
  },
  plugins: []
}
