// Design tokens of the web app's dark theme (apps/server/src/app/globals.css,
// shadcn "neutral" in .dark), converted from oklch to sRGB hex.
export const colors = {
  black: '#000000',
  background: '#0a0a0a', // oklch(0.145 0 0)
  foreground: '#fafafa', // oklch(0.985 0 0)
  card: '#171717', // oklch(0.205 0 0)
  secondary: '#262626', // oklch(0.269 0 0); also muted and accent
  accent: '#262626',
  mutedForeground: '#a1a1a1', // oklch(0.708 0 0)
  primary: '#e5e5e5', // oklch(0.922 0 0)
  primaryForeground: '#171717',
  border: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.06)', // border/60
  input: 'rgba(255,255,255,0.15)',
  ring: '#737373',
  destructive: '#ff6467', // oklch(0.704 0.191 22.216)
  newChapter: '#fe9a00', // chart-3, oklch(0.769 0.188 70.08)
  badge: '#155dfc', // blue-600, "Cap. N" on Continuar Lendo
  online: '#00c950', // green-500
  warning: '#f0b100', // yellow-500
  gray300: '#d1d5dc',
  gray400: '#99a1af',
  gray500: '#6a7282',
} as const;

// --radius is 0.625rem (10px); sm/md/lg/xl as in the web's @theme.
export const radius = { sm: 6, md: 8, lg: 10, xl: 14, '2xl': 16, full: 999 } as const;

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;
