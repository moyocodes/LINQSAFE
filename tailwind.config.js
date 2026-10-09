import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1200px' } },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        script: ['Allura', 'cursive'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      // Two kinds of colour:
      //  1. Theme tokens (CSS variables in src/styles.css). Profile themes (Midnight, Blush, Auto…) swap these,
      //     so they can't be fixed hex codes. Their light-theme values are noted beside each one.
      //  2. Brand palette: fixed hex codes, the same in every theme.
      // Every colour takes an opacity step: bg-primary/30, text-ink/60, border-maroon/20, from-rose/40 …
      colors: {
        // --- 1. theme tokens ---
        background: 'hsl(var(--background) / <alpha-value>)', // #F6F3EE warm paper
        foreground: 'hsl(var(--foreground) / <alpha-value>)', // #261F1C espresso ink
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' }, // #FCFAF8
        primary: { DEFAULT: 'hsl(var(--primary) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground) / <alpha-value>)' }, // #2F2723
        secondary: { DEFAULT: 'hsl(var(--secondary) / <alpha-value>)', foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)' },
        // Secondary text is the ink at reduced opacity (not a separate grey), so it sits right on every surface and theme.
        muted: { DEFAULT: 'hsl(var(--muted) / <alpha-value>)', foreground: 'hsl(var(--foreground) / 0.6)' }, // #EBE6E0
        accent: { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--accent-foreground) / <alpha-value>)' }, // #2B4FAF cobalt
        destructive: { DEFAULT: 'hsl(var(--destructive) / <alpha-value>)', foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)' },
        border: 'hsl(var(--border) / <alpha-value>)', // #D8D1CA
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',

        // --- 2. brand palette (fixed) ---
        ink: '#261F1C',      // espresso text / dark surfaces
        paper: '#F6F3EE',    // page background
        maroon: { DEFAULT: '#77313F', deep: '#5A2230', soft: '#A35A69' }, // secondary accent
        saffron: { DEFAULT: '#D99A2B', deep: '#B47A16', soft: '#F2D29A' }, // contrast pop: small highlights only
        night: { DEFAULT: '#170C15', plum: '#3A1C33' }, // the dark "workshop" section
        cobalt: { DEFAULT: '#2B4FAF', deep: '#1E3A85', soft: '#9DB2EA' }, // main accent
        rose: '#F2A07E',     // coral tint (key kept as 'rose')
        lilac: '#6CC3BA',    // teal tint (key kept as 'lilac')
        sand: '#E5D2BD',     // warm beige tint
        mist: '#93ACCF',     // blue tint
      },
      keyframes: { shimmer: { from: { transform: 'translateX(0) skewX(-12deg)' }, to: { transform: 'translateX(450%) skewX(-12deg)' } } },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [animate],
}
