import type React from 'react'

export function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="summary-card" style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      transition: 'transform 150ms ease, box-shadow 150ms ease',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}
