import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Play, Plus, RefreshCw, Server, Square, Trash2, Wrench } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'error';

interface McpToolDescriptor {
  server: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpServerLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'stderr';
  message: string;
}

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'http';
  url?: string;
  addedAt: string;
  status: RuntimeStatus;
  connected: boolean;
  toolCount: number;
  tools: McpToolDescriptor[];
  lastError: string | null;
  pid: number | null;
}

interface ToolState {
  selectedTool: string;
  argsText: string;
  running: boolean;
  result: string;
  error: string | null;
  logs: McpServerLogEntry[];
  logsLoading: boolean;
}

const STATUS_STYLES: Record<RuntimeStatus, string> = {
  stopped: 'bg-[#f3f4f6] text-[#4b5563]',
  starting: 'bg-[#fef3c7] text-[#b45309]',
  running: 'bg-[#dcfce7] text-[#15803d]',
  error: 'bg-[#fee2e2] text-[#b91c1c]',
};

const TRANSPORT_COLORS: Record<McpServer['transport'], string> = {
  stdio: 'bg-[#dbeafe] text-[#1d4ed8]',
  sse: 'bg-[#dcfce7] text-[#15803d]',
  http: 'bg-[#fef3c7] text-[#b45309]',
};

function makeToolState(server: McpServer): ToolState {
  return {
    selectedTool: server.tools[0]?.name ?? '',
    argsText: '{}',
    running: false,
    result: '',
    error: null,
    logs: [],
    logsLoading: false,
  };
}

function FormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: McpServer | null;
  onClose: () => void;
  onSave: (data: Partial<McpServer>) => Promise<void>;
}) {
  const { t } = useTranslation('skills');
  const [name, setName] = useState(initial?.name ?? '');
  const [transport, setTransport] = useState<McpServer['transport']>(initial?.transport ?? 'stdio');
  const [command, setCommand] = useState(initial?.command ?? '');
  const [argsRaw, setArgsRaw] = useState((initial?.args ?? []).join(' '));
  const [url, setUrl] = useState(initial?.url ?? '');
  const [envRaw, setEnvRaw] = useState(
    Object.entries(initial?.env ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setError(t('mcp.dialog.validation.nameRequired', { defaultValue: '名称不能为空' }));
      return;
    }
    if (transport === 'stdio' && !command.trim()) {
      setError(t('mcp.dialog.validation.commandRequired', { defaultValue: 'stdio 服务器必须填写命令' }));
      return;
    }
    if (transport !== 'stdio' && !url.trim()) {
      setError(t('mcp.dialog.validation.urlRequired', { defaultValue: '远程服务器必须填写 URL' }));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const env: Record<string, string> = {};
      for (const line of envRaw.split('\n')) {
        const separator = line.indexOf('=');
        if (separator <= 0) continue;
        env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      }
      await onSave({
        name: name.trim(),
        transport,
        command: command.trim(),
        args: argsRaw.trim() ? argsRaw.trim().split(/\s+/) : [],
        url: url.trim() || undefined,
        env,
        enabled: initial?.enabled ?? true,
      });
      onClose();
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[#111827]">
              {initial
                ? t('mcp.dialog.editTitle', { defaultValue: '编辑 MCP 服务' })
                : t('mcp.dialog.addTitle', { defaultValue: '添加 MCP 服务' })}
            </h3>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              {t('mcp.dialog.subtitle', { defaultValue: '配置 ClawCorp 可调用的本地或远程 MCP 服务连接参数。' })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-black/10 px-3 py-1 text-[12px] text-[#6b7280] hover:bg-[#f3f4f6]">
            {t('mcp.dialog.close', { defaultValue: '关闭' })}
          </button>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          {error && (
            <div className="md:col-span-2 flex items-center gap-2 rounded-2xl bg-[#fee2e2] px-4 py-3 text-[13px] text-[#b91c1c]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[#374151]">
              {t('mcp.dialog.fields.name', { defaultValue: '名称' })}
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={Boolean(initial)} className="w-full rounded-2xl border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb] disabled:bg-[#f3f4f6]" />
          </label>
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[#374151]">
              {t('mcp.dialog.fields.transport', { defaultValue: '传输方式' })}
            </span>
            <select value={transport} onChange={(e) => setTransport(e.target.value as McpServer['transport'])} className="w-full rounded-2xl border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]">
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
          </label>
          {transport === 'stdio' ? (
            <>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[12px] font-medium text-[#374151]">
                  {t('mcp.dialog.fields.command', { defaultValue: '命令' })}
                </span>
                <input value={command} onChange={(e) => setCommand(e.target.value)} className="w-full rounded-2xl border border-black/10 px-3 py-2 font-mono text-[13px] outline-none focus:border-[#2563eb]" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[12px] font-medium text-[#374151]">
                  {t('mcp.dialog.fields.args', { defaultValue: '参数' })}
                </span>
                <input value={argsRaw} onChange={(e) => setArgsRaw(e.target.value)} className="w-full rounded-2xl border border-black/10 px-3 py-2 font-mono text-[13px] outline-none focus:border-[#2563eb]" />
              </label>
            </>
          ) : (
            <label className="space-y-1 md:col-span-2">
              <span className="text-[12px] font-medium text-[#374151]">
                {t('mcp.dialog.fields.url', { defaultValue: 'URL' })}
              </span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-2xl border border-black/10 px-3 py-2 font-mono text-[13px] outline-none focus:border-[#2563eb]" />
            </label>
          )}
          <label className="space-y-1 md:col-span-2">
            <span className="text-[12px] font-medium text-[#374151]">
              {t('mcp.dialog.fields.env', { defaultValue: '环境变量' })}
            </span>
            <textarea value={envRaw} onChange={(e) => setEnvRaw(e.target.value)} rows={4} className="w-full rounded-2xl border border-black/10 px-3 py-2 font-mono text-[13px] outline-none focus:border-[#2563eb]" />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-black/5 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl border border-black/10 px-4 py-2 text-[13px] text-[#374151] hover:bg-[#f3f4f6]">
            {t('mcp.dialog.cancel', { defaultValue: '取消' })}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-2xl bg-[#2563eb] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50">
            {saving
              ? t('mcp.dialog.saving', { defaultValue: '保存中...' })
              : t('mcp.dialog.save', { defaultValue: '保存' })}
          </button>
        </div>
      </div>
    </div>
  );
}

export function McpTab() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>({});
  const { t } = useTranslation('skills');

  const syncToolState = useCallback((server: McpServer) => {
    setToolStates((current) => ({
      ...current,
      [server.name]: current[server.name]
        ? {
          ...current[server.name],
          selectedTool: server.tools.some((tool) => tool.name === current[server.name].selectedTool)
            ? current[server.name].selectedTool
            : (server.tools[0]?.name ?? ''),
        }
        : makeToolState(server),
    }));
  }, []);

  const replaceServer = useCallback((server: McpServer) => {
    setServers((current) => {
      const exists = current.some((item) => item.name === server.name);
      return exists
        ? current.map((item) => (item.name === server.name ? server : item))
        : [...current, server];
    });
    syncToolState(server);
  }, [syncToolState]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hostApiFetch<{ servers: McpServer[] }>('/api/mcp');
      const nextServers = response?.servers ?? [];
      setServers(nextServers);
      nextServers.forEach(syncToolState);
    } catch (loadError) {
      setError(String(loadError));
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [syncToolState]);

  useEffect(() => {
    void load();
  }, [load]);

  const invokeRuntimeAction = useCallback(async (server: McpServer, action: 'start' | 'connect' | 'stop') => {
    const response = await hostApiFetch<{ server: McpServer }>(`/api/mcp/${encodeURIComponent(server.name)}/${action}`, { method: 'POST' });
    if (response?.server) {
      replaceServer(response.server);
    }
  }, [replaceServer]);

  const toggleEnabled = useCallback(async (server: McpServer) => {
    const response = await hostApiFetch<{ enabled: boolean; server: McpServer }>(`/api/mcp/${encodeURIComponent(server.name)}/toggle`, { method: 'PATCH' });
    if (response?.server) {
      replaceServer(response.server);
    } else {
      replaceServer({ ...server, enabled: response.enabled });
    }
  }, [replaceServer]);

  const refreshTools = useCallback(async (server: McpServer) => {
    const response = await hostApiFetch<{ tools: McpToolDescriptor[] }>(`/api/mcp/${encodeURIComponent(server.name)}/tools`);
    replaceServer({ ...server, tools: response.tools ?? [], toolCount: response.tools?.length ?? 0 });
  }, [replaceServer]);

  const runTool = useCallback(async (server: McpServer) => {
    const state = toolStates[server.name] ?? makeToolState(server);
    const toolName = state.selectedTool || server.tools[0]?.name;
    if (!toolName) {
      setToolStates((current) => ({
        ...current,
        [server.name]: { ...state, error: t('mcp.states.selectTool', { defaultValue: '请先选择一个工具' }) },
      }));
      return;
    }
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = state.argsText.trim() ? JSON.parse(state.argsText) as Record<string, unknown> : {};
    } catch {
      setToolStates((current) => ({
        ...current,
        [server.name]: { ...state, error: t('mcp.states.invalidJson', { defaultValue: '工具参数必须是合法 JSON' }) },
      }));
      return;
    }
    setToolStates((current) => ({
      ...current,
      [server.name]: { ...state, running: true, error: null },
    }));
    try {
      const response = await hostApiFetch<{ content: Array<{ type: string; text?: string }>; isError: boolean }>(
        `/api/mcp/${encodeURIComponent(server.name)}/call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolName, arguments: parsedArgs }),
        },
      );
      const resultText = (response.content ?? []).map((item) => item.text ?? '').filter(Boolean).join('\n');
      setToolStates((current) => ({
        ...current,
        [server.name]: {
          ...current[server.name],
          running: false,
          error: response.isError ? t('mcp.states.toolCallError', { defaultValue: '工具调用返回错误' }) : null,
          result: resultText,
        },
      }));
    } catch (toolError) {
      setToolStates((current) => ({
        ...current,
        [server.name]: {
          ...current[server.name],
          running: false,
          error: String(toolError),
        },
      }));
    }
  }, [t, toolStates]);

  const loadLogs = useCallback(async (server: McpServer) => {
    const current = toolStates[server.name] ?? makeToolState(server);
    setToolStates((state) => ({
      ...state,
      [server.name]: { ...current, logsLoading: true, error: null },
    }));
    try {
      const response = await hostApiFetch<{ logs: McpServerLogEntry[] }>(`/api/mcp/${encodeURIComponent(server.name)}/logs?tail=50`);
      setToolStates((state) => ({
        ...state,
        [server.name]: { ...state[server.name], logsLoading: false, logs: response.logs ?? [] },
      }));
    } catch (logsError) {
      setToolStates((state) => ({
        ...state,
        [server.name]: { ...state[server.name], logsLoading: false, error: String(logsError) },
      }));
    }
  }, [toolStates]);

  const handleDelete = useCallback(async (server: McpServer) => {
    if (!window.confirm(t('mcp.actions.deleteConfirm', { defaultValue: `确认删除 MCP 服务「${server.name}」？` }))) return;
    await hostApiFetch(`/api/mcp/${encodeURIComponent(server.name)}`, { method: 'DELETE' });
    setServers((current) => current.filter((item) => item.name !== server.name));
  }, [t]);

  const handleSave = useCallback(async (server: Partial<McpServer>) => {
    const response = await hostApiFetch<{ server: McpServer }>('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    if (response?.server) {
      replaceServer(response.server);
      return;
    }
    await load();
  }, [load, replaceServer]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[#111827]">{t('mcp.title', 'MCP services')}</h2>
          <p className="text-[13px] text-[#8e8e93]">{t('mcp.description', 'Manage MCP services ClawCorp can call; enable a service to expose its tools along with runtime controls and logs.')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {t('mcp.actions.refresh', 'Refresh services')}
          </button>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1d4ed8]">
            <Plus className="h-3.5 w-3.5" />
            {t('mcp.actions.addService', 'Add service')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-[#8e8e93]">
          {t('mcp.states.loading', { defaultValue: '加载中...' })}
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Server className="h-12 w-12 text-[#c6c6c8]" />
          <p className="text-[14px] font-medium text-[#3c3c43]">{t('mcp.empty.title', 'No MCP services configured')}</p>
          <p className="text-[12px] text-[#8e8e93]">{t('mcp.empty.description', 'Add a service to expose its tools, runtime controls, and logs here.')}</p>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1d4ed8]">
            <Plus className="h-4 w-4" />
            {t('mcp.actions.addService', 'Add service')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const state = toolStates[server.name] ?? makeToolState(server);
            const action = server.status === 'running' ? 'stop' : (server.transport === 'stdio' ? 'start' : 'connect');
            const serverNameId = `mcp-server-name-${server.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const enabledLabel = server.enabled
              ? t('detail.enabled', 'Enabled')
              : t('detail.disabled', 'Disabled');
            return (
              <div key={server.name} className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col gap-4 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span id={serverNameId} className="text-[15px] font-semibold text-[#111827]">{server.name}</span>
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium uppercase', TRANSPORT_COLORS[server.transport])}>{server.transport}</span>
                        <span data-testid={`mcp-status-${server.name}`} className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium uppercase', STATUS_STYLES[server.status])}>
                          {t(`mcp.status.${server.status}`, { defaultValue: server.status })}
                        </span>
                        <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[10px] font-medium text-[#1d4ed8]">{server.toolCount} tool{server.toolCount === 1 ? '' : 's'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#6b7280]">
                        <span>{server.connected
                          ? t('mcp.states.connected', { defaultValue: 'connected' })
                          : t('mcp.states.disconnected', { defaultValue: 'disconnected' })}
                        </span>
                        {server.pid != null && <span>{t('mcp.states.pid', { defaultValue: `pid ${server.pid}`, pid: server.pid })}</span>}
                      </div>
                      <code className="mt-3 block rounded-2xl bg-[#f3f4f6] px-3 py-2 font-mono text-[12px] text-[#374151]">{server.transport === 'stdio' ? [server.command, ...server.args].join(' ') : (server.url ?? '')}</code>
                      {server.lastError && (
                        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {server.lastError}
                        </div>
                      )}
                    </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={server.enabled}
                            aria-labelledby={serverNameId}
                            aria-describedby={`${serverNameId}-toggle`}
                            onCheckedChange={() => void toggleEnabled(server)}
                          />
                          <span id={`${serverNameId}-toggle`} className="text-[12px] font-medium text-[#6b7280]">{enabledLabel}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" data-testid={`mcp-${action}-${server.name}`} onClick={() => void invokeRuntimeAction(server, action)} disabled={server.status === 'starting'} className={cn('inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50', action === 'stop' ? 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]' : 'bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#bfdbfe]')}>
                            {action === 'stop' ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {t(`mcp.actions.${action}`, { defaultValue: action })}
                          </button>
                          <button type="button" onClick={() => { setEditing(server); setFormOpen(true); }} className="rounded-2xl border border-black/10 px-3 py-2 text-[13px] text-[#374151] hover:bg-[#f3f4f6]">{t('mcp.actions.edit', 'Edit')}</button>
                          <button type="button" aria-label={t('mcp.actions.delete', { defaultValue: `删除 ${server.name}` })} onClick={() => void handleDelete(server)} className="rounded-2xl border border-[#fecaca] px-3 py-2 text-[13px] text-[#b91c1c] hover:bg-[#fef2f2]">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-black/5 bg-[#fafafa] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-[#111827]">{t('mcp.panels.toolsTitle', { defaultValue: 'Discovered tools' })}</p>
                          <p className="text-[12px] text-[#6b7280]">{t('mcp.panels.toolsDescription', { defaultValue: '查看工具可见性并做一次性调用调试。' })}</p>
                        </div>
                        <button type="button" onClick={() => void refreshTools(server)} className="rounded-2xl border border-black/10 px-3 py-2 text-[12px] text-[#374151] hover:bg-white">{t('mcp.actions.refreshTools', { defaultValue: 'refresh tools' })}</button>
                      </div>
                      {server.tools.length > 0 ? (
                        <>
                          <div className="mb-3 flex flex-wrap gap-2">
                            {server.tools.map((tool) => (
                              <span key={tool.name} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] text-[#374151]">
                                <Wrench className="h-3 w-3" />
                                {tool.name}
                              </span>
                            ))}
                          </div>
                          <div className="space-y-3 rounded-2xl bg-white p-3">
                            <label className="block space-y-1">
                              <span className="text-[12px] font-medium text-[#374151]">{t('mcp.fields.tool', { defaultValue: '工具' })}</span>
                              <select value={state.selectedTool} onChange={(e) => setToolStates((current) => ({ ...current, [server.name]: { ...state, selectedTool: e.target.value } }))} className="w-full rounded-2xl border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]">
                                {server.tools.map((tool) => (
                                  <option key={tool.name} value={tool.name}>{tool.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[12px] font-medium text-[#374151]">{t('mcp.fields.argsJson', { defaultValue: '参数 JSON' })}</span>
                              <textarea data-testid={`mcp-tool-args-${server.name}`} value={state.argsText} onChange={(e) => setToolStates((current) => ({ ...current, [server.name]: { ...state, argsText: e.target.value } }))} rows={4} className="w-full rounded-2xl border border-black/10 px-3 py-2 font-mono text-[12px] outline-none focus:border-[#2563eb]" />
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" data-testid={`mcp-call-${server.name}`} onClick={() => void runTool(server)} disabled={state.running} className="rounded-2xl bg-[#111827] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1f2937] disabled:opacity-50">
                                {state.running
                                  ? t('mcp.actions.runningTool', { defaultValue: 'running...' })
                                  : t('mcp.actions.runTool', { defaultValue: 'run tool' })}
                              </button>
                              {state.error && <span className="text-[12px] text-[#b91c1c]">{state.error}</span>}
                            </div>
                            {state.result && (
                              <pre className="overflow-x-auto rounded-2xl bg-[#111827] px-3 py-3 text-[12px] text-[#e5e7eb]">{state.result}</pre>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-[12px] text-[#6b7280]">{t('mcp.states.noTools', { defaultValue: '当前还没有发现工具。请先启动/连接 runtime，然后刷新 tools。' })}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-black/5 bg-[#fafafa] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-[#111827]">{t('mcp.panels.logsTitle', { defaultValue: 'Server logs' })}</p>
                          <p className="text-[12px] text-[#6b7280]">{t('mcp.panels.logsDescription', { defaultValue: '按 server 查看最近 runtime 事件和 stderr。' })}</p>
                        </div>
                        <button type="button" data-testid={`mcp-load-logs-${server.name}`} onClick={() => void loadLogs(server)} className="rounded-2xl border border-black/10 px-3 py-2 text-[12px] text-[#374151] hover:bg-white">
                          {state.logsLoading
                            ? t('mcp.actions.loadingLogs', { defaultValue: 'loading...' })
                            : t('mcp.actions.loadLogs', { defaultValue: 'load logs' })}
                        </button>
                      </div>
                      {state.logs.length > 0 ? (
                        <div className="space-y-2">
                          {state.logs.map((entry, index) => (
                            <div key={`${entry.timestamp}-${index}`} className="rounded-2xl bg-white px-3 py-2">
                              <div className="flex items-center justify-between gap-3 text-[11px] text-[#6b7280]">
                                <span>{entry.level}</span>
                                <span>{entry.timestamp}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[12px] text-[#111827]">{entry.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#6b7280]">{t('mcp.states.noLogs', { defaultValue: 'No logs loaded yet.' })}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {formOpen && (
        <FormModal
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
