import daisyui from 'daisyui'
import themes from 'daisyui/src/theming/themes'

const lightStatusColors = {
  success: '#15803d',
  'success-content': '#f0fdf4',
  error: '#b91c1c',
  'error-content': '#fef2f2',
}

const darkStatusColors = {
  success: '#22c55e',
  'success-content': '#052e16',
  error: '#ef4444',
  'error-content': '#450a0a',
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
      { light: { ...themes.light, ...lightStatusColors } },
      { dark: { ...themes.dark, ...darkStatusColors } },
    ],
    base: true,
    utils: true,
    logs: true,
  },
}

