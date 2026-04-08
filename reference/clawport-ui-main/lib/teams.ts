import type { Agent } from "@/lib/types"

export interface Team {
  manager: Agent
  members: Agent[]
}

export function buildTeams(agents: Agent[]): { root: Agent | null; teams: Team[]; soloOps: Agent[] } {
  const root = agents.find((a) => a.reportsTo === null) ?? null
  if (!root) return { root: null, teams: [], soloOps: [] }

  const byId = new Map(agents.map((a) => [a.id, a]))
  const teamManagers: Agent[] = []
  const soloOps: Agent[] = []

  for (const rid of root.directReports) {
    const r = byId.get(rid)
    if (!r) continue
    if (r.directReports.length > 0) {
      teamManagers.push(r)
    } else {
      soloOps.push(r)
    }
  }

  const teams: Team[] = teamManagers.map((mgr) => {
    const members: Agent[] = []
    const visited = new Set<string>([mgr.id])
    const queue = [...mgr.directReports]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const a = byId.get(id)
      if (a) {
        members.push(a)
        queue.push(...a.directReports)
      }
    }
    return { manager: mgr, members }
  })

  return { root, teams, soloOps }
}
