import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/stores/settings';

describe('settings store layout state', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      sidebarCollapsed: false,
      contextRailCollapsed: false,
    });
  });

  it('defaults context rail to expanded', () => {
    expect(useSettingsStore.getState().contextRailCollapsed).toBe(false);
  });

  it('updates context rail collapsed state via setter', () => {
    const { setContextRailCollapsed } = useSettingsStore.getState();

    setContextRailCollapsed(true);
    expect(useSettingsStore.getState().contextRailCollapsed).toBe(true);

    setContextRailCollapsed(false);
    expect(useSettingsStore.getState().contextRailCollapsed).toBe(false);
  });
});
