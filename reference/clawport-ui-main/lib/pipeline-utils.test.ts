// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Agent, CronJob } from './types'
import type { Pipeline } from './cron-pipelines'
import {
  extractJobNameFromNodeId,
  computePipelineContext,
  buildCronContext,
  buildHealthCheckPrompt,
  buildPipelineLayout,
} from './pipeline-utils'

/* ─── Helpers ──────────────────────────────────────────────────── */

function makeCron(overrides: Partial<CronJob> & { name: string }): CronJob {
  return {
    id: overrides.name,
    schedule: '0 8 * * *',
    scheduleDescription: 'Daily at 8 AM',
    timezone: null,
    status: 'ok',
    lastRun: null,
    nextRun: null,
    lastError: null,
    agentId: null,
    description: null,
    enabled: true,
    delivery: null,
    lastDurationMs: null,
    consecutiveErrors: 0,
    lastDeliveryStatus: null,
    ...overrides,
  }
}

function makePipeline(name: string, edges: Pipeline['edges']): Pipeline {
  return { name, edges }
}

/* ─── extractJobNameFromNodeId ─────────────────────────────────── */

describe('extractJobNameFromNodeId', () => {
  it('extracts job name from "Pipeline::job-name"', () => {
    expect(extractJobNameFromNodeId('Pipeline::job-name')).toBe('job-name')
  })

  it('returns null for label nodes like "label-Pipeline"', () => {
    expect(extractJobNameFromNodeId('label-Pipeline')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractJobNameFromNodeId('')).toBeNull()
  })

  it('returns null for string with no separator', () => {
    expect(extractJobNameFromNodeId('no-separator')).toBeNull()
  })

  it('returns null for multiple separators (only 2-part split accepted)', () => {
    // "a::b::c" splits into ["a","b","c"] — length 3, not 2
    expect(extractJobNameFromNodeId('a::b::c')).toBeNull()
  })

  it('handles job name with special characters', () => {
    expect(extractJobNameFromNodeId('Pipeline::my-job_v2.1')).toBe('my-job_v2.1')
  })

  it('returns null if job name part is empty', () => {
    // "Pipeline::" splits into ["Pipeline", ""] — parts[1] is empty → null
    expect(extractJobNameFromNodeId('Pipeline::')).toBeNull()
  })

  it('handles pipeline name with spaces', () => {
    expect(extractJobNameFromNodeId('Daily Report::data-collector')).toBe('data-collector')
  })
})

/* ─── computePipelineContext ───────────────────────────────────── */

describe('computePipelineContext', () => {
  it('returns job as source only → outputs populated, inputs empty', () => {
    const pipelines = [makePipeline('p1', [{ from: 'job-a', to: 'job-b', artifact: 'data.json' }])]
    const result = computePipelineContext('job-a', pipelines)
    expect(result.inputs).toEqual([])
    expect(result.outputs).toEqual([{ pipeline: 'p1', to: 'job-b', artifact: 'data.json' }])
  })

  it('returns job as target only → inputs populated, outputs empty', () => {
    const pipelines = [makePipeline('p1', [{ from: 'job-a', to: 'job-b', artifact: 'data.json' }])]
    const result = computePipelineContext('job-b', pipelines)
    expect(result.inputs).toEqual([{ pipeline: 'p1', from: 'job-a', artifact: 'data.json' }])
    expect(result.outputs).toEqual([])
  })

  it('returns both inputs and outputs for a job in the middle', () => {
    const pipelines = [makePipeline('p1', [
      { from: 'job-a', to: 'job-b', artifact: 'raw.json' },
      { from: 'job-b', to: 'job-c', artifact: 'processed.json' },
    ])]
    const result = computePipelineContext('job-b', pipelines)
    expect(result.inputs).toHaveLength(1)
    expect(result.outputs).toHaveLength(1)
    expect(result.inputs[0].from).toBe('job-a')
    expect(result.outputs[0].to).toBe('job-c')
  })

  it('includes all instances when job appears in multiple pipelines', () => {
    const pipelines = [
      makePipeline('p1', [{ from: 'job-a', to: 'job-b', artifact: 'data1.json' }]),
      makePipeline('p2', [{ from: 'job-a', to: 'job-c', artifact: 'data2.json' }]),
    ]
    const result = computePipelineContext('job-a', pipelines)
    expect(result.outputs).toHaveLength(2)
    expect(result.outputs[0].pipeline).toBe('p1')
    expect(result.outputs[1].pipeline).toBe('p2')
  })

  it('returns empty arrays when job not in any pipeline', () => {
    const pipelines = [makePipeline('p1', [{ from: 'job-a', to: 'job-b', artifact: 'data.json' }])]
    const result = computePipelineContext('job-z', pipelines)
    expect(result.inputs).toEqual([])
    expect(result.outputs).toEqual([])
  })

  it('handles empty pipelines array', () => {
    const result = computePipelineContext('job-a', [])
    expect(result.inputs).toEqual([])
    expect(result.outputs).toEqual([])
  })

  it('handles pipeline with empty edges array', () => {
    const result = computePipelineContext('job-a', [makePipeline('p1', [])])
    expect(result.inputs).toEqual([])
    expect(result.outputs).toEqual([])
  })

  it('handles duplicate edges in same pipeline', () => {
    const pipelines = [makePipeline('p1', [
      { from: 'job-a', to: 'job-b', artifact: 'data.json' },
      { from: 'job-a', to: 'job-b', artifact: 'data.json' },
    ])]
    const result = computePipelineContext('job-a', pipelines)
    expect(result.outputs).toHaveLength(2)
  })

  it('counts self-loop edge as both input and output', () => {
    const pipelines = [makePipeline('p1', [{ from: 'job-a', to: 'job-a', artifact: 'loop.json' }])]
    const result = computePipelineContext('job-a', pipelines)
    expect(result.inputs).toHaveLength(1)
    expect(result.outputs).toHaveLength(1)
  })

  it('includes pipeline name in results', () => {
    const pipelines = [makePipeline('Daily Report', [{ from: 'a', to: 'b', artifact: 'x.json' }])]
    const result = computePipelineContext('a', pipelines)
    expect(result.outputs[0].pipeline).toBe('Daily Report')
  })
})

