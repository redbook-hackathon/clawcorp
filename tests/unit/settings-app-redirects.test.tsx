import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  settingsState,
  gatewayState,
} = vi.hoisted(() => ({
  settingsState: {
    init: vi.fn(async () => {}),
    theme: 'system',
    accentColor: '#007aff',
    language: 'en',
    setupComplete: true,
  },
  gatewayState: {
    init: vi.fn(async () => {}),
    status: { state: 'stopped', port: 18789 },
    subscribe: vi.fn(() => () => undefined),
  },
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: () => <Outlet />,
}));

vi.mock('@/pages/Setup', () => ({
  Setup: () => <div>Setup Wizard</div>,
}));

function SettingsRouteProbe() {
  const location = useLocation();
  return <div data-testid="settings-route">{location.pathname}{location.search}</div>;
}

vi.mock('@/pages/Settings', () => ({
  Settings: () => <SettingsRouteProbe />,
}));

vi.mock('@/pages/Chat', () => ({
  Chat: () => <div>Chat Page</div>,
}));

vi.mock('@/pages/Models', () => ({ Models: () => <div>Models</div> }));
vi.mock('@/pages/Agents', () => ({ Agents: () => <div>Agents</div> }));
vi.mock('@/pages/AgentDetail', () => ({ AgentDetail: () => <div>Agent Detail</div> }));
vi.mock('@/pages/Channels', () => ({ Channels: () => <div>Channels</div> }));
vi.mock('@/pages/Skills', () => ({ Skills: () => <div>Skills</div> }));
vi.mock('@/pages/Cron', () => ({ Cron: () => <div>Cron</div> }));
vi.mock('@/pages/TeamOverview', () => ({ TeamOverview: () => <div>Team Overview</div> }));
vi.mock('@/pages/TeamMap', () => ({ TeamMap: () => <div>Team Map</div> }));
vi.mock('@/pages/TaskKanban', () => ({ TaskKanban: () => <div>Kanban</div> }));
vi.mock('@/pages/Activity', () => ({ Activity: () => <div>Activity</div> }));
vi.mock('@/pages/Memory', () => ({ Memory: () => <div>Memory</div> }));
vi.mock('@/pages/Costs', () => ({ Costs: () => <div>Costs</div> }));
vi.mock('@/pages/BroadcastChat', () => ({ BroadcastChat: () => <div>Broadcast</div> }));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/notifications', () => ({
  wireGatewayNotifications: () => () => undefined,
}));

vi.mock('@/lib/browser-preview', () => ({
  isBrowserPreviewMode: () => false,
}));

describe('settings app redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.setupComplete = true;
  });

  it.each([
    ['/costs', '/settings?section=costs-usage'],
    ['/models', '/settings?section=models-providers'],
    ['/memory', '/settings?section=memory-knowledge'],
    ['/skills', '/settings?section=skills-mcp'],
  ] as const)('redirects %s into %s', async (entry, expected) => {
    const { default: App } = await import('@/App');

    render(
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-route')).toHaveTextContent(expected);
    });
  });
});
