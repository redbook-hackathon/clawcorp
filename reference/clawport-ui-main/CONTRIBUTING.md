# Contributing to ClawPort

Thank you for your interest in contributing to ClawPort. Whether you are fixing a bug, improving documentation, or adding a feature, your help is welcome and appreciated.

This guide covers the conventions and process we follow so that contributions stay consistent and easy to review.

## Scope & Policy

Before opening a PR, please understand what ClawPort is and is not:

- **ClawPort is a UI layer.** It renders data from OpenClaw. It does not execute agents, manage cron jobs, or handle orchestration. Features that belong in the OpenClaw runtime should be contributed upstream at [openclaw.ai](https://openclaw.ai).
- **English-first.** All UI strings, error messages, log labels, and documentation must be in English. We do not accept localization or i18n PRs at this time.
- **No server-side string changes** without maintainer approval. Agent registry names, AI system prompts, and slash command text are carefully tuned -- changes need discussion first.

### What we will not merge

To save everyone time, here are PR types we will close without review:

- **Localization / i18n** -- adding translations, non-English strings, or internationalization infrastructure
- **Docs rewrites** -- wholesale restructuring of existing documentation (small fixes and additions are welcome)
- **Bundled scope creep** -- PRs that mix unrelated changes (e.g., a feature + a refactor + formatting fixes)
- **Server-side string changes** -- modifying agent names, AI prompts, or slash command text without prior discussion
- **Features that belong in OpenClaw** -- agent execution, gateway protocol changes, new CLI commands

See [docs/OPENCLAW.md](docs/OPENCLAW.md) for a detailed breakdown of what belongs in ClawPort vs OpenClaw.

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/clawport-ui.git
   cd clawport-ui
   ```

2. Install dependencies (Node 22+):
   ```bash
   npm install
   ```

3. Run the setup script to auto-detect your local OpenClaw installation and generate `.env.local`:
   ```bash
   npm run setup
   ```

4. Start the dev server (Turbopack, port 3000):
   ```bash
   npm run dev
   ```

## Code Style

ClawPort follows a small set of conventions that keep the codebase consistent. Please follow these when writing new code:

- **TypeScript strict mode.** No `any` escapes without a comment explaining why.
- **Tailwind CSS custom properties for theming.** Use `var(--text-primary)`, `var(--bg)`, etc. instead of Tailwind color utility classes like `text-gray-500`. Theme tokens are defined in `app/globals.css`.
- **No external charting or media libraries.** Use native Web APIs (Canvas, SVG, MediaRecorder, AudioContext) and custom components.
- **Base64 data URLs for persisted media.** Blob URLs do not survive page reloads. Always convert to base64 before storing.
- **Call `requireEnv()` inside functions, not at module top level.** Top-level calls crash imports during `next build` and test runs when env vars are absent. See `lib/env.ts` for the helper.

## Testing

All tests live alongside their source files: `lib/foo.ts` has `lib/foo.test.ts`.

Before opening a PR, make sure both of these pass:

```bash
npm test            # Vitest -- all tests must pass
npx tsc --noEmit    # Type-check -- zero errors expected
```

### Writing Tests

- Write tests for every new feature or bug fix.
- Use the patterns already established in the codebase:
  - `vi.mock('child_process')` for CLI-dependent code
  - `vi.stubEnv('VAR_NAME', 'value')` for environment variables
  - `vi.useFakeTimers({ shouldAdvanceTime: true })` for polling or time-dependent logic
- Keep tests focused. One behavior per test case.

## Pull Request Process

1. **Fork** the repo and create a feature branch from `main`:
   ```bash
   git checkout -b fix/agent-discovery-crash
   ```

2. **Make your changes.** Commit with clear messages (see below).

3. **Push** your branch and open a pull request against `main`.

4. In the PR description, explain **what** the change does and **why** it is needed. Link to a related issue if one exists.

5. A maintainer will review your PR. Be open to feedback -- we may suggest changes before merging.

## Commit Messages

Use imperative mood with a short subject line. A longer body is optional but welcome for non-trivial changes.

Examples from the project history:

```
Fix agent discovery: SOUL.md-driven scanning
Add CLI-based agent discovery
feat: auto-discover agents from OpenClaw workspace
```

Keep the subject under 72 characters. If you need to elaborate, leave a blank line after the subject and write a body paragraph.

## What Makes a Good PR

- **One concern per PR.** A bug fix, a feature, or a refactor -- not all three at once.
- **Tests included.** New behavior should have corresponding tests. Bug fixes should include a test that would have caught the bug.
- **No unrelated changes.** Resist the urge to fix formatting or rename variables in files you are not otherwise touching. Those are welcome as separate PRs.

## Before You Submit

The npm `prepublishOnly` hook runs `npx tsc --noEmit && vitest run`, so your code must pass both type-checking and the full test suite. Save yourself a round-trip by running these locally before pushing:

```bash
npx tsc --noEmit     # Zero type errors
npm test             # All 781 tests pass
npx next build       # Clean production build (optional but recommended)
```

## Contributor Credit

When we merge your PR, we add a `Co-Authored-By` trailer to the merge commit so GitHub attributes it to your profile. If you want to ensure your contribution shows up, include your GitHub no-reply email in the PR description:

```
Co-Authored-By: your-username <your-username@users.noreply.github.com>
```

## Architecture Overview

If you want to understand the codebase before diving in, these resources will help:

| Document | What it covers |
|----------|---------------|
| [CLAUDE.md](CLAUDE.md) | Full architecture guide: data flows, component map, conventions, common tasks |
| [docs/API.md](docs/API.md) | REST API reference for all endpoints |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI component catalog (50+ components) |
| [docs/THEMING.md](docs/THEMING.md) | Theme system, CSS custom properties, settings API |
| [docs/OPENCLAW.md](docs/OPENCLAW.md) | OpenClaw integration: gateway, CLI, ACP, scope boundaries |

Key conventions to know:

- **Inline styles with CSS custom properties** -- use `style={{ color: 'var(--text-primary)' }}` instead of Tailwind color classes.
- **No external charting libraries** -- all visualizations are custom SVG + Canvas.
- **Tests colocated with source** -- `lib/foo.ts` has `lib/foo.test.ts` in the same directory.
- **`requireEnv()` inside functions** -- never at module top level (see `lib/env.ts`).
- **No hardcoded operator names** -- use `operatorName` from the settings context.

## Reporting Bugs

Open a [GitHub Issue](https://github.com/JohnRiceML/clawport-ui/issues) with:

- A clear title describing the problem.
- Steps to reproduce (commands, configuration, browser/OS if relevant).
- Expected behavior vs. actual behavior.
- Relevant error messages, logs, or screenshots.

## Feature Requests

Open a [GitHub Issue](https://github.com/JohnRiceML/clawport-ui/issues) and describe:

- The problem you are trying to solve (not just the solution you have in mind).
- Why this matters for your workflow.
- Any alternatives you have considered.

Good feature requests focus on the "why" and leave room for the maintainers and community to collaborate on the "how."

## License

By contributing to ClawPort, you agree that your contributions will be licensed under the [MIT License](LICENSE).
