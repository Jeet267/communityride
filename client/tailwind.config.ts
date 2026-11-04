import type { Config } from 'tailwindcss';

// Gushwork-inspired palette: cool grey canvas, white surfaces, black primary pill, one blue accent.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F1F2F4',
        surface: '#FFFFFF',
        line: '#E3E5E9',
        ink: '#0B0B0C',
        muted: '#5B6170',
        route: '#2F6BF0',
        ok: '#1E6B4E',
        warn: '#B4531A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '20px', field: '12px', frame: '28px' },
      maxWidth: { page: '1200px' },
      boxShadow: { frame: '0 30px 80px -30px rgba(15, 23, 42, 0.25)' },
    },
  },
  plugins: [],
} satisfies Config;
