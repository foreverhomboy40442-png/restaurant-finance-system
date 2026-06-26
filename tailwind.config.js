/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canton: {
          /** 極簡極乾淨的淺灰白背景 */
          bg: '#FAFAFA',
          /** 低調、沉穩的傳統粵式胭脂紅 */
          red: '#A62424',
          /** 沉穩炭灰，主文字與邊框 */
          dark: '#2C2C2C',
        },
      },
      fontFamily: {
        sans: [
          'PingFang TC',
          'Noto Sans TC',
          'Microsoft JhengHei',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        canton: '0 1px 3px rgba(44, 44, 44, 0.06)',
        'canton-md': '0 4px 24px rgba(44, 44, 44, 0.08)',
      },
    },
  },
  plugins: [],
};
