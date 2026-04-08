// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildTeams, type Team } from './teams'
import type { Agent } from './types'

/** Helper to create a minimal agent */
function agent(overrides: Partial<Agent> & { id: string }): Agent {
  return {
    name: overrides.id.toUpperCase(),
    title: 'Agent',
    reportsTo: null,
    directReports: [],
    soulPath: null,
    soul: null,
    voiceId: null,
    color: '#000',
    emoji: 'A',
    tools: [],
    crons: [],
    model: null,
    memoryPath: null,
    description: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Basic team grouping
// ---------------------------------------------------------------------------

describe('buildTeams', () => {
  it('returns null root and empty arrays for empty input', () => {
    const result = buildTeams([])
    expect(result.root).toBeNull()
    expect(result.teams).toEqual([])
    expect(result.soloOps).toEqual([])
  })

  it('returns null root when no agent has reportsTo=null', () => {
    const agents = [
      agent({ id: 'a', reportsTo: 'b' }),
      agent({ id: 'b', reportsTo: 'a' }),
    ]
    const result = buildTeams(agents)
    expect(result.root).toBeNull()
  })

  it('identifies root agent (reportsTo=null)', () => {
    const agents = [
      agent({ id: 'root', reportsTo: null, directReports: [] }),
    ]
    const result = buildTeams(agents)
    expect(result.root).not.toBeNull()
    expect(result.root!.id).toBe('root')
    expect(result.teams).toEqual([])
    expect(result.soloOps).toEqual([])
  })

  it('classifies direct reports with children as team managers', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: ['worker'] }),
      agent({ id: 'worker', reportsTo: 'mgr' }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].manager.id).toBe('mgr')
    expect(result.teams[0].members).toHaveLength(1)
    expect(result.teams[0].members[0].id).toBe('worker')
    expect(result.soloOps).toHaveLength(0)
  })

  it('classifies direct reports without children as solo ops', () => {
    const agents = [
      agent({ id: 'root', directReports: ['solo1', 'solo2'] }),
      agent({ id: 'solo1', reportsTo: 'root' }),
      agent({ id: 'solo2', reportsTo: 'root' }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(0)
    expect(result.soloOps).toHaveLength(2)
    expect(result.soloOps.map(a => a.id)).toContain('solo1')
    expect(result.soloOps.map(a => a.id)).toContain('solo2')
  })

  it('separates managers from solo ops correctly', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr', 'solo'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: ['worker'] }),
      agent({ id: 'worker', reportsTo: 'mgr' }),
      agent({ id: 'solo', reportsTo: 'root' }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].manager.id).toBe('mgr')
    expect(result.soloOps).toHaveLength(1)
    expect(result.soloOps[0].id).toBe('solo')
  })
})

// ---------------------------------------------------------------------------
// Deep hierarchy traversal
// ---------------------------------------------------------------------------

describe('buildTeams — deep hierarchy', () => {
  it('collects all nested members via BFS', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: ['mid'] }),
      agent({ id: 'mid', reportsTo: 'mgr', directReports: ['leaf'] }),
      agent({ id: 'leaf', reportsTo: 'mid' }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    const members = result.teams[0].members.map(m => m.id)
    expect(members).toContain('mid')
    expect(members).toContain('leaf')
    expect(members).toHaveLength(2)
  })

  it('handles wide teams (manager with many direct members)', () => {
    const memberIds = Array.from({ length: 10 }, (_, i) => `m${i}`)
    const agents = [
      agent({ id: 'root', directReports: ['mgr'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: memberIds }),
      ...memberIds.map(id => agent({ id, reportsTo: 'mgr' })),
    ]
    const result = buildTeams(agents)
    expect(result.teams[0].members).toHaveLength(10)
  })

  it('handles multiple teams with nested members', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr-a', 'mgr-b'] }),
      agent({ id: 'mgr-a', reportsTo: 'root', directReports: ['a1', 'a2'] }),
      agent({ id: 'a1', reportsTo: 'mgr-a' }),
      agent({ id: 'a2', reportsTo: 'mgr-a' }),
      agent({ id: 'mgr-b', reportsTo: 'root', directReports: ['b1'] }),
      agent({ id: 'b1', reportsTo: 'mgr-b', directReports: ['b1-sub'] }),
      agent({ id: 'b1-sub', reportsTo: 'b1' }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(2)

    const teamA = result.teams.find(t => t.manager.id === 'mgr-a')!
    expect(teamA.members.map(m => m.id)).toEqual(['a1', 'a2'])

    const teamB = result.teams.find(t => t.manager.id === 'mgr-b')!
    expect(teamB.members.map(m => m.id)).toContain('b1')
    expect(teamB.members.map(m => m.id)).toContain('b1-sub')
  })
})

// ---------------------------------------------------------------------------
// Cycle protection
// ---------------------------------------------------------------------------

