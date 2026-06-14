/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: '#090A0C',
        infil: '#FFB000',
        'infil-alt': '#42ea96',
        breach: '#FF3333',
        amber: '#FF9900',
        'text-main': '#FFFFFF',
        'text-alt': '#E0E0E0',
      },
      fontFamily: {
        // Sets all body text and code blocks to IBM Plex Mono
        sans: ['"IBM Plex Mono"', 'monospace'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        // Creates a special class for your main header
        orbitron: ['"Orbitron"', 'sans-serif'],
      },
      dropShadow: {
        'magi': 'url(#magi-glow)',
      },
      animation: {
        // Linear timing makes the "glitch" feel sharper and more technical
        'crt-flicker': 'flicker 3s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '3%': { opacity: '0.94' },   // Sharp drop
          '6%': { opacity: '1' },      // Instant recovery
          '13%': { opacity: '0.96' },
          '15%': { opacity: '1' },
          '45%': { opacity: '0.92' },  // Deepest spike
          '48%': { opacity: '1' },
          '70%': { opacity: '0.95' },
          '73%': { opacity: '1' },
        }
      }
    },
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '0',
    }
  },
  plugins: [],
}