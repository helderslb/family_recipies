/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      // Coastal blue theme (remapped from the original warm terracotta palette).
      // The original key names are kept so every existing component class still
      // resolves — only the values changed. Semantic mapping for reference:
      //   cream      → clear light-blue canvas
      //   oatmeal    → cool gray-blue borders / muted surfaces
      //   terracotta → primary accent (coastal blue)
      //   sage       → secondary accent (soft sky blue)
      //   warm       → muted steel navy (tertiary)
      //   ink        → deep navy text
      colors: {
        cream: {
          DEFAULT: '#DDEBF8',
          light: '#F5FAFE',
          dark: '#CBE0F1',
        },
        oatmeal: {
          DEFAULT: '#E7EDF3',
          light: '#F4F7FA',
          dark: '#D5DFE8',
        },
        terracotta: {
          DEFAULT: '#2D7BB8',
          light: '#D8E8F6',
          dark: '#1B4E78',
        },
        sage: {
          DEFAULT: '#6E9DC4',
          light: '#E2EEF7',
          dark: '#35628A',
        },
        warm: {
          DEFAULT: '#5B7186',
          light: '#C7D5E0',
        },
        ink: {
          DEFAULT: '#0E1B2C',
          light: '#33465C',
          lighter: '#6B7A8C',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(14, 27, 44, 0.04), 0 12px 28px -16px rgba(14, 27, 44, 0.16)',
        lift: '0 2px 4px rgba(14, 27, 44, 0.04), 0 28px 56px -24px rgba(14, 27, 44, 0.28)',
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
