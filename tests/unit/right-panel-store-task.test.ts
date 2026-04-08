/**
 * Tests for right panel store task type support
 * Phase 02-03: Task detail panel integration
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useRightPanelStore } from '@/stores/rightPanelStore';

describe('RightPanelStore - Task Type', () => {
  beforeEach(() => {
    // Reset store state
    useRightPanelStore.setState({
      open: false,
      type: null,
      agentId: null,
      taskId: null,
    });
  });

  it('should include task in RightPanelType', () => {
    const store = useRightPanelStore.getState();
    // Type check - this will fail at compile time if 'task' is not in RightPanelType
    store.openPanel('task', 'task-123');
    expect(store.type).toBeDefined();
  });

  it('should accept task type with taskId parameter', () => {
    const { openPanel } = useRightPanelStore.getState();
    openPanel('task', 'task-123');

    const state = useRightPanelStore.getState();
    expect(state.open).toBe(true);
    expect(state.type).toBe('task');
    expect(state.taskId).toBe('task-123');
  });

  it('should expose taskId field for task detail panel', () => {
    const state = useRightPanelStore.getState();
    expect(state).toHaveProperty('taskId');
    expect(state.taskId).toBeNull();
  });

  it('should reset taskId to null when closePanel is called', () => {
    const { openPanel, closePanel } = useRightPanelStore.getState();

    openPanel('task', 'task-456');
    expect(useRightPanelStore.getState().taskId).toBe('task-456');

    closePanel();
    expect(useRightPanelStore.getState().taskId).toBeNull();
    expect(useRightPanelStore.getState().open).toBe(false);
    expect(useRightPanelStore.getState().type).toBeNull();
  });

  it('should clear agentId when opening task panel', () => {
    const { openPanel } = useRightPanelStore.getState();

    openPanel('agent', 'agent-123');
    expect(useRightPanelStore.getState().agentId).toBe('agent-123');
    expect(useRightPanelStore.getState().taskId).toBeNull();

    openPanel('task', 'task-789');
    expect(useRightPanelStore.getState().taskId).toBe('task-789');
    expect(useRightPanelStore.getState().agentId).toBeNull();
  });

  it('should clear taskId when opening agent panel', () => {
    const { openPanel } = useRightPanelStore.getState();

    openPanel('task', 'task-999');
    expect(useRightPanelStore.getState().taskId).toBe('task-999');
    expect(useRightPanelStore.getState().agentId).toBeNull();

    openPanel('agent', 'agent-555');
    expect(useRightPanelStore.getState().agentId).toBe('agent-555');
    expect(useRightPanelStore.getState().taskId).toBeNull();
  });
});
