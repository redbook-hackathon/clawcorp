// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pipeline } from './cron-pipelines'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { existsSync, readFileSync } from 'fs'
import { loadPipelines } from './cron-pipelines.server'
import { getPipelinesForJob, getAllPipelineJobNames } from './cron-pipelines'

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)

const SAMPLE_PIPELINES: Pipeline[] = [
  {
    name: 'Test Pipeline',
    edges: [
      { from: 'job-a', to: 'job-b', artifact: 'data.json' },
      { from: 'job-b', to: 'job-c', artifact: 'output.txt' },
    ],
  },
  {
    name: 'Second Pipeline',
    edges: [
      { from: 'job-x', to: 'job-y', artifact: 'report.csv' },
    ],
  },
]

describe('loadPipelines', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  it('returns [] when WORKSPACE_PATH is not set', () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    expect(loadPipelines()).toEqual([])
  })

  it('returns [] when pipelines.json does not exist', () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    expect(loadPipelines()).toEqual([])
  })

  it('loads valid pipelines.json', () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify(SAMPLE_PIPELINES))
    expect(loadPipelines()).toEqual(SAMPLE_PIPELINES)
  })

  it('returns [] on invalid JSON', () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('not valid json{{{')
    expect(loadPipelines()).toEqual([])
  })
})

describe('getPipelinesForJob', () => {
  it('finds pipelines for a source job', () => {
    const result = getPipelinesForJob('job-a', SAMPLE_PIPELINES)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Pipeline')
  })

  it('finds pipelines for a target job', () => {
    const result = getPipelinesForJob('job-c', SAMPLE_PIPELINES)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Pipeline')
  })

  it('finds a job that appears in the middle of a pipeline', () => {
    const result = getPipelinesForJob('job-b', SAMPLE_PIPELINES)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Pipeline')
  })

  it('returns empty for unknown jobs', () => {
    expect(getPipelinesForJob('no-such-job', SAMPLE_PIPELINES)).toHaveLength(0)
  })

  it('returns empty when pipelines array is empty', () => {
    expect(getPipelinesForJob('job-a', [])).toHaveLength(0)
  })
})

describe('getAllPipelineJobNames', () => {
  it('returns all unique job names', () => {
    const names = getAllPipelineJobNames(SAMPLE_PIPELINES)
    expect(names).toEqual(new Set(['job-a', 'job-b', 'job-c', 'job-x', 'job-y']))
  })

  it('returns empty set for empty pipelines', () => {
    expect(getAllPipelineJobNames([])).toEqual(new Set())
  })
})
