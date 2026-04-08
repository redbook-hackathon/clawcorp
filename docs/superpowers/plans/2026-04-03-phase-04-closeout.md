# Phase 04 Closeout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile Team Map Phase 04 with the current codebase, patch two small UI-spec gaps, and backfill planning artifacts without falsely marking the phase complete.

**Architecture:** Use the existing Team Map implementation as the source of truth. Add only minimal production changes that are directly backed by failing tests, then update `.planning` so plans `04-01` to `04-03` are represented as complete while `04-04` remains open for the final manual checkpoint.

**Tech Stack:** React 19, Vite, Vitest, Electron route helpers, GSD planning artifacts

---

### Task 1: Patch the remaining Team Map UI-spec gaps

**Files:**
- Modify: `tests/unit/add-member-sheet.test.tsx`
- Modify: `tests/unit/team-map-page.test.tsx`
- Modify: `src/components/team-map/AddMemberSheet.tsx`
- Modify: `src/pages/TeamMap/index.tsx`

- [x] **Step 1: Write the failing tests**

Add tests for:
- empty-search reset in `AddMemberSheet`
- dedicated Team Map loading state

- [x] **Step 2: Run the failing tests**

Run:

```bash
pnpm test -- tests/unit/add-member-sheet.test.tsx tests/unit/team-map-page.test.tsx
```

Expected: failures for missing `Clear search` and missing loading state.

- [x] **Step 3: Implement the minimal production fixes**

Add:
- a `Clear search` action in the add-member empty state
- a dedicated `TeamMapLoadingState` with disabled primary CTA

- [x] **Step 4: Re-run the focused tests**

Run:

```bash
pnpm test -- tests/unit/add-member-sheet.test.tsx tests/unit/team-map-page.test.tsx
```

Expected: all tests pass.

### Task 2: Backfill Phase 04 planning artifacts

**Files:**
- Create: `.planning/phases/04-team-map-evolution/04-01-SUMMARY.md`
- Create: `.planning/phases/04-team-map-evolution/04-02-SUMMARY.md`
- Create: `.planning/phases/04-team-map-evolution/04-03-SUMMARY.md`
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`

- [ ] **Step 1: Keep the phase structure on four plans**

Update `ROADMAP.md` so Phase 04 lists:
- `04-01`
- `04-02`
- `04-03`
- `04-04`

Do not invent `04-05` without a corresponding plan file.

- [ ] **Step 2: Backfill summaries for completed work**

Create summaries for:
- `04-01` routing + team scope shell
- `04-02` member-management surfaces
- `04-03` memory/skills data wiring

- [ ] **Step 3: Preserve the unfinished checkpoint**

Leave `04-04` unsummarized because manual closeout verification is still pending.

- [ ] **Step 4: Update state**

Set `STATE.md` so Phase 04 remains the current focus with plans `01-03` represented as complete and `04-04` represented as the remaining closeout item.

### Task 3: Run the Phase 04 verification suite

**Files:**
- Verify only

- [ ] **Step 1: Run the focused Phase 04 verification**

Run:

```bash
pnpm test -- tests/unit/team-map-page.test.tsx tests/unit/team-map-selectors.test.ts tests/unit/add-member-sheet.test.tsx tests/unit/member-detail-sheet.test.tsx tests/unit/member-memory-tab.test.tsx tests/unit/member-skills-tab.test.tsx tests/unit/member-activity-tab.test.tsx tests/unit/chat-private-session.test.ts tests/unit/openclaw-agent-workspace-skills.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Record the remaining truth**

Document that:
- automated verification is in place
- manual Team Map closeout verification is still pending
- Phase 04 is close to complete but not fully closed
