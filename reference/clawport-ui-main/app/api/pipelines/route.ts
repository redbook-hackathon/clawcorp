import { NextResponse } from "next/server"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { loadPipelines } from "@/lib/cron-pipelines.server"

export async function GET() {
  return NextResponse.json(loadPipelines())
}

export async function POST(req: Request) {
  const workspacePath = process.env.WORKSPACE_PATH
  if (!workspacePath) {
    return NextResponse.json({ error: "WORKSPACE_PATH not set" }, { status: 500 })
  }

  const body = await req.json()

  // Validate: must be array
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Must be an array" }, { status: 400 })
  }

  // Validate each pipeline
  for (let i = 0; i < body.length; i++) {
    const p = body[i]
    if (typeof p.name !== "string" || !p.name.trim()) {
      return NextResponse.json({ error: `Pipeline ${i}: missing "name" string` }, { status: 400 })
    }
    if (!Array.isArray(p.edges)) {
      return NextResponse.json({ error: `Pipeline "${p.name}": missing "edges" array` }, { status: 400 })
    }
    for (let j = 0; j < p.edges.length; j++) {
      const e = p.edges[j]
      if (typeof e.from !== "string" || typeof e.to !== "string" || typeof e.artifact !== "string") {
        return NextResponse.json(
          { error: `Pipeline "${p.name}", edge ${j}: requires "from", "to", and "artifact" strings` },
          { status: 400 },
        )
      }
    }
  }

  // Ensure clawport/ dir exists
  const dir = join(workspacePath, "clawport")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Write pipelines.json
  writeFileSync(join(dir, "pipelines.json"), JSON.stringify(body, null, 2) + "\n", "utf-8")

  return NextResponse.json({ ok: true })
}
