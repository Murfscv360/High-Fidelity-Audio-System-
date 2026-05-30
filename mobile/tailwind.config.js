/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink:     '#0E141B',
        deep:    '#11181F',
        panel:   '#1A2230',
        raised:  '#222A36',
        sidebar: '#0B1118',

        t1: '#F2F2F2',
        t2: '#9AA1AB',
        t3: '#6B7280',
        t4: '#3F4753',

        ac: {
          DEFAULT: '#4db8ff',
          dim:     'rgba(77,184,255,0.12)',
          glow:    'rgba(77,184,255,0.25)',
        },
        gold: {
          DEFAULT: '#E8B33A',
          dim:     'rgba(232,179,58,0.13)',
        },
        ok:   '#3ecf7a',
        err:  '#ff5f72',

        b0: 'rgba(255,255,255,0.04)',
        b1: 'rgba(255,255,255,0.08)',
        b2: 'rgba(255,255,255,0.14)',
        b3: 'rgba(255,255,255,0.22)',
      },
      fontFamily: {
        sans: ['System'],
        mono: ['Menlo'],
      },
      borderRadius: {
        pill: '32px',
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight:   '-0.015em',
        eyebrow: '0.18em',
        brand:   '0.24em',
      },
    },
  },
  plugins: [],
};
