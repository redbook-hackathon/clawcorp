# Codex Ralph Design

## Summary

Adapt the Ralph autonomous iteration loop so it can drive `codex exec` instead of the upstream `amp` or `claude` CLIs. Deliver the adaptation in two places:

- a reusable global skill payload under `~/.codex/skills/ralph`
- runnable project-scoped scripts under `scripts/ralph/` in this repository

The design keeps Ralph's state model intact:

- `prd.json` remains the task source of truth
- `progress.txt` remains the append-only memory across iterations
- `archive/` remains the storage for previous feature runs
- `.last-branch` remains the branch change detector

Only the execution backend changes from `amp`/`claude` to `codex exec`.

## Goals

- Provide a Codex-native autonomous loop that can run one story per iteration until completion.
- Preserve the original Ralph workflow and artifact format so existing PRD generation still works.
- Make the Codex version reusable from the installed global `ralph` skill.
- Make the current repository immediately runnable with a checked-in Codex loop entrypoint.
- Support Windows users in PowerShell without forcing a separate PowerShell implementation of the loop logic.

## Non-Goals

- Do not replace Ralph's PRD format or story semantics.
- Do not introduce a Codex-specific planner format separate from `prd.json`.
- Do not change unrelated product code in this repository as part of the setup.
- Do not implement infinite looping as the default behavior.
- Do not attempt to support every upstream agent CLI; the new work targets Codex first.

## Chosen Approach

Implement a Codex backend alongside the upstream Ralph assets and make it the preferred path for Codex users.

### Why this approach

- It reuses Ralph's proven story loop, progress log, and archive behavior.
- It minimizes the diff from upstream concepts, making the system easier to inspect and debug.
- It gives the current repository a working command without hard-forking the entire upstream layout.
- It keeps the execution policy explicit by wrapping `codex exec` in a narrow, auditable shell loop.

## Alternatives Considered

### 1. Replace the global `ralph` skill only

This would make future installs easier, but the current repository would still need manual scaffolding before anything could run.

### 2. Patch only the current repository

This would be fastest for one repo, but the installed `ralph` skill would remain unable to scaffold Codex-compatible runtime files for the next project.

### 3. Reimplement Ralph entirely in PowerShell

This would improve Windows ergonomics, but it would duplicate the loop logic and drift farther from upstream. Bash remains the single source of truth. PowerShell should only be a thin launcher.

## Architecture

### Global skill layer

Update the installed `ralph` skill so it can scaffold Codex-specific runtime files in addition to the upstream reference assets.

Expected changes:

- update `~/.codex/skills/ralph/SKILL.md`
- add Codex runtime templates under the skill's `assets/`
- keep upstream assets as references for compatibility and provenance

### Repository runtime layer

Add project-scoped scripts under `scripts/ralph/`:

- `ralph-codex.sh`: main autonomous loop
- `ralph-codex.ps1`: PowerShell launcher that delegates to the Bash loop
- `CODEX.md`: per-iteration execution prompt for `codex exec`
- `prd.json.example`: local example copied from the skill assets

The repository runtime layer is what users execute directly from this project.

### State layer

Keep the project root state files:

- `prd.json`
- `progress.txt`
- `archive/`
- `.last-branch`

The loop script reads and updates these files at the repository root even though the loop script itself lives in `scripts/ralph/`.

## Command Design

### Primary command

The primary Bash command is:

```bash
bash ./scripts/ralph/ralph-codex.sh 999
```

The numeric argument is the max iteration count. The loop exits early as soon as Codex emits `<promise>COMPLETE</promise>`.

### Forever mode

Support an explicit opt-in mode:

```bash
bash ./scripts/ralph/ralph-codex.sh --forever
```

This mode exists for users who want the loop to keep going until the stop condition is reached. It is not the default because a broken prompt or verification command could otherwise run indefinitely.

### Windows launcher

