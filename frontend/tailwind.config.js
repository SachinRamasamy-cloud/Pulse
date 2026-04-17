/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy background system
        base: {
          950: '#040810',
          900: '#070d1b',
          800: '#0c1425',
          700: '#111e33',
          600: '#172440',
          500: '#1d2e50',
          400: '#253761',
        },
        // Electric cyan-green — online/active
        neon: {
          DEFAULT: '#00e5a0',
          dim:     '#00b87d',
          glow:    'rgba(0,229,160,0.15)',
        },
        // Violet — Pro badge
        pro: {
          DEFAULT: '#7c3aed',
          light:   '#a78bfa',
          glow:    'rgba(124,58,237,0.2)',
        },
        // Status colors
        online:  '#22d3ee',
        offline: '#f87171',
        warn:    '#fb923c',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
        ui:   ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-sm': '0 0 8px rgba(0,229,160,0.3)',
        'neon-md': '0 0 20px rgba(0,229,160,0.25)',
        'pro-sm':  '0 0 8px rgba(124,58,237,0.4)',
        'card':    '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
        'slide-up':   'slideUp 0.35s ease-out',
        'fade-in':    'fadeIn 0.4s ease-out',
        'shimmer':    'shimmer 1.8s linear infinite',
        'scan':       'scan 2s linear infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.5', transform: 'scale(0.8)' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        scan: {
          '0%':   { top: '0%' },
          '100%': { top: '100%' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
    },
  },
  plugins: [],
};
