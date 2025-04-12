/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/*.html',
  ],
  theme: {
    extend: {
      colors: {
        // Primary color palette
        primary: {
          DEFAULT: '#328E6E',
          light: '#40B08A',
          dark: '#2B7C60',
        },
        secondary: {
          DEFAULT: '#67AE6E',
          light: '#7AC282',
          dark: '#569B5D',
        },
        accent: {
          DEFAULT: '#90C67C',
          light: '#A3D491',
          dark: '#7DB46A',
        },
        surface: {
          DEFAULT: '#E1EEBC',
          light: '#EDF5D5',
          dark: '#D3E4A2',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
        },
        // Text colors
        text: {
          primary: '#1F2937',   // Gray-800
          secondary: '#4B5563', // Gray-600
          disabled: '#9CA3AF',  // Gray-400
          inverse: '#FFFFFF',   // White text on dark backgrounds
        },
        // Background utility colors
        background: {
          DEFAULT: '#FFFFFF',
          alt: '#F9FAFB',      // Gray-50
          subtle: '#F3F4F6',   // Gray-100
        },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      fontSize: {
        // Typography scale
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
        '5xl': ['3rem', { lineHeight: '1' }],            // 48px
        
        // Semantic typography sizes
        'heading-1': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'heading-2': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'heading-3': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'heading-4': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-5': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-6': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'body': ['1rem', { lineHeight: '1.5rem' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'caption': ['0.75rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        card: '0 2px 5px rgba(0, 0, 0, 0.08)',
        dropdown: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      spacing: {
        'xs': '0.25rem',    // 4px
        'sm': '0.5rem',     // 8px
        'md': '1rem',       // 16px
        'lg': '1.5rem',     // 24px
        'xl': '2rem',       // 32px
        '2xl': '2.5rem',    // 40px
      },
      borderRadius: {
        'sm': '0.25rem',    // 4px
        DEFAULT: '0.375rem', // 6px
        'md': '0.5rem',     // 8px
        'lg': '0.75rem',    // 12px
        'xl': '1rem',       // 16px
      },
    },
  },
  plugins: [],
}; 