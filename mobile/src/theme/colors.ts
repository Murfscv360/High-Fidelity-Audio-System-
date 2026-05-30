// Auralis design tokens — matches the web app palette + Tidal-inspired aesthetic.
export const T = {
  ink:     '#0E141B',
  deep:    '#11181F',
  panel:   '#1A2230',
  raised:  '#222A36',
  sidebar: '#0B1118',

  t1: '#F2F2F2',
  t2: '#9AA1AB',
  t3: '#6B7280',
  t4: '#3F4753',

  ac:  '#4db8ff',
  acd: 'rgba(77,184,255,0.12)',

  gold:  '#E8B33A',
  goldd: 'rgba(232,179,58,0.13)',

  green: '#3ecf7a',
  red:   '#ff5f72',

  b0: 'rgba(255,255,255,0.04)',
  b1: 'rgba(255,255,255,0.08)',
  b2: 'rgba(255,255,255,0.14)',
};

export const tracking = {
  tight: -0.4,
  normal: 0,
  wide: 1.2,
  wider: 2.2,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 32,
} as const;
