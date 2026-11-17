/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAF7F1',
          light: '#FDFBF7',
          dark: '#F4EEE3',
        },
        oatmeal: {
          DEFAULT: '#F0E7D9',
          light: '#F7F1E7',
          dark: '#E3D5C1',
        },
        terracotta: {
          DEFAULT: '#C4694A',
          light: '#E8CFC2',
          dark: '#9C4C31',
        },
        sage: {
          DEFAULT: '#8FA37C',
          light: '#DEE6D5',
          dark: '#5C7049',
        },
        warm: {
          DEFAULT: '#8C5E3E',
          light: '#C8A78C',
        },
        ink: {
          DEFAULT: '#241F1A',
          light: '#544B41',
          lighter: '#8A7F74',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(36, 31, 26, 0.04), 0 12px 28px -16px rgba(36, 31, 26, 0.16)',
        lift: '0 2px 4px rgba(36, 31, 26, 0.04), 0 28px 56px -24px rgba(36, 31, 26, 0.28)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      letterSpacing: {
        wider: '0.09em',
        widest: '0.22em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
