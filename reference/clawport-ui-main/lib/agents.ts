import { Agent } from '@/lib/types'
import { readFileSync, existsSync } from 'fs'
import { loadRegistry } from '@/lib/agents-registry'

export async function getAgents(): Promise<Agent[]> {
  const workspacePath = process.env.WORKSPACE_PATH || ''
  const registry = loadRegistry()

  return registry.map((entry) => {
    let soul: string | null = null
    if (entry.soulPath && workspacePath) {
      try {
        const fullPath = workspacePath + '/' + entry.soulPath
        if (existsSync(fullPath)) {
          soul = readFileSync(fullPath, 'utf-8')
        }
      } catch {
        soul = null
      }
    }
    return {
      ...entry,
      soul,
      crons: [],
    }
  })
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agents = await getAgents()
  return agents.find((a) => a.id === id) ?? null
}
