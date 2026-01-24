import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
        editor: ['AzarMehrMonospaced-San', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
