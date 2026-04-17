/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          tertiary: '#1c2128',
          card: '#21262d',
          hover: '#2d333b',
        },
        border: {
          DEFAULT: '#30363d',
          subtle: '#21262d',
          accent: '#f0a500',
        },
        accent: {
          gold: '#f0a500',
          'gold-hover': '#d4920a',
          'gold-muted': '#f0a50020',
          green: '#3fb950',
          red: '#f85149',
          blue: '#58a6ff',
          orange: '#e3b341',
          purple: '#bc8cff',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#484f58',
          inverse: '#0d1117',
        },
        status: {
          pending: '#e3b341',
          in_progress: '#58a6ff',
          submitted: '#bc8cff',
          approved: '#3fb950',
          rejected: '#f85149',
          needs_revision: '#ffa657',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
      },
    },
  },
  plugins: [],
}
