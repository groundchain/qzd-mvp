export const theme = {
  fonts: {
    sans: "'Inter', 'Helvetica Neue', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono:
      "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '2rem',
  },
  lineHeights: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.7,
  },
  spacing: {
    none: '0',
    '3xs': '0.125rem',
    '2xs': '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  radii: {
    sm: '6px',
    md: '12px',
    lg: '20px',
    pill: '999px',
  },
  shadows: {
    soft: '0 8px 20px rgba(15, 23, 42, 0.08)',
    lift: '0 16px 32px rgba(15, 23, 42, 0.12)',
  },
  colors: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    border: '#d7e0eb',
    borderStrong: '#94a3b8',
    text: '#0f172a',
    textMuted: '#475569',
    textInverse: '#ffffff',
    primary: '#6366f1',
    primaryStrong: '#4f46e5',
    primarySoft: '#eef2ff',
    info: '#0ea5e9',
    success: '#16a34a',
    warning: '#b45309',
    danger: '#dc2626',
    focus: '#312e81',
  },
  layout: {
    maxWidth: '1040px',
    contentGutter: 'clamp(1rem, 3vw, 2.5rem)',
    sectionGap: '2rem',
  },
  motion: {
    durations: {
      instant: '60ms',
      fast: '120ms',
      base: '180ms',
    },
    easing: {
      standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  },
} as const;

export type Theme = typeof theme;

type ThemeVarRecord = Record<string, string | number>;

function resolveThemeVars(): ThemeVarRecord {
  const vars: ThemeVarRecord = {
    '--font-family-base': theme.fonts.sans,
    '--font-family-mono': theme.fonts.mono,
    '--font-size-xs': theme.fontSizes.xs,
    '--font-size-sm': theme.fontSizes.sm,
    '--font-size-base': theme.fontSizes.base,
    '--font-size-lg': theme.fontSizes.lg,
    '--font-size-xl': theme.fontSizes.xl,
    '--font-size-2xl': theme.fontSizes['2xl'],
    '--line-height-tight': String(theme.lineHeights.tight),
    '--line-height-base': String(theme.lineHeights.base),
    '--line-height-relaxed': String(theme.lineHeights.relaxed),
    '--space-3xs': theme.spacing['3xs'],
    '--space-2xs': theme.spacing['2xs'],
    '--space-xs': theme.spacing.xs,
    '--space-sm': theme.spacing.sm,
    '--space-md': theme.spacing.md,
    '--space-lg': theme.spacing.lg,
    '--space-xl': theme.spacing.xl,
    '--space-2xl': theme.spacing['2xl'],
    '--radius-sm': theme.radii.sm,
    '--radius-md': theme.radii.md,
    '--radius-lg': theme.radii.lg,
    '--radius-pill': theme.radii.pill,
    '--shadow-soft': theme.shadows.soft,
    '--shadow-lift': theme.shadows.lift,
    '--color-background': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-surface-muted': theme.colors.surfaceMuted,
    '--color-border': theme.colors.border,
    '--color-border-strong': theme.colors.borderStrong,
    '--color-text': theme.colors.text,
    '--color-text-muted': theme.colors.textMuted,
    '--color-text-inverse': theme.colors.textInverse,
    '--color-primary': theme.colors.primary,
    '--color-primary-strong': theme.colors.primaryStrong,
    '--color-primary-soft': theme.colors.primarySoft,
    '--color-info': theme.colors.info,
    '--color-success': theme.colors.success,
    '--color-warning': theme.colors.warning,
    '--color-danger': theme.colors.danger,
    '--color-focus-ring': theme.colors.focus,
    '--layout-max-width': theme.layout.maxWidth,
    '--layout-content-gutter': theme.layout.contentGutter,
    '--layout-section-gap': theme.layout.sectionGap,
    '--motion-duration-instant': theme.motion.durations.instant,
    '--motion-duration-fast': theme.motion.durations.fast,
    '--motion-duration-base': theme.motion.durations.base,
    '--motion-easing-standard': theme.motion.easing.standard,
    '--motion-easing-entrance': theme.motion.easing.entrance,
  };
  return vars;
}

export function applyThemeVars(root: HTMLElement | null = document.documentElement): void {
  if (!root) {
    return;
  }
  const vars = resolveThemeVars();
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, String(value));
  }
}

export function themeVar(name: keyof ThemeVarRecord): string {
  return `var(${name})`;
}
