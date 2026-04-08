'use client'

import { useEffect, useState } from 'react'
import type { ClaudeCodeUsage } from '@/lib/types'

function getUsageColor(pct: number): string {
  if (pct >= 80) return 'var(--system-red)'
  if (pct >= 50) return 'var(--system-orange)'
  return 'var(--system-green)'
}

function useCountdown(resetsAt: string | null): string {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!resetsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetsAt])

  if (!resetsAt) return '--'
  const diff = new Date(resetsAt).getTime() - now
  if (diff <= 0) return 'now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  const s = Math.floor((diff % 60_000) / 1000)
  return `${m}m ${s}s`
}

function fmtResetDay(resetsAt: string | null): string {
  if (!resetsAt) return '--'
  return `Resets ${new Date(resetsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
}

function UsageBar({ label, utilization, subtitle }: {
  label: string
  utilization: number
  subtitle: string
}) {
  const color = getUsageColor(utilization)
  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 2,
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(utilization)}%
        </span>
      </div>
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'var(--fill-tertiary)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(utilization, 100)}%`,
          borderRadius: 2,
          background: color,
          transition: 'width 600ms ease, background 300ms ease',
        }} />
      </div>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {subtitle}
      </div>
    </div>
  )
}

export function SidebarUsageWidget() {
  const [usage, setUsage] = useState<ClaudeCodeUsage | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/usage/stream')
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'usage' && parsed.data) setUsage(parsed.data)
      } catch { /* skip */ }
    }
    return () => es.close()
  }, [])

  const fiveHourCountdown = useCountdown(usage?.fiveHour.resetsAt ?? null)
  const weeklyReset = fmtResetDay(usage?.sevenDay.resetsAt ?? null)

  // Only show when we have real utilization data from the API
  if (!usage) return null
  if (usage.fiveHour.utilization === 0 && usage.sevenDay.utilization === 0) return null

  const critical = usage.fiveHour.utilization >= 80 || usage.sevenDay.utilization >= 80

  return (
    <div style={{ padding: '0 16px', marginBottom: 'var(--space-2)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        marginBottom: 'var(--space-2)',
        paddingLeft: '4px',
      }}>
        Claude Code
        {critical && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--system-red)',
            animation: 'pulse-red 1.5s ease-in-out infinite',
          }} />
        )}
      </div>
      <UsageBar
        label="5-Hour"
        utilization={usage.fiveHour.utilization}
        subtitle={`Resets in ${fiveHourCountdown}`}
      />
      <UsageBar
        label="Weekly"
        utilization={usage.sevenDay.utilization}
        subtitle={weeklyReset}
      />
    </div>
  )
}
