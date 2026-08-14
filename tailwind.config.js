import daisyui from 'daisyui'
import themes from 'daisyui/src/theming/themes'

const lightStatusColors = {
  success: 'oklch(49.12% 0.16 150)',
  'success-content': 'oklch(89.82% 0.06 150)',
  error: 'oklch(49.12% 0.19 27)',
  'error-content': 'oklch(89.82% 0.04 27)',
}

const darkStatusColors = {
  success: 'oklch(65.69% 0.18 150)',
  'success-content': 'oklch(13.14% 0.04 150)',
  error: 'oklch(65.69% 0.2 27)',
  'error-content': 'oklch(13.14% 0.03 27)',
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

