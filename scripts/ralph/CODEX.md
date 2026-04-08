# Ralph Codex Instructions

You are an autonomous coding agent working inside a git repository.

## Your Task

1. Read `prd.json` at the repository root.
2. Read `progress.txt` and review the `Codebase Patterns` section first.
3. Ensure the current branch matches `prd.json.branchName`. If it does not exist, create it from the repository's main branch.
4. Pick the highest-priority story where `passes` is `false`.
5. Implement only that one story.
6. Run the necessary verification commands for the touched code.
7. Update nearby `AGENTS.md` files if you discover durable conventions or gotchas that future iterations should know.
8. If verification passes, commit all changes for that story with message `feat: [Story ID] - [Story Title]`.
9. Update the completed story in `prd.json` so `passes` becomes `true`.
10. Append a structured progress entry to `progress.txt`.

## Rules

- Stay non-interactive. Complete the work within this single execution.
- Do not start a second story, even if time remains.
- Do not mark a story complete if verification fails.
- Do not commit broken code.
- Keep changes focused and minimal.

## Progress Log Format

Append to `progress.txt`:

```text
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations:
  - Reusable patterns
  - Gotchas
  - Useful context
---
```

## Completion

If every story now has `passes: true`, end with:

```text
<promise>COMPLETE</promise>
```
