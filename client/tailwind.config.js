/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#f6f7f9',
          raised: '#ffffff',
          sunken: '#eef0f4',
        },
        ink: {
          DEFAULT: '#1a1d23',
          secondary: '#4b5563',
          muted: '#6b7280',
          faint: '#9ca3af',
        },
        line: {
          DEFAULT: '#e2e5eb',
          strong: '#cdd2dc',
        },
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          muted: '#dbeafe',
        },
        status: {
          ok: '#15803d',
          okBg: '#f0fdf4',
          warn: '#b45309',
          warnBg: '#fffbeb',
          error: '#b91c1c',
          errorBg: '#fef2f2',
          neutral: '#475569',
          neutralBg: '#f1f5f9',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.04)',
      },
    },
  },
  plugins: [],
};
