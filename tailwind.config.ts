import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Rose palette - based on #5c1521
        rose: {
          primary: '#5c1521',
          bright: '#7a2233',
          dark: '#3d0e16',
          soft: '#a85566',
          pale: '#f5e1e5',
          glow: 'rgba(92, 21, 33, 0.15)',
        },
        // Gold accent
        gold: {
          DEFAULT: '#C9A962',
          primary: '#C9A962',
          soft: '#E8DCC8',
          glow: 'rgba(201, 169, 98, 0.15)',
        },
        // Light mode - blush pink background
        light: {
          bg: '#f5e1e5',        // Blush pink (matches rose-pale)
          'bg-alt': '#f0d8dd',  // Slightly deeper blush for alternating sections
          card: '#FFFFFF',
          border: '#e8ccd2',
        },
        // Dark mode (from B)
        dark: {
          bg: '#0D0D0F',
          'bg-alt': '#1A1A1F',
          card: '#2A2A32',
          elevated: '#3D3D48',
          border: '#3D3D48',
        },
        // Text colors
        ink: '#3D3330',         // Warm charcoal for light mode
        pearl: '#FAFAFA',       // Light text for dark mode
        muted: '#8D7B74',       // Warm gray for secondary text
        ash: '#9898A0',         // Cool gray for dark mode secondary
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Raleway', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '20px',
        'full': '9999px',
      },
      boxShadow: {
        'card': '0 4px 25px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.1)',
        'nav': '0 4px 25px rgba(0, 0, 0, 0.08)',
        'rose': '0 4px 15px rgba(92, 21, 33, 0.3)',
        'rose-hover': '0 6px 20px rgba(92, 21, 33, 0.4)',
        'gold': '0 4px 15px rgba(201, 169, 98, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config
