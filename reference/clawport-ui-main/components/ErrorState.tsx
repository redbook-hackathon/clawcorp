'use client'

import { RotateCcw } from 'lucide-react'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex items-center justify-center h-full"
      role="alert"
      style={{ background: 'var(--bg)' }}
    >
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 360 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--fill-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          margin: '0 auto 16px',
        }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-secondary)' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          Something went wrong
        </div>

        <p style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          margin: '0 0 20px',
        }}>
          {message}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="focus-ring btn-scale"
            style={{
              height: 40,
              padding: '0 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--fill-secondary)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms var(--ease-spring)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--fill-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--fill-secondary)';
            }}
          >
            <RotateCcw size={16} />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