/* ─── buildCronContext ─────────────────────────────────────────── */

describe('buildCronContext', () => {
  const NOW = new Date('2025-03-01T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds context for full cron with all fields', () => {
    const cron = makeCron({
      name: 'report-builder',
      status: 'ok',
      lastRun: new Date(NOW - 3600000).toISOString(),
      nextRun: new Date(NOW + 1800000).toISOString(),
      lastDurationMs: 45000,
      lastError: null,
      consecutiveErrors: 0,
      delivery: { mode: 'push', channel: 'slack', to: '#reports' },
      lastDeliveryStatus: 'delivered',
    })
    const inputs = [{ from: 'data-collector', artifact: 'raw.json' }]
    const outputs = [{ to: 'notifier', artifact: 'report.pdf' }]
    const result = buildCronContext('report-builder', cron, inputs, outputs)

    expect(result).toContain('report-builder')
    expect(result).toContain('Status: ok')
    expect(result).toContain('Last run:')
    expect(result).toContain('Next run:')
    expect(result).toContain('Last duration: 45s')
    expect(result).toContain('Delivery: slack -> #reports')
    expect(result).toContain('Delivery status: delivered')
    expect(result).toContain('Pipeline inputs: raw.json from data-collector')
    expect(result).toContain('Pipeline outputs: report.pdf to notifier')
  })

  it('builds minimal context with null cron', () => {
    const result = buildCronContext('ghost-job', null, [], [])
    expect(result).toContain('ghost-job')
    expect(result).not.toContain('Status:')
    expect(result).toContain('Be concise and helpful.')
  })

  it('includes lastError when present', () => {
    const cron = makeCron({ name: 'failing', lastError: 'Connection timeout' })
    const result = buildCronContext('failing', cron, [], [])
    expect(result).toContain('Last error: Connection timeout')
  })

  it('includes MISSING TARGET when delivery has no target', () => {
    const cron = makeCron({
      name: 'bad-delivery',
      delivery: { mode: 'push', channel: 'email', to: null },
    })
    const result = buildCronContext('bad-delivery', cron, [], [])
    expect(result).toContain('Delivery: email -> MISSING TARGET')
  })

  it('omits pipeline lines when inputs/outputs are empty', () => {
    const cron = makeCron({ name: 'standalone' })
    const result = buildCronContext('standalone', cron, [], [])
    expect(result).not.toContain('Pipeline inputs:')
    expect(result).not.toContain('Pipeline outputs:')
  })

  it('lists multiple inputs and outputs', () => {
    const inputs = [
      { from: 'a', artifact: 'x.json' },
      { from: 'b', artifact: 'y.json' },
    ]
    const outputs = [
      { to: 'c', artifact: 'z.json' },
      { to: 'd', artifact: 'w.json' },
    ]
    const result = buildCronContext('hub', null, inputs, outputs)
    expect(result).toContain('x.json from a, y.json from b')
    expect(result).toContain('z.json to c, w.json to d')
  })

  it('omits consecutiveErrors when zero', () => {
    const cron = makeCron({ name: 'clean', consecutiveErrors: 0 })
    const result = buildCronContext('clean', cron, [], [])
    expect(result).not.toContain('Consecutive errors:')
  })

  it('includes consecutiveErrors when > 0', () => {
    const cron = makeCron({ name: 'flaky', consecutiveErrors: 3 })
    const result = buildCronContext('flaky', cron, [], [])
    expect(result).toContain('Consecutive errors: 3')
  })

  it('includes schedule with timezone', () => {
    const cron = makeCron({ name: 'tz-job', timezone: 'America/Chicago' })
    const result = buildCronContext('tz-job', cron, [], [])
    expect(result).toContain('(America/Chicago)')
  })

  it('uses schedule when scheduleDescription is empty', () => {
    const cron = makeCron({ name: 'raw', scheduleDescription: '', schedule: '0 8 * * *' })
    const result = buildCronContext('raw', cron, [], [])
    expect(result).toContain('Schedule: 0 8 * * *')
  })
})

