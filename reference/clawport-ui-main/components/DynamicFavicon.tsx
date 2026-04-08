'use client'

import { useEffect } from 'react'
import { useSettings } from '@/app/settings-provider'

/**
 * Dynamically sets the browser tab favicon based on the current
 * portal logo settings (uploaded image or emoji).
 */
export function DynamicFavicon() {
  const { settings } = useSettings()

  useEffect(() => {
    const emoji = settings.portalEmoji ?? '\ud83e\udd9e'
    const icon = settings.portalIcon
    const accentColor = settings.accentColor
    const bgHidden = settings.iconBgHidden

    // Find or create the favicon link element
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    if (icon) {
      // Uploaded image — use directly as favicon
      link.href = icon
      link.type = 'image/jpeg'
      return
    }

    // Emoji — render to canvas
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!bgHidden) {
      // Draw colored background circle
      const color = accentColor ?? '#f5c518'
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw emoji centered
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${bgHidden ? 56 : 40}px serif`
    ctx.fillText(emoji, size / 2, size / 2 + 2)

    link.href = canvas.toDataURL('image/png')
    link.type = 'image/png'
  }, [settings.portalIcon, settings.portalEmoji, settings.accentColor, settings.iconBgHidden])

  return null
}
