import { beforeEach, describe, expect, it } from 'vitest';
import { useRightPanelStore } from '@/stores/rightPanelStore';

describe('right panel store', () => {
  beforeEach(() => {
    useRightPanelStore.setState({ open: false, type: null, agentId: null });
  });

  it('opens a file panel with the active agent and resets on close', () => {
    useRightPanelStore.getState().openPanel('file', 'main');

    expect(useRightPanelStore.getState()).toMatchObject({
      open: true,
      type: 'file',
      agentId: 'main',
    });

    useRightPanelStore.getState().closePanel();

    expect(useRightPanelStore.getState()).toMatchObject({
      open: false,
      type: null,
      agentId: null,
    });
  });
});
