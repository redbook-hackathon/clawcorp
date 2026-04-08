// Semantic style objects for TypeScript components
// Use when CSS classes aren't practical (dynamic styles)

export const typography = {
  largeTitle: { fontSize: 'var(--text-large-title)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-tight)', lineHeight: 'var(--leading-tight)' },
  title1: { fontSize: 'var(--text-title1)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-tight)', lineHeight: 'var(--leading-tight)' },
  title2: { fontSize: 'var(--text-title2)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-normal)', lineHeight: 'var(--leading-snug)' },
  title3: { fontSize: 'var(--text-title3)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-normal)', lineHeight: 'var(--leading-snug)' },
  body: { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-normal)' },
  subheadline: { fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-normal)' },
  footnote: { fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-normal)' },
  caption1: { fontSize: 'var(--text-caption1)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-normal)' },
  caption2: { fontSize: 'var(--text-caption2)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-normal)' },
  sectionHeader: { fontSize: 'var(--text-caption2)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)' },
} as const

export const layout = {
  sidebarWidth: 220,
  detailPanelWidth: 360,
  chatSidebarWidth: 300,
  memorySidebarWidth: 260,
  maxContentWidth: 1200,
  headerHeight: 52,
} as const