/* ─── buildHealthCheckPrompt ───────────────────────────────────── */

describe('buildHealthCheckPrompt', () => {
  it('builds structured prompt with all sections', () => {
    const crons = [makeCron({ name: 'job-a', status: 'ok' })]
    const pipelines = [makePipeline('p1', [{ from: 'job-a', to: 'job-b', artifact: 'data.json' }])]
    const result = buildHealthCheckPrompt(crons, pipelines)

    expect(result).toContain('## Pipelines')
    expect(result).toContain('## Jobs')
    expect(result).toContain('Pipeline: p1')
    expect(result).toContain('job-a --[data.json]--> job-b')
    expect(result).toContain('Job: job-a')
  })

  it('shows "No jobs found" fallback for empty crons', () => {
    const result = buildHealthCheckPrompt([], [makePipeline('p1', [{ from: 'a', to: 'b', artifact: 'x' }])])
    expect(result).toContain('No jobs found')
  })

  it('shows "No pipelines configured" fallback for empty pipelines', () => {
    const result = buildHealthCheckPrompt([makeCron({ name: 'solo' })], [])
    expect(result).toContain('No pipelines configured')
  })

  it('handles both empty', () => {
    const result = buildHealthCheckPrompt([], [])
    expect(result).toContain('No pipelines configured')
    expect(result).toContain('No jobs found')
  })

  it('does not crash with cron having all null optional fields', () => {
    const cron = makeCron({
      name: 'minimal',
      lastRun: null,
      nextRun: null,
      lastError: null,
      delivery: null,
      lastDeliveryStatus: null,
      lastDurationMs: null,
    })
    const result = buildHealthCheckPrompt([cron], [])
    expect(result).toContain('Job: minimal')
    expect(result).not.toContain('Last run:')
    expect(result).not.toContain('Error:')
  })

  it('includes error info in job summary', () => {
    const cron = makeCron({ name: 'broken', status: 'error', lastError: 'OOM', consecutiveErrors: 5 })
    const result = buildHealthCheckPrompt([cron], [])
    expect(result).toContain('Error: OOM')
    expect(result).toContain('Consecutive errors: 5')
  })

  it('includes delivery info with missing target', () => {
    const cron = makeCron({
      name: 'notifier',
      delivery: { mode: 'push', channel: 'slack', to: null },
    })
    const result = buildHealthCheckPrompt([cron], [])
    expect(result).toContain('Delivery: slack -> MISSING TARGET')
  })

  it('produces valid string for large dataset (50+ crons)', () => {
    const crons = Array.from({ length: 55 }, (_, i) => makeCron({ name: `job-${i}` }))
    const pipelines = [makePipeline('big', [{ from: 'job-0', to: 'job-1', artifact: 'data.json' }])]
    const result = buildHealthCheckPrompt(crons, pipelines)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('Job: job-54')
  })

  it('shows agent owner name when agents provided', () => {
    const agents = [{ id: 'vera', name: 'VERA' }] as Agent[]
    const crons = [makeCron({ name: 'job-a', agentId: 'vera' })]
    const result = buildHealthCheckPrompt(crons, [], agents)
    expect(result).toContain('Owner: VERA')
  })

  it('flags UNOWNED jobs when agentId is null', () => {
    const agents = [{ id: 'vera', name: 'VERA' }] as Agent[]
    const crons = [makeCron({ name: 'orphan', agentId: null })]
    const result = buildHealthCheckPrompt(crons, [], agents)
    expect(result).toContain('Owner: UNOWNED')
  })

  it('flags UNOWNED when no agents list provided', () => {
    const crons = [makeCron({ name: 'solo' })]
    const result = buildHealthCheckPrompt(crons, [])
    expect(result).toContain('Owner: UNOWNED')
  })

  it('includes Agent Ownership in assessment sections', () => {
    const result = buildHealthCheckPrompt([], [])
    expect(result).toContain('Agent Ownership')
  })
})

