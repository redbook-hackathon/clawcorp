/**
 * Pipeline types and client-safe utilities.
 * Server-only loader lives in cron-pipelines.server.ts.
 */

export interface PipelineEdge {
  from: string
  to: string
  artifact: string
}

export interface Pipeline {
  name: string
  edges: PipelineEdge[]
}

/** Get all pipelines that include a specific job name. */
export function getPipelinesForJob(name: string, pipelines: Pipeline[]): Pipeline[] {
  return pipelines.filter(p =>
    p.edges.some(e => e.from === name || e.to === name)
  )
}

/** Get the set of all job names that appear in any pipeline. */
export function getAllPipelineJobNames(pipelines: Pipeline[]): Set<string> {
  const names = new Set<string>()
  for (const p of pipelines) {
    for (const e of p.edges) {
      names.add(e.from)
      names.add(e.to)
    }
  }
  return names
}
