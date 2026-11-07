import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F6F3',
        panel: '#FFFFFF',
        stone: '#EFEFEB',
        ink: '#141413',
        muted: '#6E6D68',
        signal: {
          orange: '#FF4F00',
          green: '#10B981',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        sans: ['var(--font-plus-jakarta)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        nordic: '0 2px 16px -4px rgba(20, 20, 19, 0.05), 0 1px 3px 0 rgba(20, 20, 19, 0.03)',
        'nordic-lg':
          '0 12px 32px -8px rgba(20, 20, 19, 0.08), 0 2px 6px -1px rgba(20, 20, 19, 0.04)',
        'nordic-sm': '0 1px 2px 0 rgba(20, 20, 19, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
