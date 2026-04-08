import { describe, expect, it } from 'vitest';
import {
  createQuitLifecycleState,
  markQuitCleanupCompleted,
  requestQuitLifecycleAction,
} from '@electron/main/quit-lifecycle';

describe('quit lifecycle', () => {
  it('serializes quit cleanup into start -> in-progress -> allow', () => {
    const state = createQuitLifecycleState();

    expect(requestQuitLifecycleAction(state)).toBe('start-cleanup');
    expect(requestQuitLifecycleAction(state)).toBe('cleanup-in-progress');

    markQuitCleanupCompleted(state);
    expect(requestQuitLifecycleAction(state)).toBe('allow-quit');
  });

  it('allows quit immediately after cleanup is marked completed', () => {
    const state = createQuitLifecycleState();
    markQuitCleanupCompleted(state);

    expect(requestQuitLifecycleAction(state)).toBe('allow-quit');
  });
});
