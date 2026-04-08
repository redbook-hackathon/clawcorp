'use client'

import type { CSSProperties } from 'react'
import type { Agent } from '@/lib/types'
import { useSettings } from '@/app/settings-provider'

interface AgentAvatarProps {
  agent: Agent
  size: number
  borderRadius?: number
  style?: CSSProperties
}

export function AgentAvatar({ agent, size, borderRadius, style }: AgentAvatarProps) {
  const { getAgentDisplay } = useSettings()
  const display = getAgentDisplay(agent)
  const radius = borderRadius ?? Math.round(size * 0.27)

  if (display.profileImage) {
    return (
      <img
        src={display.profileImage}
        alt={agent.name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: display.emojiOnly ? 'transparent' : `${agent.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.55),
        flexShrink: 0,
        ...style,
      }}
    >
      {display.emoji}
    </div>
  )
}
