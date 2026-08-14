import daisyui from 'daisyui'
import themes from 'daisyui/src/theming/themes'

const statusColors = {
  success: '#15803d',
  'success-content': '#f0fdf4',
  error: '#b91c1c',
  'error-content': '#fef2f2',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/options.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui, require('@tailwindcss/typography')],
  daisyui: {
    styled: true,
    themes: [
      { light: { ...themes.light, ...statusColors } },
      { dark: { ...themes.dark, ...statusColors } },
    ],
    base: true,
    utils: true,
    logs: true,
  },
}