describe('buildTeams — cycle protection', () => {
  it('does not infinite loop on self-referencing agent', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: ['mgr'] }), // self-ref
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    // mgr references itself, but visited set prevents infinite loop
    // mgr is already the manager so it's in visited — members should be empty
    expect(result.teams[0].members).toHaveLength(0)
  })

  it('does not infinite loop on circular directReports', () => {
    const agents = [
      agent({ id: 'root', directReports: ['a'] }),
      agent({ id: 'a', reportsTo: 'root', directReports: ['b'] }),
      agent({ id: 'b', reportsTo: 'a', directReports: ['a'] }), // cycle back to a
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    const members = result.teams[0].members.map(m => m.id)
    expect(members).toContain('b')
    // 'a' should NOT appear as a member (it's the manager, and visited prevents re-add)
    expect(members).not.toContain('a')
  })

  it('handles mutual cycle between two agents', () => {
    const agents = [
      agent({ id: 'root', directReports: ['x'] }),
      agent({ id: 'x', reportsTo: 'root', directReports: ['y'] }),
      agent({ id: 'y', reportsTo: 'x', directReports: ['x'] }),
    ]
    // Should not throw or hang
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].members).toHaveLength(1)
    expect(result.teams[0].members[0].id).toBe('y')
  })

  it('handles longer cycle (a → b → c → a)', () => {
    const agents = [
      agent({ id: 'root', directReports: ['a'] }),
      agent({ id: 'a', reportsTo: 'root', directReports: ['b'] }),
      agent({ id: 'b', reportsTo: 'a', directReports: ['c'] }),
      agent({ id: 'c', reportsTo: 'b', directReports: ['a'] }),
    ]
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    const memberIds = result.teams[0].members.map(m => m.id)
    expect(memberIds).toContain('b')
    expect(memberIds).toContain('c')
    // 'a' is the manager, should not be in members even with cycle
    expect(memberIds).not.toContain('a')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildTeams — edge cases', () => {
  it('skips directReports that reference nonexistent agent IDs', () => {
    const agents = [
      agent({ id: 'root', directReports: ['real', 'ghost'] }),
      agent({ id: 'real', reportsTo: 'root' }),
      // 'ghost' does not exist in agents array
    ]
    const result = buildTeams(agents)
    expect(result.soloOps).toHaveLength(1)
    expect(result.soloOps[0].id).toBe('real')
    // ghost is silently skipped
  })

  it('manager with only nonexistent children is classified as solo op', () => {
    const agents = [
      agent({ id: 'root', directReports: ['mgr'] }),
      agent({ id: 'mgr', reportsTo: 'root', directReports: ['ghost1', 'ghost2'] }),
    ]
    // mgr has directReports.length > 0 so it's treated as a manager
    const result = buildTeams(agents)
    expect(result.teams).toHaveLength(1)
    // But the team has no real members (ghosts not found in byId map)
    expect(result.teams[0].members).toHaveLength(0)
  })

  it('root with no directReports results in empty teams and soloOps', () => {
    const agents = [agent({ id: 'root' })]
    const result = buildTeams(agents)
    expect(result.root!.id).toBe('root')
    expect(result.teams).toHaveLength(0)
    expect(result.soloOps).toHaveLength(0)
  })

  it('uses first agent with reportsTo=null when multiple roots exist', () => {
    const agents = [
      agent({ id: 'root1' }),
      agent({ id: 'root2' }),
    ]
    const result = buildTeams(agents)
    // Array.find returns the first match
    expect(result.root!.id).toBe('root1')
  })

  it('handles the full bundled agents.json structure', () => {
    // Simulate the real Jarvis org: root + 3 managers + 6 solo ops
    const agents = [
      agent({ id: 'jarvis', directReports: ['vera', 'lumen', 'herald', 'pulse', 'echo', 'sage'] }),
      agent({ id: 'vera', reportsTo: 'jarvis', directReports: ['robin'] }),
      agent({ id: 'robin', reportsTo: 'vera', directReports: ['trace', 'proof'] }),
      agent({ id: 'trace', reportsTo: 'robin' }),
      agent({ id: 'proof', reportsTo: 'robin' }),
      agent({ id: 'lumen', reportsTo: 'jarvis', directReports: ['scout', 'writer'] }),
      agent({ id: 'scout', reportsTo: 'lumen' }),
      agent({ id: 'writer', reportsTo: 'lumen' }),
      agent({ id: 'herald', reportsTo: 'jarvis', directReports: ['quill'] }),
      agent({ id: 'quill', reportsTo: 'herald' }),
      agent({ id: 'pulse', reportsTo: 'jarvis' }),
      agent({ id: 'echo', reportsTo: 'jarvis' }),
      agent({ id: 'sage', reportsTo: 'jarvis' }),
    ]
    const result = buildTeams(agents)

    expect(result.root!.id).toBe('jarvis')
    expect(result.teams).toHaveLength(3)
    expect(result.soloOps).toHaveLength(3)

    // Team VERA includes robin, trace, proof (nested)
    const teamVera = result.teams.find(t => t.manager.id === 'vera')!
    expect(teamVera.members.map(m => m.id)).toEqual(
      expect.arrayContaining(['robin', 'trace', 'proof']),
    )

    // Team LUMEN includes scout, writer
    const teamLumen = result.teams.find(t => t.manager.id === 'lumen')!
    expect(teamLumen.members.map(m => m.id)).toEqual(
      expect.arrayContaining(['scout', 'writer']),
    )

    // Team HERALD includes quill
    const teamHerald = result.teams.find(t => t.manager.id === 'herald')!
    expect(teamHerald.members.map(m => m.id)).toEqual(['quill'])

    // Solo ops
    expect(result.soloOps.map(a => a.id)).toEqual(
      expect.arrayContaining(['pulse', 'echo', 'sage']),
    )
  })
})