Provide:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ralph\ralph-codex.ps1 999
```

The PowerShell file only forwards arguments into the Bash implementation. It should not duplicate branch handling, archive logic, or loop semantics.

## Codex Execution Contract

Each loop iteration calls:

```bash
codex exec --dangerously-bypass-approvals-and-sandbox -C "<repo-root>" "<prompt>"
```

### Rationale

- `codex exec` is the correct non-interactive interface.
- `-C` pins execution to the project root.
- `--dangerously-bypass-approvals-and-sandbox` matches the autonomous nature of Ralph and avoids interactive approvals inside the loop.

This contract assumes the user has already accepted the risk profile of a full-auto local coding agent.

## Prompt Design

The per-iteration prompt lives in `scripts/ralph/CODEX.md`.

### Responsibilities

Each iteration must:

1. Read `prd.json`
2. Read `progress.txt`, especially the `Codebase Patterns` section
3. Ensure the working branch matches `prd.json.branchName`
4. Select the highest-priority story where `passes` is `false`
5. Implement only that story
6. Run the required verification commands
7. Update nearby `AGENTS.md` files with durable learnings when appropriate
8. Commit the finished story
9. Set the completed story's `passes` field to `true`
10. Append a structured entry to `progress.txt`
11. Emit `<promise>COMPLETE</promise>` only when every story is marked complete

### Additional Codex-specific constraints

- The iteration must remain fully non-interactive.
- The iteration must not start work on a second story opportunistically.
- The iteration must not mark a story complete if validation fails.
- The iteration must not create a commit for broken code.

## Runtime Behavior

The Bash loop should preserve these Ralph behaviors:

- initialize `progress.txt` if missing
- archive prior run artifacts when the branch name changes
- keep a `.last-branch` marker
- print iteration boundaries clearly
- continue after a non-zero agent exit unless the completion marker is present

The loop should also add lightweight Codex-oriented guardrails:

- validate that `codex` is available on `PATH`
- fail fast with a clear message if `prd.json` is missing
- resolve the repository root relative to the script location

## Validation Plan

Validation happens at three levels:

### 1. Structure validation

Confirm the expected runtime files exist in both the skill assets and this repository's `scripts/ralph/`.

### 2. Script validation

Run lightweight command checks to ensure the Bash and PowerShell wrappers parse arguments and invoke the expected binary names without obvious syntax failures.

### 3. Dry-run validation

Use a minimal `prd.json` fixture and confirm:

- `codex exec` can be launched from the loop
- the prompt file is read correctly
- completion marker detection works
- non-complete iterations continue cleanly
- the PowerShell launcher delegates correctly to Bash

Dry-run validation should avoid modifying unrelated product code.

## Risks And Mitigations

### Risk: infinite or runaway execution

Mitigation:

- keep bounded iterations as the default
- require explicit `--forever`
- surface iteration counts and progress file locations clearly

### Risk: Codex prompt drift causes multi-story edits

Mitigation:

- constrain the iteration prompt tightly
- keep the story selection rule explicit and repeated in the prompt

### Risk: repository root confusion

Mitigation:

- compute the root from the script path
- use `codex exec -C <repo-root>`

### Risk: Windows environment friction

Mitigation:

- keep Bash as the canonical runtime
- provide a PowerShell launcher so Windows users can start the loop without hand-writing Bash commands

## Testing And Documentation Impact

This work changes developer workflow rather than shipped product behavior.

Documentation updates are still required in any place that explains local autonomous workflows or project automation setup. The minimum likely touch points are:

- `README.md`
- `README.zh-CN.md`
- `README.ja-JP.md`

Those updates should describe how to start the Codex loop and where the runtime files live if the implementation alters documented workflows.

## Implementation Outline

1. Update the global `ralph` skill assets and instructions for Codex scaffolding.
2. Add project runtime files under `scripts/ralph/`.
3. Add or update project documentation if workflow documentation changes.
4. Validate the scripts and a minimal dry-run path.

## Open Questions

- Whether to add a `package.json` script alias such as `pnpm run ralph:codex`.
- Whether to keep the upstream `ralph.sh` in the repository beside the new Codex version or only ship the Codex entrypoint.
- Whether the current repository should include a seed `prd.json.example` only, or also a local helper command for generating `prd.json` from the installed skill workflow.