/* ─── buildPipelineLayout ──────────────────────────────────────── */

describe('buildPipelineLayout', () => {
  const emptyColorMap = new Map<string, string>()

  it('builds linear chain (A→B→C) with correct depth columns', () => {
    const crons = [makeCron({ name: 'A' }), makeCron({ name: 'B' }), makeCron({ name: 'C' })]
    const pipelines = [makePipeline('chain', [
      { from: 'A', to: 'B', artifact: 'x' },
      { from: 'B', to: 'C', artifact: 'y' },
    ])]
    const { nodes, edges } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    // 1 label + 3 job nodes
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(2)

    const jobNodes = nodes.filter(n => n.type === 'cronPipelineNode')
    const nodeA = jobNodes.find(n => n.id === 'chain::A')!
    const nodeB = jobNodes.find(n => n.id === 'chain::B')!
    const nodeC = jobNodes.find(n => n.id === 'chain::C')!

    // A should be leftmost, C rightmost
    expect(nodeA.position.x).toBeLessThan(nodeB.position.x)
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x)
  })

  it('builds diamond dependency with correct depths', () => {
    const crons = ['A', 'B', 'C', 'D'].map(n => makeCron({ name: n }))
    const pipelines = [makePipeline('diamond', [
      { from: 'A', to: 'B', artifact: 'x' },
      { from: 'A', to: 'C', artifact: 'y' },
      { from: 'B', to: 'D', artifact: 'z' },
      { from: 'C', to: 'D', artifact: 'w' },
    ])]
    const { nodes, edges } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    expect(edges).toHaveLength(4)
    const jobNodes = nodes.filter(n => n.type === 'cronPipelineNode')
    expect(jobNodes).toHaveLength(4)

    const nodeA = jobNodes.find(n => n.id === 'diamond::A')!
    const nodeB = jobNodes.find(n => n.id === 'diamond::B')!
    const nodeD = jobNodes.find(n => n.id === 'diamond::D')!

    // A at depth 0, B/C at depth 1, D at depth 2
    expect(nodeA.position.x).toBeLessThan(nodeB.position.x)
    expect(nodeB.position.x).toBeLessThan(nodeD.position.x)
  })

  it('creates node with fallback data when job in edges but not in crons map', () => {
    const crons: CronJob[] = [] // no crons at all
    const pipelines = [makePipeline('orphan', [{ from: 'missing-a', to: 'missing-b', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const jobNodes = nodes.filter(n => n.type === 'cronPipelineNode')
    expect(jobNodes).toHaveLength(2)

    const nodeA = jobNodes.find(n => n.id === 'orphan::missing-a')!
    expect(nodeA.data.schedule).toBe('\u2014')
    expect(nodeA.data.status).toBe('idle')
    expect(nodeA.data.color).toBe('var(--text-secondary)')
  })

  it('uses default color when agentColorMap is empty', () => {
    const crons = [makeCron({ name: 'a', agentId: 'agent-1' })]
    const pipelines = [makePipeline('p', [{ from: 'a', to: 'b', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const node = nodes.find(n => n.id === 'p::a')!
    expect(node.data.color).toBe('var(--text-secondary)')
  })

  it('uses agent color from agentColorMap', () => {
    const crons = [makeCron({ name: 'a', agentId: 'agent-1' })]
    const pipelines = [makePipeline('p', [{ from: 'a', to: 'b', artifact: 'x' }])]
    const colorMap = new Map([['agent-1', '#ff0000']])
    const { nodes } = buildPipelineLayout(crons, pipelines, colorMap)

    const node = nodes.find(n => n.id === 'p::a')!
    expect(node.data.color).toBe('#ff0000')
  })

  it('marks selectedJob node as selected', () => {
    const crons = [makeCron({ name: 'a' }), makeCron({ name: 'b' })]
    const pipelines = [makePipeline('p', [{ from: 'a', to: 'b', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap, 'b')

    const nodeA = nodes.find(n => n.id === 'p::a')!
    const nodeB = nodes.find(n => n.id === 'p::b')!
    expect(nodeA.data.selected).toBe(false)
    expect(nodeB.data.selected).toBe(true)
  })

  it('no node selected when selectedJob is null', () => {
    const crons = [makeCron({ name: 'a' })]
    const pipelines = [makePipeline('p', [{ from: 'a', to: 'b', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap, null)

    const jobNodes = nodes.filter(n => n.type === 'cronPipelineNode')
    expect(jobNodes.every(n => n.data.selected === false)).toBe(true)
  })

  it('returns empty result for empty pipelines', () => {
    const { nodes, edges } = buildPipelineLayout([], [], emptyColorMap)
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('builds separate groups with Y offsets for multiple pipelines', () => {
    const crons = ['a', 'b', 'c', 'd'].map(n => makeCron({ name: n }))
    const pipelines = [
      makePipeline('p1', [{ from: 'a', to: 'b', artifact: 'x' }]),
      makePipeline('p2', [{ from: 'c', to: 'd', artifact: 'y' }]),
    ]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const label1 = nodes.find(n => n.id === 'label-p1')!
    const label2 = nodes.find(n => n.id === 'label-p2')!
    expect(label2.position.y).toBeGreaterThan(label1.position.y)
  })

  it('creates separate node IDs for same job name in different pipelines', () => {
    const crons = [makeCron({ name: 'shared' })]
    const pipelines = [
      makePipeline('p1', [{ from: 'shared', to: 'b', artifact: 'x' }]),
      makePipeline('p2', [{ from: 'shared', to: 'c', artifact: 'y' }]),
    ]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const sharedNodes = nodes.filter(n => (n.data as Record<string, unknown>).name === 'shared')
    expect(sharedNodes).toHaveLength(2)
    expect(sharedNodes[0].id).toBe('p1::shared')
    expect(sharedNodes[1].id).toBe('p2::shared')
  })

  it('follows pipelineName::jobName format for node IDs', () => {
    const crons = [makeCron({ name: 'worker' })]
    const pipelines = [makePipeline('Daily Report', [{ from: 'worker', to: 'sender', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const jobNodes = nodes.filter(n => n.type === 'cronPipelineNode')
    expect(jobNodes.some(n => n.id === 'Daily Report::worker')).toBe(true)
    expect(jobNodes.some(n => n.id === 'Daily Report::sender')).toBe(true)
  })

  it('generates unique edge IDs including index', () => {
    const crons = [makeCron({ name: 'a' }), makeCron({ name: 'b' })]
    const pipelines = [makePipeline('p', [
      { from: 'a', to: 'b', artifact: 'x' },
      { from: 'a', to: 'b', artifact: 'y' },
    ])]
    const { edges } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    expect(edges[0].id).toBe('p::a->p::b::0')
    expect(edges[1].id).toBe('p::a->p::b::1')
    expect(edges[0].id).not.toBe(edges[1].id)
  })

  it('label nodes are not selectable or draggable', () => {
    const crons = [makeCron({ name: 'a' })]
    const pipelines = [makePipeline('p', [{ from: 'a', to: 'b', artifact: 'x' }])]
    const { nodes } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    const label = nodes.find(n => n.id === 'label-p')!
    expect(label.selectable).toBe(false)
    expect(label.draggable).toBe(false)
  })

  it('creates only label node for pipeline with no edges', () => {
    const pipelines = [makePipeline('empty-pipeline', [])]
    const { nodes, edges } = buildPipelineLayout([], pipelines, emptyColorMap)

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('label-empty-pipeline')
    expect(edges).toHaveLength(0)
  })

  it('applies dashed stroke and red color for errored source nodes', () => {
    const crons = [makeCron({ name: 'broken', status: 'error' }), makeCron({ name: 'downstream' })]
    const pipelines = [makePipeline('p', [{ from: 'broken', to: 'downstream', artifact: 'x' }])]
    const { edges } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    expect(edges[0].style.stroke).toBe('#ef4444')
    expect(edges[0].style.strokeDasharray).toBe('6 4')
    expect(edges[0].animated).toBe(false)
  })

  it('applies normal style for OK source nodes', () => {
    const crons = [makeCron({ name: 'good', status: 'ok' }), makeCron({ name: 'next' })]
    const pipelines = [makePipeline('p', [{ from: 'good', to: 'next', artifact: 'x' }])]
    const { edges } = buildPipelineLayout(crons, pipelines, emptyColorMap)

    expect(edges[0].style.stroke).toBe('var(--accent, #6366f1)')
    expect(edges[0].animated).toBe(true)
  })
})
