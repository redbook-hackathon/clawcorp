# Codex Ralph Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex-native Ralph loop that can scaffold from the global skill and run inside this repository with testable Windows-friendly launchers.

**Architecture:** Keep Ralph's `prd.json` and `progress.txt` workflow, but move the loop core into a Node script so it is testable and cross-platform in this environment. Preserve thin `bash` and PowerShell launchers so the user-facing commands stay aligned with the approved design.

**Tech Stack:** Node.js, Vitest, PowerShell, Bash launcher scripts, Codex CLI

---

## Chunk 1: Test Harness And Runtime Skeleton

### Task 1: Add node-side test coverage for the Codex Ralph loop

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/unit/ralph-codex-runner.test.ts`

- [ ] **Step 1: Write the failing test**

Cover these behaviors with fixtures and child process stubs:
- fails fast when `prd.json` is missing
- initializes `progress.txt` when absent
- launches `codex exec` with the repository root and prompt contents
- exits early when Codex emits `<promise>COMPLETE</promise>`
- continues iterations when completion marker is absent
- supports `--forever`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project node tests/unit/ralph-codex-runner.test.ts`
Expected: FAIL because the runner module does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create a node runner module under `scripts/ralph/` with argument parsing and loop behavior sufficient to satisfy the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --project node tests/unit/ralph-codex-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/unit/ralph-codex-runner.test.ts scripts/ralph
git commit -m "feat: add codex ralph runner core"
```

### Task 2: Add launcher coverage

**Files:**
- Create: `tests/unit/ralph-codex-launchers.test.ts`
- Create: `scripts/ralph/ralph-codex.sh`
- Create: `scripts/ralph/ralph-codex.ps1`

- [ ] **Step 1: Write the failing test**

Add tests that verify:
- the PowerShell launcher delegates to the Node runner with forwarded arguments
- the Bash launcher delegates to the Node runner with forwarded arguments

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project node tests/unit/ralph-codex-launchers.test.ts`
Expected: FAIL because the launcher files do not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement thin wrappers that resolve the script directory and forward all arguments into the Node runner.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --project node tests/unit/ralph-codex-launchers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/ralph-codex-launchers.test.ts scripts/ralph/ralph-codex.sh scripts/ralph/ralph-codex.ps1
git commit -m "feat: add codex ralph launchers"
```

## Chunk 2: Prompt And Skill Assets

### Task 3: Add the Codex iteration prompt and local seed assets

**Files:**
- Create: `scripts/ralph/CODEX.md`
- Create: `scripts/ralph/prd.json.example`

- [ ] **Step 1: Write the failing test**

Extend the runner tests to assert that the prompt file is required and that its contents are passed into `codex exec`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project node tests/unit/ralph-codex-runner.test.ts`
Expected: FAIL until the prompt file and loader behavior are implemented

- [ ] **Step 3: Write minimal implementation**

Add the Codex prompt file and local `prd.json.example` seed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --project node tests/unit/ralph-codex-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ralph/CODEX.md scripts/ralph/prd.json.example tests/unit/ralph-codex-runner.test.ts
git commit -m "feat: add codex ralph prompt assets"
```

### Task 4: Upgrade the global `ralph` skill for Codex scaffolding

**Files:**
- Modify: `C:\Users\22688\.codex\skills\ralph\SKILL.md`
- Modify: `C:\Users\22688\.codex\skills\ralph\agents\openai.yaml`
- Create: `C:\Users\22688\.codex\skills\ralph\assets\codex\ralph-codex.mjs`
- Create: `C:\Users\22688\.codex\skills\ralph\assets\codex\ralph-codex.sh`
- Create: `C:\Users\22688\.codex\skills\ralph\assets\codex\ralph-codex.ps1`
- Create: `C:\Users\22688\.codex\skills\ralph\assets\codex\CODEX.md`
- Create: `C:\Users\22688\.codex\skills\ralph\assets\codex\prd.json.example`

- [ ] **Step 1: Write the failing test**

Use the existing skill validator as the first failing gate by updating the skill references in a way that expects the new asset paths to exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `python "C:\Users\22688\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\22688\.codex\skills\ralph"`
Expected: FAIL or remain incomplete until the new asset references are added consistently

- [ ] **Step 3: Write minimal implementation**

Add Codex asset files and update the skill instructions to scaffold them.

- [ ] **Step 4: Run test to verify it passes**

Run: `python "C:\Users\22688\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\22688\.codex\skills\ralph"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add C:\Users\22688\.codex\skills\ralph
git commit -m "feat: add codex ralph skill assets"
```

## Chunk 3: Docs And Final Verification

### Task 5: Document the Codex loop entrypoints

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`
- Modify: `package.json` (optional if adding `ralph:codex`)

- [ ] **Step 1: Write the failing test**

Write or extend a lightweight documentation check only if needed; otherwise treat the missing doc text as the failing requirement from the approved spec.

- [ ] **Step 2: Run test to verify it fails**

Re-read the design and confirm the Codex workflow is not yet documented.

- [ ] **Step 3: Write minimal implementation**

Add a short development section covering:
- required files
- PowerShell and Bash launch commands
- the `codex exec` backend

Add `pnpm run ralph:codex` only if it fits current script conventions cleanly.

- [ ] **Step 4: Run test to verify it passes**

Re-read the README files and confirm the new workflow is documented consistently.

- [ ] **Step 5: Commit**

```bash
git add README.md README.zh-CN.md README.ja-JP.md package.json
git commit -m "docs: add codex ralph workflow"
```

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run targeted tests**

Run:
- `pnpm test -- --project node tests/unit/ralph-codex-runner.test.ts`
- `pnpm test -- --project node tests/unit/ralph-codex-launchers.test.ts`

Expected: PASS

- [ ] **Step 2: Run broader checks for touched files**

Run:
- `pnpm run lint -- scripts/ralph tests/unit/ralph-codex-runner.test.ts tests/unit/ralph-codex-launchers.test.ts`
- `pnpm run typecheck`

Expected: PASS

- [ ] **Step 3: Run skill validation**

Run:
- `python "C:\Users\22688\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\22688\.codex\skills\ralph"`

Expected: PASS

- [ ] **Step 4: Summarize residual risk**

Document whether live end-to-end `codex exec` execution was validated or only dry-run validated.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add codex ralph workflow"
```
