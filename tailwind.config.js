/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#050810',
          900: '#090D16',
          850: '#0D1220',
          800: '#111726',
          700: '#1A2236',
          600: '#243049',
          500: '#2E3D5C',
        },
        crimson: {
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        slate: {
          950: '#0F172A',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-crimson': 'glow-crimson 2s ease-in-out infinite',
        'glow-emerald': 'glow-emerald 2s ease-in-out infinite',
        'glow-cyan': 'glow-cyan 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'flicker': 'flicker 0.15s ease-in-out infinite',
        'radar-sweep': 'radar-sweep 3s linear infinite',
        'shockwave': 'shockwave 0.6s ease-out',
        'packet-flow': 'packet-flow 2s linear infinite',
      },
      keyframes: {
        'glow-crimson': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)' },
          '50%': { boxShadow: '0 0 16px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)' },
        },
        'glow-emerald': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16,185,129,0.5), 0 0 20px rgba(16,185,129,0.2)' },
          '50%': { boxShadow: '0 0 16px rgba(16,185,129,0.8), 0 0 40px rgba(16,185,129,0.4)' },
        },
        'glow-cyan': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(6,182,212,0.5), 0 0 20px rgba(6,182,212,0.2)' },
          '50%': { boxShadow: '0 0 16px rgba(6,182,212,0.8), 0 0 40px rgba(6,182,212,0.4)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shockwave': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'packet-flow': {
          '0%': { offsetDistance: '0%' },
          '100%': { offsetDistance: '100%' },
        },
      },
    },
  },
  plugins: [],
};
