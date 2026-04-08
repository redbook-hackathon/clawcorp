## What changed and why

<!-- Describe what this PR does and the motivation behind it. Link to a related issue if one exists (e.g., "Fixes #42"). -->

## Checklist

- [ ] **One concern per PR** -- this PR does one thing (bug fix, feature, refactor, docs) and does not bundle unrelated changes
- [ ] **Tests pass** -- `npm test` (all 781 tests green)
- [ ] **Type check clean** -- `npx tsc --noEmit` (zero errors)
- [ ] **Build succeeds** -- `npx next build` (no build errors)
- [ ] **English-only strings** -- no hardcoded non-English text in UI, logs, or error messages
- [ ] **No new dependencies** without prior discussion in an issue
- [ ] **No server-side string changes** (agent registry names, AI prompts, slash command text) without maintainer approval

## Scope check

ClawPort is the **UI layer** for OpenClaw. If your change touches orchestration, agent execution, or runtime behavior, it likely belongs in [OpenClaw](https://openclaw.ai) instead. See [CONTRIBUTING.md](../CONTRIBUTING.md) for scope boundaries.

## Screenshots / recordings (if applicable)

<!-- Paste screenshots or screen recordings for UI changes. Delete this section if not applicable. -->
