# Phase 04 Closeout Design

**Date:** 2026-04-03
**Scope:** Team Map Evolution closeout and planning sync

## Goal

Bring Phase 04 back into a truthful, operable state by reconciling implementation with `.planning`, fixing a small set of clear UI-spec gaps, and preserving the final manual verification checkpoint as unfinished work.

## Current Reality

- The implementation already covers the Phase 04 route shell, member management surfaces, memory/skills editing, activity visibility, hover summaries, and private chat session wiring.
- `.planning` is behind the code. The phase directory still has no summaries, and `ROADMAP.md` drifted to a five-plan structure without a matching `04-05-PLAN.md`.
- The final Team Map closeout still needs a human verification checkpoint, so Phase 04 should not be represented as fully complete yet.

## Design Decision

Keep Phase 04 on the existing four-plan structure already present on disk.

Reasoning:

- The phase directory only contains `04-01` through `04-04`.
- Converting to five plans now would create more planning drift before the underlying artifacts exist.
- The safest closeout is to backfill plans `04-01` to `04-03`, leave `04-04` open for manual verification, and make `ROADMAP.md` and `STATE.md` reflect that truth.

## Closeout Rules

1. Treat the current codebase as the source of truth for completed engineering work.
2. Only patch implementation gaps that are clearly required by `04-UI-SPEC.md` and are small enough to verify immediately.
3. Do not mark the phase complete without the final manual verification checkpoint.
4. Sync planning artifacts to match reality:
   - `ROADMAP.md` uses four Phase 04 plans.
   - `04-01` to `04-03` get backfilled summaries.
   - `04-04` remains pending.
   - `STATE.md` reports Phase 04 as the current focus with only the closeout checkpoint left.

## Implementation Gaps Worth Fixing

- Add-member empty-search state needs a clear reset action.
- Team Map loading should show a dedicated loading state instead of falling through to the empty-team helper.

## Verification Strategy

- Write failing tests for each closeout gap first.
- Re-run focused Team Map tests after the implementation patch.
- Re-run the broader Phase 04 suite before claiming the phase is aligned.
- Record the remaining manual verification work in planning notes rather than pretending it is done.
