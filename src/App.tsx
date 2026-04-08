/**
 * Root Application Component
 * Handles routing and global providers
 */
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppToaster } from '@/components/ui/Toast';
import i18n from './i18n';
import { MainLayout } from './components/layout/MainLayout';
import { TooltipProvider } from '@/components/ui/tooltip';

// Route-level lazy imports — each page becomes its own chunk
const Chat = lazy(() => import('./pages/Chat').then((m) => ({ default: m.Chat })));
const Agents = lazy(() => import('./pages/Agents').then((m) => ({ default: m.Agents })));
const AgentDetail = lazy(() => import('./pages/AgentDetail').then((m) => ({ default: m.AgentDetail })));
const Channels = lazy(() => import('./pages/Channels').then((m) => ({ default: m.Channels })));
const Cron = lazy(() => import('./pages/Cron').then((m) => ({ default: m.Cron })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const TeamOverview = lazy(() => import('./pages/TeamOverview').then((m) => ({ default: m.TeamOverview })));
const TeamMap = lazy(() => import('./pages/TeamMap').then((m) => ({ default: m.TeamMap })));
const TaskKanban = lazy(() => import('./pages/TaskKanban').then((m) => ({ default: m.TaskKanban })));
const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })));
const Setup = lazy(() => import('./pages/Setup').then((m) => ({ default: m.Setup })));
const BroadcastChat = lazy(() => import('./pages/BroadcastChat').then((m) => ({ default: m.BroadcastChat })));
import { useSettingsStore } from './stores/settings';
import { useGatewayStore } from './stores/gateway';
import { wireGatewayNotifications } from './stores/notifications';
import { isBrowserPreviewMode } from './lib/browser-preview';


/**
 * Error Boundary to catch and display React rendering errors
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React Error Boundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#f87171',
          background: '#0f172a',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong</h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            background: '#1e293b',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const initSettings = useSettingsStore((state) => state.init);
  const theme = useSettingsStore((state) => state.theme);
  const accentColor = useSettingsStore((state) => state.accentColor);
  const language = useSettingsStore((state) => state.language);
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const initGateway = useGatewayStore((state) => state.init);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const browserPreviewMode = isBrowserPreviewMode();

  useEffect(() => {
    let active = true;
    const initApp = async () => {
      try {
        await initSettings();
      } catch (error) {
        console.error('Failed to initialize settings:', error);
      } finally {
        if (active) {
          setSettingsInitialized(true);
        }
      }
    };
    initApp();
    return () => {
      active = false;
    };
  }, [initSettings]);

  // Sync i18n language with persisted settings on mount
  useEffect(() => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // Initialize Gateway connection on mount
  useEffect(() => {
    const initGatewayConnection = async () => {
      try {
        await initGateway();
      } catch (error) {
        console.error('Failed to initialize gateway:', error);
      }
    };
    initGatewayConnection();
  }, [initGateway]);

  useEffect(() => {
    if (!settingsInitialized || browserPreviewMode) {
      return;
    }
    if (!setupComplete && !location.pathname.startsWith('/setup')) {
      navigate('/setup', { replace: true });
    }
  }, [browserPreviewMode, location.pathname, navigate, settingsInitialized, setupComplete]);

  // Listen for navigation events from main process
  useEffect(() => {
    const handleNavigate = (...args: unknown[]) => {
      const path = args[0];
      if (typeof path === 'string') {
        navigate(path);
      }
    };

    const unsubscribe = window.electron?.ipcRenderer?.on?.('navigate', handleNavigate);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate]);

  // Apply accent color CSS variables (--ac for hex, --ac-rgb for Tailwind opacity modifiers)
  useEffect(() => {
    const color = accentColor || '#007aff';
    document.documentElement.style.setProperty('--ac', color);
    // Parse hex to RGB channel format: "R G B"
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      document.documentElement.style.setProperty('--ac-rgb', `${r} ${g} ${b}`);
    }
  }, [accentColor]);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    return wireGatewayNotifications(useGatewayStore);
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={<div className="flex h-screen items-center justify-center gap-2 text-[13px] text-[#8e8e93]"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#8e8e93] border-t-transparent" />加载中...</div>}>
        <Routes>
          {/* Setup wizard (shown on first launch) */}
          <Route path="/setup/*" element={<Setup />} />

          {/* Main application routes */}
          <Route element={<MainLayout />}>
            <Route index element={<Chat />} />
            <Route path="models" element={<Navigate to="/settings?section=models-providers" replace />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:agentId" element={<AgentDetail />} />
            <Route path="channels" element={<Channels />} />
            <Route path="skills" element={<Navigate to="/settings?section=skills-mcp" replace />} />
            <Route path="cron" element={<Cron />} />
            <Route path="team-overview" element={<TeamOverview />} />
            <Route path="team-map/:teamId" element={<TeamMap />} />
            <Route path="team-map" element={<Navigate to="/team-overview" replace />} />
            <Route path="broadcast" element={<BroadcastChat />} />
            <Route path="kanban" element={<TaskKanban />} />
            <Route path="activity" element={<Activity />} />
            {/* /memory 已迁移至 Settings > 记忆与知识 */}
            <Route path="memory" element={<Navigate to="/settings?section=memory-knowledge" replace />} />
            <Route path="costs" element={<Navigate to="/settings?section=costs-usage" replace />} />
            <Route path="settings/*" element={<Settings />} />
          </Route>
        </Routes>
        </Suspense>

        {/* Global toast notifications */}
        <AppToaster />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
