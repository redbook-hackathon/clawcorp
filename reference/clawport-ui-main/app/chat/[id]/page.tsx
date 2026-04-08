'use client'
import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ChatRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  useEffect(() => { router.replace(`/chat?agent=${id}`) }, [id, router])
  return null
}
