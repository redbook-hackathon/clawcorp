import type { IncomingMessage, ServerResponse } from 'http';
import { app } from 'electron';
import { existsSync, cpSync, mkdirSync, rmSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  cleanupDanglingWeChatPluginState,
  deleteChannelConfig,
  deleteChannelAccountConfig,
  getChannelFormValues,
  listConfiguredChannelAccounts,
  listConfiguredChannels,
  readOpenClawConfig,
  saveChannelConfig,
  setChannelDefaultAccount,
  setChannelEnabled,
  validateChannelConfig,
  validateChannelCredentials,
} from '../../utils/channel-config';
import {
  assignChannelAccountToAgent,
  assignChannelToAgent,
  clearAllBindingsForChannel,
  clearChannelBinding,
  listAgentsSnapshot,
  listConfiguredAgentIds,
} from '../../utils/agent-config';
import { logger } from '../../utils/logger';
import { whatsAppLoginManager } from '../../utils/whatsapp-login';
import { weChatLoginManager } from '../../utils/wechat-login';
import { createChannelConversationBindingStore, type ChannelConversationBindingRecord } from '../../services/channel-conversation-bindings';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getOpenClawConfigDir } from '../../utils/paths';
import { OPENCLAW_WECHAT_CHANNEL_TYPE, toOpenClawChannelType, toUiChannelType } from '../../utils/channel-alias';
import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { sendFeishuViaPreferredPath } from '../../utils/feishu-send-path';
import {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  normalizeDiscordMessagingTarget,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  normalizeTelegramMessagingTarget,
  normalizeWhatsAppMessagingTarget,
} from '../../utils/openclaw-sdk';

const CHANNEL_RATE_LIMITS = {
  test: { max: 2, windowMs: 30_000 },
  send: { max: 8, windowMs: 10_000 },
};

type RateLimitRule = { max: number; windowMs: number };
type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const channelActionRateBuckets = new Map<string, number[]>();

function checkChannelRateLimit(
  key: string,
  rule: RateLimitRule,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const existing = (channelActionRateBuckets.get(key) || []).filter((ts) => ts > windowStart);
  if (existing.length >= rule.max) {
    const retryAfterMs = Math.max(0, rule.windowMs - (now - existing[0]));
    channelActionRateBuckets.set(key, existing);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  existing.push(now);
  channelActionRateBuckets.set(key, existing);
  return { allowed: true };
}

function sendRateLimitError(res: ServerResponse, retryAfterSeconds: number): void {
  sendJson(res, 429, { success: false, error: 'Rate limit exceeded', retryAfterSeconds });
}

function scheduleGatewayChannelRestart(ctx: HostApiContext, reason: string): void {
  if (ctx.gatewayManager.getStatus().state === 'stopped') {
    return;
  }
  ctx.gatewayManager.debouncedRestart();
  void reason;
}

// Keep reload-first for feishu to avoid restart storms when channel auth/network is flaky.
// GatewayManager.reload() already falls back to restart when reload is unhealthy.
const FORCE_RESTART_CHANNELS = new Set(['dingtalk', 'wecom', 'whatsapp']);

function scheduleGatewayChannelSaveRefresh(
  ctx: HostApiContext,
  channelType: string,
  reason: string,
): void {
  if (ctx.gatewayManager.getStatus().state === 'stopped') {
    return;
  }
  if (FORCE_RESTART_CHANNELS.has(channelType)) {
    ctx.gatewayManager.debouncedRestart();
    void reason;
    return;
  }
  ctx.gatewayManager.debouncedReload();
  void reason;
}

// ── Generic plugin installer with version-aware upgrades ─────────

function readPluginVersion(pkgJsonPath: string): string | null {
  try {
    const raw = readFileSync(pkgJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function ensurePluginInstalled(
  pluginDirName: string,
  candidateSources: string[],
  pluginLabel: string,
): { installed: boolean; warning?: string } {
  const targetDir = join(homedir(), '.openclaw', 'extensions', pluginDirName);
  const targetManifest = join(targetDir, 'openclaw.plugin.json');
  const targetPkgJson = join(targetDir, 'package.json');

  const sourceDir = candidateSources.find((dir) => existsSync(join(dir, 'openclaw.plugin.json')));

  // If already installed, check whether an upgrade is available
  if (existsSync(targetManifest)) {
    if (!sourceDir) return { installed: true }; // no bundled source to compare, keep existing
    const installedVersion = readPluginVersion(targetPkgJson);
    const sourceVersion = readPluginVersion(join(sourceDir, 'package.json'));
    if (!sourceVersion || !installedVersion || sourceVersion === installedVersion) {
      return { installed: true }; // same version or unable to compare
    }
    // Version differs — fall through to overwrite install
    logger.info(
      `[plugin] Upgrading ${pluginLabel} plugin: ${installedVersion} → ${sourceVersion}`,
    );
  }

  // Fresh install or upgrade
  if (!sourceDir) {
    return {
      installed: false,
      warning: `Bundled ${pluginLabel} plugin mirror not found. Checked: ${candidateSources.join(' | ')}`,
    };
  }

  try {
    mkdirSync(join(homedir(), '.openclaw', 'extensions'), { recursive: true });
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true, dereference: true });
    if (!existsSync(join(targetDir, 'openclaw.plugin.json'))) {
      return { installed: false, warning: `Failed to install ${pluginLabel} plugin mirror (manifest missing).` };
    }
    // Patch bare ESM relative specifiers (e.g. './accounts' → './accounts.js') so
    // Node ESM can resolve them when "type":"module" is set in package.json.
    fixBareEsmSpecifiers(join(targetDir, 'src'));
    return { installed: true };
  } catch {
    return { installed: false, warning: `Failed to install bundled ${pluginLabel} plugin mirror` };
  }
}

// ── Per-channel plugin helpers (thin wrappers around ensurePluginInstalled) ──

function buildCandidateSources(pluginDirName: string): string[] {
  return app.isPackaged
    ? [
      join(process.resourcesPath, 'openclaw-plugins', pluginDirName),
      join(process.resourcesPath, 'app.asar.unpacked', 'build', 'openclaw-plugins', pluginDirName),
      join(process.resourcesPath, 'app.asar.unpacked', 'openclaw-plugins', pluginDirName),
    ]
    : [
      join(app.getAppPath(), 'build', 'openclaw-plugins', pluginDirName),
      join(process.cwd(), 'build', 'openclaw-plugins', pluginDirName),
      join(__dirname, '../../../build/openclaw-plugins', pluginDirName),
    ];
}

function ensureDingTalkPluginInstalled(): { installed: boolean; warning?: string } {
  return ensurePluginInstalled('dingtalk', buildCandidateSources('dingtalk'), 'DingTalk');
}

function ensureWeComPluginInstalled(): { installed: boolean; warning?: string } {
  return ensurePluginInstalled('wecom', buildCandidateSources('wecom'), 'WeCom');
}

function ensureFeishuPluginInstalled(): { installed: boolean; warning?: string } {
  return ensurePluginInstalled(
    'feishu-openclaw-plugin',
    buildCandidateSources('feishu-openclaw-plugin'),
    'Feishu',
  );
}

function ensureWeChatPluginInstalled(): { installed: boolean; warning?: string } {
  return ensurePluginInstalled('openclaw-weixin', buildCandidateSources('openclaw-weixin'), 'WeChat');
}

function ensureQQBotPluginInstalled(): { installed: boolean; warning?: string } {
  return ensurePluginInstalled('qqbot', buildCandidateSources('qqbot'), 'QQ Bot');
}

function toComparableConfig(input: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      next[key] = value.trim();
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      next[key] = String(value);
    }
  }
  return next;
}

function isSameConfigValues(
  existing: Record<string, string> | undefined,
  incoming: Record<string, unknown>,
): boolean {
  if (!existing) return false;
  const next = toComparableConfig(incoming);
  const keys = new Set([...Object.keys(existing), ...Object.keys(next)]);
  if (keys.size === 0) return false;
  for (const key of keys) {
    if ((existing[key] ?? '') !== (next[key] ?? '')) {
      return false;
    }
  }
  return true;
}

function inferAgentIdFromAccountId(accountId: string): string {
  if (accountId === 'default') return 'main';
  return accountId;
}

async function ensureScopedChannelBinding(channelType: string, accountId?: string): Promise<void> {
  // Multi-agent safety: only bind when the caller explicitly scopes the account.
  // Global channel saves (no accountId) must not override routing to "main".
  if (!accountId) return;
  await assignChannelToAgent(inferAgentIdFromAccountId(accountId), channelType).catch(() => undefined);
}

async function ensureKnownScopedAccountId(accountId?: string): Promise<boolean> {
  if (!accountId || accountId === 'default') return true;
  const agentIds = await listConfiguredAgentIds().catch(() => []);
  return agentIds.includes(accountId);
}

type NormalizedChannelStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
type NormalizedChannelAction = 'connect' | 'disconnect' | 'test' | 'send' | 'configure';

type ChannelsStatusSnapshot = {
  channels?: Record<string, { running?: boolean; error?: string; lastError?: string; configured?: boolean }>;
  channelAccounts?: Record<string, Array<{
    accountId?: string;
    configured?: boolean;
    connected?: boolean;
    running?: boolean;
    linked?: boolean;
    lastError?: string;
    name?: string;
    lastConnectedAt?: number | null;
    lastInboundAt?: number | null;
    lastOutboundAt?: number | null;
  }>>;
  channelDefaultAccountId?: Record<string, string>;
};

type WorkbenchSession = {
  id: string;
  channelId: string;
  channelType: string;
  sessionType: 'group' | 'private';
  title: string;
  pinned: boolean;
  syncState: 'synced' | 'connecting' | 'error' | 'disconnected';
  latestActivityAt?: string;
  previewText?: string;
  participantSummary?: string;
  visibleAgentId?: string;
};

type WorkbenchConversationView = {
  id: string;
  title: string;
  syncState: string;
  participantSummary?: string;
  visibleAgentId?: string;
};

type WorkbenchConversationMessage = {
  id: string;
  role: 'human' | 'agent' | 'tool' | 'system';
  authorName?: string;
  createdAt?: string;
  content?: string;
  toolName?: string;
  durationMs?: number;
  summary?: string;
  internal?: boolean;
  /** True when the message was sent by the workbench user (right-aligned bubble) */
  isSelf?: boolean;
};

const FEISHU_PLUGIN_ROOT = join(homedir(), '.openclaw', 'extensions', 'feishu-openclaw-plugin');
const WECHAT_PLUGIN_ROOT = join(homedir(), '.openclaw', 'extensions', 'openclaw-weixin');
const channelConversationBindings = createChannelConversationBindingStore();
const TEST_FEISHU_SNAPSHOT_KEY = '__clawcorpTestFeishuWorkbenchSnapshot';
const TEST_DERIVED_WORKBENCH_RECORDS_KEY = '__clawcorpTestDerivedWorkbenchRecords';

type FeishuConversationIdParts = {
  accountId: string;
  externalConversationId: string;
};

type WeChatConversationIdParts = {
  accountId: string;
  externalConversationId: string;
};

type WorkbenchConversationTarget = {
  channelType: string;
  accountId: string;
  externalConversationId: string;
};

type NormalizedChannelCapability = {
  channelId: string;
  channelType: string;
  accountId?: string;
  status: NormalizedChannelStatus;
  availableActions: NormalizedChannelAction[];
  capabilityFlags: {
    supportsConnect: boolean;
    supportsDisconnect: boolean;
    supportsTest: boolean;
    supportsSend: boolean;
    supportsSchemaSummary: boolean;
    supportsCredentialValidation: boolean;
  };
  configSchemaSummary: {
    totalFieldCount: number;
    requiredFieldCount: number;
    optionalFieldCount: number;
    sensitiveFieldCount: number;
    fieldKeys: string[];
  };
};

type ChannelAccountView = {
  accountId: string;
  name: string;
  configured: boolean;
  connected: boolean;
  running: boolean;
  linked: boolean;
  lastError?: string;
  status: NormalizedChannelStatus;
  isDefault: boolean;
  agentId?: string;
};

type ChannelAccountsView = {
  channelType: string;
  defaultAccountId: string;
  status: NormalizedChannelStatus;
  accounts: ChannelAccountView[];
};

type ChannelTargetOptionView = {
  value: string;
  label: string;
  kind: 'user' | 'group' | 'channel';
};

const CHANNEL_SCHEMA_SUMMARY_HINTS: Record<string, { required: string[]; optional: string[]; sensitive: string[] }> = {
  feishu: { required: ['appId', 'appSecret'], optional: [], sensitive: ['appSecret'] },
  dingtalk: {
    required: ['clientId', 'clientSecret'],
    optional: ['robotCode', 'corpId', 'agentId'],
    sensitive: ['clientSecret'],
  },
  wecom: { required: ['botId', 'secret'], optional: [], sensitive: ['secret'] },
  qqbot: { required: ['appId', 'clientSecret'], optional: [], sensitive: ['clientSecret'] },
};

const CREDENTIAL_VALIDATION_CHANNELS = new Set(['discord', 'telegram']);

function summarizeSchema(channelType: string): NormalizedChannelCapability['configSchemaSummary'] {
  const hint = CHANNEL_SCHEMA_SUMMARY_HINTS[channelType];
  if (!hint) {
    return {
      totalFieldCount: 0,
      requiredFieldCount: 0,
      optionalFieldCount: 0,
      sensitiveFieldCount: 0,
      fieldKeys: [],
    };
  }
  const fieldKeys = [...hint.required, ...hint.optional];
  return {
    totalFieldCount: fieldKeys.length,
    requiredFieldCount: hint.required.length,
    optionalFieldCount: hint.optional.length,
    sensitiveFieldCount: hint.sensitive.length,
    fieldKeys,
  };
}

function resolveNormalizedStatus(
  summary: { running?: boolean; error?: string; lastError?: string } | undefined,
  account:
    | {
      connected?: boolean;
      linked?: boolean;
      running?: boolean;
      lastError?: string;
    }
    | undefined,
): NormalizedChannelStatus {
  if (account?.connected === true || account?.linked === true) {
    return 'connected';
  }
  if (
    (typeof account?.lastError === 'string' && account.lastError.trim())
    || (typeof summary?.error === 'string' && summary.error.trim())
    || (typeof summary?.lastError === 'string' && summary.lastError.trim())
  ) {
    return 'error';
  }
  if (account?.running === true || summary?.running === true) {
    return 'connecting';
  }
  return 'disconnected';
}

function getAvailableActions(status: NormalizedChannelStatus): NormalizedChannelAction[] {
  if (status === 'connected') {
    return ['disconnect', 'test', 'send', 'configure'];
  }
  return ['connect', 'test', 'send', 'configure'];
}

function buildCapability(
  channelType: string,
  accountId: string | undefined,
  status: NormalizedChannelStatus,
): NormalizedChannelCapability {
  const availableActions = getAvailableActions(status);
  return {
    channelId: `${channelType}-${accountId || 'default'}`,
    channelType,
    accountId,
    status,
    availableActions,
    capabilityFlags: {
      supportsConnect: true,
      supportsDisconnect: true,
      supportsTest: true,
      supportsSend: true,
      supportsSchemaSummary: true,
      supportsCredentialValidation: CREDENTIAL_VALIDATION_CHANNELS.has(channelType),
    },
    configSchemaSummary: summarizeSchema(channelType),
  };
}

function resolveAggregateStatus(
  summary: { running?: boolean; error?: string; lastError?: string } | undefined,
  accounts: Array<{
    connected?: boolean;
    linked?: boolean;
    running?: boolean;
    lastError?: string;
  }>,
): NormalizedChannelStatus {
  if (accounts.some((account) => resolveNormalizedStatus(summary, account) === 'connected')) {
    return 'connected';
  }
  if (accounts.some((account) => resolveNormalizedStatus(summary, account) === 'error')) {
    return 'error';
  }
  if (accounts.some((account) => resolveNormalizedStatus(summary, account) === 'connecting')) {
    return 'connecting';
  }
  return resolveNormalizedStatus(summary, undefined);
}

function normalizeWorkbenchSyncState(status: NormalizedChannelStatus): WorkbenchSession['syncState'] {
  if (status === 'connected') return 'synced';
  if (status === 'connecting') return 'connecting';
  if (status === 'error') return 'error';
  return 'disconnected';
}

function readLatestActivityAt(account: {
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  lastConnectedAt?: number | null;
}): string | undefined {
  const candidates = [account.lastInboundAt, account.lastOutboundAt, account.lastConnectedAt]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (candidates.length === 0) return undefined;
  return new Date(Math.max(...candidates)).toISOString();
}

function buildWorkbenchSessionId(
  channelType: string,
  accountId: string,
  externalConversationId?: string,
): string {
  if (channelType === 'wechat') {
    const conversationId = externalConversationId?.trim() || accountId;
    return `wechat:${accountId}:${conversationId}`;
  }
  return `${channelType}-${accountId}`;
}

function mergeWorkbenchMessages(
  runtimeMessages: WorkbenchConversationMessage[],
  snapshotMessages: WorkbenchConversationMessage[],
): WorkbenchConversationMessage[] {
  const mergedIds = new Set(runtimeMessages.map((message) => message.id));
  const uniqueSnapshotMessages = snapshotMessages.filter((message) => !mergedIds.has(message.id));
  return [...runtimeMessages, ...uniqueSnapshotMessages].sort((left, right) => {
    const leftTs = Date.parse(left.createdAt ?? '') || 0;
    const rightTs = Date.parse(right.createdAt ?? '') || 0;
    return leftTs - rightTs;
  });
}

function resolveConversationChannelType(conversationId: string): string {
  if (conversationId.includes(':')) {
    return conversationId.split(':')[0] || '';
  }
  if (conversationId.includes('-')) {
    return conversationId.split('-')[0] || '';
  }
  return conversationId;
}

function buildWorkbenchSessions(
  channelType: string,
  statusSnapshot: ChannelsStatusSnapshot | null,
  selectedAccountId?: string,
): WorkbenchSession[] {
  const rawChannelType = toOpenClawChannelType(channelType);
  const summary = statusSnapshot?.channels?.[rawChannelType];
  const accounts = statusSnapshot?.channelAccounts?.[rawChannelType] ?? [];
  const defaultAccountId = statusSnapshot?.channelDefaultAccountId?.[rawChannelType] ?? 'default';

  const sessions = accounts
    .filter((account) => account.configured !== false)
    .filter((account) => {
      if (!selectedAccountId) return true;
      return (account.accountId || defaultAccountId) === selectedAccountId;
    })
    .map((account) => {
      const accountId = account.accountId || defaultAccountId;
      const status = resolveNormalizedStatus(summary, account);
      const latestActivityAt = readLatestActivityAt(account);
      return {
        id: buildWorkbenchSessionId(channelType, accountId),
        channelId: `${channelType}-${accountId}`,
        channelType,
        sessionType: accountId === defaultAccountId ? 'group' : 'private',
        title: account.name?.trim() || `${channelType}-${accountId}`,
        pinned: accountId === defaultAccountId,
        syncState: normalizeWorkbenchSyncState(status),
        latestActivityAt,
        participantSummary: accountId === defaultAccountId ? '已同步群聊' : '机器人私聊',
        visibleAgentId: accountId === defaultAccountId ? 'main' : accountId,
      } satisfies WorkbenchSession;
    })
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return (Date.parse(right.latestActivityAt ?? '') || 0) - (Date.parse(left.latestActivityAt ?? '') || 0);
    });

  if (sessions.length > 0) return sessions;

  if (selectedAccountId) {
    return [
      {
        id: buildWorkbenchSessionId(channelType, selectedAccountId),
        channelId: `${channelType}-${selectedAccountId}`,
        channelType,
        sessionType: 'group',
        title: `${channelType}-${selectedAccountId}`,
        pinned: selectedAccountId === defaultAccountId,
        syncState: normalizeWorkbenchSyncState(resolveNormalizedStatus(summary, undefined)),
        participantSummary: '等待同步会话',
        visibleAgentId: selectedAccountId === defaultAccountId ? 'main' : selectedAccountId,
      },
    ];
  }

  const fallbackStatus = normalizeWorkbenchSyncState(resolveNormalizedStatus(summary, undefined));
  return [
    {
      id: buildWorkbenchSessionId(channelType, defaultAccountId),
      channelId: `${channelType}-${defaultAccountId}`,
      channelType,
      sessionType: 'group',
      title: channelType,
      pinned: true,
      syncState: fallbackStatus,
      participantSummary: '等待同步会话',
      visibleAgentId: 'main',
    },
  ];
}

async function readOpenClawConfigJson(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(getOpenClawConfigDir(), 'openclaw.json'), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fixBareEsmSpecifiers(dir: string): void {
  if (!existsSync(dir)) return;
  const bareRelative = /((?:from|import)\s+')(\.{1,2}\/[^']*?)(')/g;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (statSync(p).isDirectory()) {
      fixBareEsmSpecifiers(p);
    } else if (entry.name.endsWith('.js')) {
      const orig = readFileSync(p, 'utf-8');
      const fixed = orig.replace(bareRelative, (m, pre: string, spec: string, post: string) =>
        spec.endsWith('.js') || spec.endsWith('/') ? m : pre + spec + '.js' + post
      );
      if (fixed !== orig) writeFileSync(p, fixed, 'utf-8');
    }
  }
}

async function importFeishuPluginModule(relativePath: string): Promise<Record<string, unknown>> {
  const fullPath = join(FEISHU_PLUGIN_ROOT, relativePath);
  return import(pathToFileURL(fullPath).href) as Promise<Record<string, unknown>>;
}

async function importWeChatPluginModule(relativePath: string): Promise<Record<string, unknown>> {
  const fullPath = join(WECHAT_PLUGIN_ROOT, relativePath);
  return import(pathToFileURL(fullPath).href) as Promise<Record<string, unknown>>;
}

// Feishu plugin prepends sender open_id to message text: "ou_xxx: message"
// Strip this prefix so workbench shows clean message content.
const FEISHU_OPEN_ID_PREFIX_RE = /^(ou_[a-z0-9]+):\s*/i;
function stripFeishuSenderPrefix(text: string): { openId: string; cleaned: string } | null {
  const m = FEISHU_OPEN_ID_PREFIX_RE.exec(text);
  if (!m) return null;
  return { openId: m[1], cleaned: text.slice(m[0].length) };
}

function readInjectedFeishuWorkbenchSnapshotForTests():
  | {
    sessions: WorkbenchSession[];
    messagesByConversationId: Map<string, WorkbenchConversationMessage[]>;
  }
  | null {
  const injected = (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY];
  if (!injected || typeof injected !== 'object') {
    return null;
  }
  const row = injected as {
    sessions?: unknown;
    messagesByConversationId?: unknown;
  };
  const sessions = Array.isArray(row.sessions)
    ? row.sessions as WorkbenchSession[]
    : [];
  const messagesByConversationId = row.messagesByConversationId instanceof Map
    ? row.messagesByConversationId as Map<string, WorkbenchConversationMessage[]>
    : new Map<string, WorkbenchConversationMessage[]>();
  return { sessions, messagesByConversationId };
}

async function fetchFeishuWorkbenchSnapshot(): Promise<{
  sessions: WorkbenchSession[];
  messagesByConversationId: Map<string, WorkbenchConversationMessage[]>;
}> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    const injected = readInjectedFeishuWorkbenchSnapshotForTests();
    if (injected) {
      return injected;
    }
    return { sessions: [], messagesByConversationId: new Map() };
  }
  if (!existsSync(FEISHU_PLUGIN_ROOT)) {
    return { sessions: [], messagesByConversationId: new Map() };
  }

  const config = await readOpenClawConfigJson();
  if (!config) {
    return { sessions: [], messagesByConversationId: new Map() };
  }

  const [
    accountsModule,
    larkClientModule,
    toolClientModule,
    formatMessagesModule,
    userNameModule,
  ] = await Promise.all([
    importFeishuPluginModule('src/core/accounts.js'),
    importFeishuPluginModule('src/core/lark-client.js'),
    importFeishuPluginModule('src/core/tool-client.js'),
    importFeishuPluginModule('src/tools/oapi/im/format-messages.js'),
    importFeishuPluginModule('src/tools/oapi/im/user-name-uat.js'),
  ]);

  const getEnabledLarkAccounts = accountsModule.getEnabledLarkAccounts as ((cfg: Record<string, unknown>) => Array<Record<string, unknown>>) | undefined;
  const getLarkAccount = accountsModule.getLarkAccount as ((cfg: Record<string, unknown>, accountId?: string) => Record<string, unknown>) | undefined;
  const LarkClient = larkClientModule.LarkClient as {
    fromCfg: (cfg: Record<string, unknown>, accountId?: string) => { sdk: unknown };
  } | undefined;
  const ToolClient = toolClientModule.ToolClient as (new (params: {
    config: Record<string, unknown>;
    account: Record<string, unknown>;
    senderOpenId?: string;
    sdk: unknown;
  }) => {
    invokeByPath: <T>(toolAction: string, path: string, options?: Record<string, unknown>) => Promise<T>;
  }) | undefined;
  const formatMessageList = formatMessagesModule.formatMessageList as ((
    items: Array<Record<string, unknown>>,
    account: { accountId: string },
    log: (...args: unknown[]) => void,
    client: {
      account: { accountId: string };
      invokeByPath: <T>(toolAction: string, path: string, options?: Record<string, unknown>) => Promise<T>;
      invoke: <T>(toolAction: string, fn: (...args: unknown[]) => Promise<T>, options?: Record<string, unknown>) => Promise<T>;
    },
  ) => Promise<Array<Record<string, unknown>>>) | undefined;
  const batchResolveUserNamesAsUser = userNameModule.batchResolveUserNamesAsUser as ((params: {
    client: {
      account: { accountId: string };
      invoke: <T>(toolAction: string, fn: (...args: unknown[]) => Promise<T>, options?: Record<string, unknown>) => Promise<T>;
    };
    openIds: string[];
    log: (...args: unknown[]) => void;
  }) => Promise<Map<string, string>>) | undefined;
  const getUATUserName = userNameModule.getUATUserName as ((accountId: string, openId: string) => string | undefined) | undefined;

  if (!getEnabledLarkAccounts || !getLarkAccount || !LarkClient || !ToolClient || !formatMessageList || !batchResolveUserNamesAsUser || !getUATUserName) {
    return { sessions: [], messagesByConversationId: new Map() };
  }

  const enabledAccounts = getEnabledLarkAccounts(config);
  const sessions: WorkbenchSession[] = [];
  const messagesByConversationId = new Map<string, WorkbenchConversationMessage[]>();

  for (const enabledAccount of enabledAccounts) {
    const accountId = typeof enabledAccount.accountId === 'string' ? enabledAccount.accountId : 'default';
    const account = getLarkAccount(config, accountId);
    if (!account.configured) continue;

    const toolClient = new ToolClient({
      config,
      account,
      sdk: LarkClient.fromCfg(config, accountId).sdk,
    });

    const searchResponse = await (toolClient as unknown as {
      invoke: <T>(
        toolAction: string,
        fn: (sdk: {
          search: {
            message: {
              create: (
                payload: {
                  data: Record<string, unknown>;
                  params: Record<string, unknown>;
                },
                opts?: unknown,
              ) => Promise<T>;
            };
          };
        }, opts?: unknown) => Promise<T>,
        options?: Record<string, unknown>,
      ) => Promise<T>;
    }).invoke<{ data?: { items?: string[] } }>(
      'feishu_im_user_search_messages.default',
      (sdk, opts) => sdk.search.message.create({
        data: {
          query: '',
          start_time: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000).toString(),
          end_time: Math.floor(Date.now() / 1000).toString(),
        },
        params: {
          user_id_type: 'open_id',
          page_size: 50,
        },
      }, opts),
      { as: 'user' },
    ).catch(() => ({ data: { items: [] } }));

    const messageIds = searchResponse?.data?.items ?? [];
    if (messageIds.length === 0) continue;

    const messageQuery = messageIds.map((id) => `message_ids=${encodeURIComponent(id)}`).join('&');
    const detailsResponse = await toolClient.invokeByPath<{ data?: { items?: Array<Record<string, unknown>> } }>(
      'feishu_im_user_search_messages.default',
      `/open-apis/im/v1/messages/mget?${messageQuery}`,
      {
        method: 'GET',
        query: {
          user_id_type: 'open_id',
          card_msg_content_type: 'raw_card_content',
        },
        as: 'user',
      },
    ).catch(() => ({ data: { items: [] } }));

    const items = detailsResponse?.data?.items ?? [];
    if (items.length === 0) continue;

    const chatIds = [...new Set(items.map((item) => String(item.chat_id || '')).filter(Boolean))];
    const chatsResponse = await toolClient.invokeByPath<{ data?: { items?: Array<Record<string, unknown>> } }>(
      'feishu_im_user_search_messages.default',
      '/open-apis/im/v1/chats/batch_query',
      {
        method: 'POST',
        body: { chat_ids: chatIds },
        query: { user_id_type: 'open_id' },
        as: 'user',
      },
    ).catch(() => ({ data: { items: [] } }));

    const chatContextMap = new Map<string, { name?: string; chat_mode?: string; p2p_target_id?: string }>();
    for (const item of chatsResponse?.data?.items ?? []) {
      if (typeof item.chat_id === 'string') {
        chatContextMap.set(item.chat_id, {
          name: typeof item.name === 'string' ? item.name : undefined,
          chat_mode: typeof item.chat_mode === 'string' ? item.chat_mode : undefined,
          p2p_target_id: typeof item.p2p_target_id === 'string' ? item.p2p_target_id : undefined,
        });
      }
    }

    const p2pTargetIds = [...new Set(
      [...chatContextMap.values()]
        .map((value) => value.p2p_target_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    )];
    if (p2pTargetIds.length > 0) {
      await batchResolveUserNamesAsUser({
        client: toolClient as unknown as {
          account: { accountId: string };
          invoke: <T>(toolAction: string, fn: (...args: unknown[]) => Promise<T>, options?: Record<string, unknown>) => Promise<T>;
        },
        openIds: p2pTargetIds,
        log: () => undefined,
      }).catch(() => undefined);
    }

    const formattedMessages = await formatMessageList(
      items,
      { accountId },
      () => undefined,
      toolClient as unknown as {
        account: { accountId: string };
        invokeByPath: <T>(toolAction: string, path: string, options?: Record<string, unknown>) => Promise<T>;
        invoke: <T>(toolAction: string, fn: (...args: unknown[]) => Promise<T>, options?: Record<string, unknown>) => Promise<T>;
      },
    ).catch(() => []);

    const groupedByChatId = new Map<string, Array<Record<string, unknown>>>();
    for (let index = 0; index < formattedMessages.length; index += 1) {
      const message = formattedMessages[index];
      const sourceItem = items[index];
      const chatId = typeof sourceItem?.chat_id === 'string' ? sourceItem.chat_id : '';
      if (!chatId) continue;
      const queue = groupedByChatId.get(chatId) ?? [];
      queue.push(message);
      groupedByChatId.set(chatId, queue);
    }

    for (const [chatId, chatMessages] of groupedByChatId.entries()) {
      const chatContext = chatContextMap.get(chatId);
      const isPrivate = chatContext?.chat_mode === 'p2p';
      const title = isPrivate
        ? (chatContext?.p2p_target_id ? getUATUserName(accountId, chatContext.p2p_target_id) : undefined) || chatContext?.name || chatId
        : chatContext?.name || chatId;
      const latestMessage = chatMessages[0];
      const previewText = typeof latestMessage?.content === 'string' ? latestMessage.content : undefined;
      const latestActivityAt = typeof latestMessage?.create_time === 'string'
        ? latestMessage.create_time
        : undefined;
      const conversationId = `feishu:${accountId}:${chatId}`;
      sessions.push({
        id: conversationId,
        channelId: `feishu-${accountId}`,
        channelType: 'feishu',
        sessionType: isPrivate ? 'private' : 'group',
        title,
        pinned: !isPrivate && accountId === 'default',
        syncState: 'synced',
        latestActivityAt,
        previewText,
        participantSummary: isPrivate ? '机器人私聊' : '已同步群聊',
        visibleAgentId: accountId === 'default' ? 'main' : accountId,
      });

      const visibleMessages: WorkbenchConversationMessage[] = chatMessages.map((message) => {
        const sender = (message.sender ?? {}) as Record<string, unknown>;
        const senderType = typeof sender.sender_type === 'string' ? sender.sender_type : '';
        const senderName = typeof sender.name === 'string' ? sender.name : undefined;
        return {
          id: typeof message.message_id === 'string' ? message.message_id : randomUUID(),
          role: senderType === 'bot' ? 'agent' : 'human',
          authorName: senderName ?? (senderType === 'bot' ? 'ClawCorp' : '飞书用户'),
          createdAt: typeof message.create_time === 'string' ? message.create_time : undefined,
          content: typeof message.content === 'string' ? message.content : undefined,
          // Human messages from Feishu API are from external users (not the workbench user)
          ...(senderType !== 'bot' ? { isSelf: false } : {}),
        };
      });
      messagesByConversationId.set(conversationId, visibleMessages);
    }
  }

  sessions.sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return (Date.parse(right.latestActivityAt ?? '') || 0) - (Date.parse(left.latestActivityAt ?? '') || 0);
  });

  return { sessions, messagesByConversationId };
}

async function sendFeishuConversationMessage(params: {
  conversationId: string;
  text: string;
  identity?: 'bot' | 'self';
}): Promise<{ messageId: string; chatId: string }> {
  const [, accountId, chatId] = params.conversationId.split(':');
  if (!accountId || !chatId) {
    throw new Error('Invalid Feishu conversation target');
  }

  const pluginModule = await importFeishuPluginModule('index.js');
  const sendMessageFeishu = pluginModule.sendMessageFeishu as ((params: {
    cfg: Record<string, unknown>;
    to: string;
    text: string;
    accountId?: string;
    identity?: 'bot' | 'self';
  }) => Promise<{ messageId: string; chatId: string }>) | undefined;
  if (!sendMessageFeishu) {
    throw new Error('Feishu outbound bridge is unavailable');
  }

  const config = await readOpenClawConfigJson();
  if (!config) {
    throw new Error('OpenClaw config not found');
  }

  return sendMessageFeishu({
    cfg: config,
    to: chatId,
    text: params.text,
    accountId,
    identity: params.identity ?? 'bot',
  });
}

function parseFeishuConversationId(conversationId: string): FeishuConversationIdParts | null {
  if (!conversationId.startsWith('feishu:')) {
    return null;
  }
  const parts = conversationId.split(':');
  if (parts.length < 3) {
    return null;
  }
  const accountId = parts[1]?.trim();
  const externalConversationId = parts.slice(2).join(':').trim();
  if (!accountId || !externalConversationId) {
    return null;
  }
  return { accountId, externalConversationId };
}

function parseWeChatConversationId(conversationId: string): WeChatConversationIdParts | null {
  if (!conversationId.startsWith('wechat:')) {
    return null;
  }
  const parts = conversationId.split(':');
  if (parts.length < 3) {
    return null;
  }
  const accountId = parts[1]?.trim();
  const externalConversationId = parts.slice(2).join(':').trim();
  if (!accountId || !externalConversationId) {
    return null;
  }
  return { accountId, externalConversationId };
}

function parseAccountConversationId(conversationId: string): WorkbenchConversationTarget | null {
  const separatorIndex = conversationId.indexOf('-');
  if (separatorIndex === -1) {
    return null;
  }
  const channelType = conversationId.slice(0, separatorIndex).trim();
  const accountId = conversationId.slice(separatorIndex + 1).trim();
  if (!channelType || !accountId) {
    return null;
  }
  return {
    channelType,
    accountId,
    externalConversationId: accountId,
  };
}

function parseWorkbenchConversationTarget(conversationId: string): WorkbenchConversationTarget | null {
  const feishuConversation = parseFeishuConversationId(conversationId);
  if (feishuConversation) {
    return {
      channelType: 'feishu',
      accountId: feishuConversation.accountId,
      externalConversationId: feishuConversation.externalConversationId,
    };
  }
  const wechatConversation = parseWeChatConversationId(conversationId);
  if (wechatConversation) {
    return {
      channelType: 'wechat',
      accountId: wechatConversation.accountId,
      externalConversationId: wechatConversation.externalConversationId,
    };
  }
  return parseAccountConversationId(conversationId);
}

function buildScopedWorkbenchSessionKey(
  agentId: string,
  channelType: string,
  sessionType: WorkbenchSession['sessionType'],
  externalConversationId: string,
): string {
  return `agent:${agentId}:${channelType}:${sessionType}:${externalConversationId}`;
}

function isLegacyMainSessionKey(sessionKey: string | null | undefined): boolean {
  return typeof sessionKey === 'string' && /^agent:[^:]+:[^:]+$/.test(sessionKey);
}

function applyWorkbenchBindingMetadata(
  session: WorkbenchSession,
  binding: ChannelConversationBindingRecord | null,
): WorkbenchSession | null {
  if (binding?.hidden) {
    return null;
  }
  if (binding?.displayTitle?.trim()) {
    return {
      ...session,
      title: binding.displayTitle.trim(),
    };
  }
  return session;
}

function applyWorkbenchConversationBindingMetadata(
  conversation: WorkbenchConversationView | null,
  binding: ChannelConversationBindingRecord | null,
): WorkbenchConversationView | null {
  if (!conversation) {
    return null;
  }
  if (binding?.hidden) {
    return null;
  }
  if (binding?.displayTitle?.trim()) {
    return {
      ...conversation,
      title: binding.displayTitle.trim(),
    };
  }
  return conversation;
}

async function getConversationBinding(
  channelType: string,
  accountId: string,
  externalConversationId: string,
): Promise<ChannelConversationBindingRecord | null> {
  try {
    return await Promise.resolve(
      channelConversationBindings.get(channelType, accountId, externalConversationId),
    );
  } catch {
    return null;
  }
}

function extractFirstStringValue(
  row: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const candidate = row[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function coerceIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return coerceIsoTimestamp(asNumber);
    }
    const asDate = Date.parse(trimmed);
    if (Number.isFinite(asDate)) {
      return new Date(asDate).toISOString();
    }
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const ts = value > 1_000_000_000_000 ? value : value * 1000;
  const asDate = new Date(ts);
  return Number.isNaN(asDate.getTime()) ? undefined : asDate.toISOString();
}

function coerceDurationMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }
  return undefined;
}

function extractRuntimeText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const text = value
      .map((item) => extractRuntimeText(item))
      .filter((item): item is string => Boolean(item))
      .join('\n')
      .trim();
    return text || undefined;
  }
  if (typeof value !== 'object' || value == null) {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  const direct = extractFirstStringValue(row, ['text', 'message', 'content', 'summary', 'result']);
  if (direct) {
    return direct;
  }
  if ('content' in row) {
    return extractRuntimeText(row.content);
  }
  return undefined;
}

function normalizeRuntimeWorkbenchRole(rawRole: unknown): WorkbenchConversationMessage['role'] {
  const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (role === 'user' || role === 'human') return 'human';
  if (role === 'assistant' || role === 'agent' || role === 'model') return 'agent';
  if (role === 'tool' || role === 'toolresult' || role === 'tool_result') return 'tool';
  if (role === 'system') return 'system';
  return 'agent';
}

function extractHistoryItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload !== 'object' || payload == null) {
    return [];
  }
  const row = payload as Record<string, unknown>;
  if (Array.isArray(row.messages)) {
    return row.messages;
  }
  if (Array.isArray(row.history)) {
    return row.history;
  }
  return [];
}

function mapRuntimeHistoryItemToWorkbenchMessage(
  item: unknown,
  index: number,
  channelType?: string,
): WorkbenchConversationMessage | null {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return {
      id: `runtime-${index}`,
      role: 'agent',
      authorName: 'ClawCorp',
      content: text,
    };
  }
  if (typeof item !== 'object' || item == null) {
    return null;
  }

  const row = item as Record<string, unknown>;
  const role = normalizeRuntimeWorkbenchRole(row.role);
  const rawContent = extractRuntimeText(row.content ?? row.message ?? row.text ?? row.output ?? row.result);
  // Strip Feishu sender prefix "ou_xxx: message" -> isSelf=false marks it as incoming Feishu message
  let content: string | undefined = rawContent;
  let isSelf: boolean | undefined;
  if (rawContent) {
    const stripped = stripFeishuSenderPrefix(rawContent);
    if (stripped !== null) {
      content = stripped.cleaned || undefined;
      isSelf = false;
    }
  }
  const summary = extractFirstStringValue(row, ['summary']);
  const id = extractFirstStringValue(row, ['id', 'message_id', 'toolCallId', 'tool_call_id']) ?? `runtime-${index}`;
  const toolName = extractFirstStringValue(row, ['toolName', 'tool_name', 'name']);
  const normalizedChannelType = (channelType || '').trim().toLowerCase();
  const fallbackHumanAuthorName = normalizedChannelType === 'wechat'
    ? '微信用户'
    : normalizedChannelType === 'feishu'
      ? '飞书用户'
      : 'Channel User';
  const authorName = extractFirstStringValue(row, ['authorName', 'author'])
    ?? (role === 'human' ? fallbackHumanAuthorName : role === 'agent' ? 'ClawCorp' : undefined);
  const createdAt = coerceIsoTimestamp(
    row.createdAt
    ?? row.create_time
    ?? row.timestamp
    ?? row.ts
    ?? row.time,
  );
  const details = typeof row.details === 'object' && row.details != null
    ? row.details as Record<string, unknown>
    : null;
  const durationMs = coerceDurationMs(
    row.durationMs
    ?? row.duration
    ?? details?.durationMs
    ?? details?.duration,
  );

  if (!content && !summary && role !== 'tool') {
    return null;
  }

  return {
    id,
    role,
    ...(authorName ? { authorName } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(content ? { content } : {}),
    ...(toolName ? { toolName } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(summary ? { summary } : {}),
    ...(isSelf !== undefined ? { isSelf } : {}),
  };
}

function mapRuntimeHistoryToWorkbenchMessages(payload: unknown, channelType?: string): WorkbenchConversationMessage[] {
  return extractHistoryItems(payload)
    .map((item, index) => mapRuntimeHistoryItemToWorkbenchMessage(item, index, channelType))
    .filter((item): item is WorkbenchConversationMessage => item != null);
}

async function resolveScopedConversationBinding(
  target: WorkbenchConversationTarget,
  sessionType: WorkbenchSession['sessionType'],
  preferredAgentId?: string,
  options?: {
    createIfMissing?: boolean;
    allowExistingLegacyMainSessionKey?: boolean;
  },
): Promise<{ agentId: string; sessionKey: string; binding: ChannelConversationBindingRecord } | null> {
  const existing = await channelConversationBindings.get(
    target.channelType,
    target.accountId,
    target.externalConversationId,
  );
  if (
    existing?.sessionKey
    && (
      !isLegacyMainSessionKey(existing.sessionKey)
      || options?.allowExistingLegacyMainSessionKey
    )
  ) {
    return {
      agentId: existing.agentId || inferAgentIdFromAccountId(target.accountId),
      sessionKey: existing.sessionKey,
      binding: existing,
    };
  }

  if (options?.createIfMissing === false && !existing) {
    return null;
  }

  const snapshot = await listAgentsSnapshot().catch(() => null);
  const snapshotAgents = Array.isArray(snapshot?.agents)
    ? snapshot.agents
    : [];
  const rawChannelType = toOpenClawChannelType(target.channelType);
  const ownerFromScopedChannel = typeof snapshot?.channelOwners?.[`${rawChannelType}:${target.accountId}`] === 'string'
    ? snapshot.channelOwners[`${rawChannelType}:${target.accountId}`].trim()
    : '';
  const ownerFromChannel = typeof snapshot?.channelOwners?.[rawChannelType] === 'string'
    ? snapshot.channelOwners[rawChannelType].trim()
    : '';
  const defaultAgentId = typeof snapshot?.defaultAgentId === 'string'
    ? snapshot.defaultAgentId.trim()
    : '';
  const configuredAgentIds = snapshotAgents
    .map((agent) => (typeof agent?.id === 'string' ? agent.id.trim() : ''))
    .filter(Boolean);
  const fallbackAgentIds = configuredAgentIds.length > 0
    ? configuredAgentIds
    : await listConfiguredAgentIds().catch(() => []);
  const candidates = [
    ownerFromScopedChannel,
    ownerFromChannel,
    preferredAgentId?.trim() || '',
    existing?.agentId?.trim() || '',
    inferAgentIdFromAccountId(target.accountId),
    defaultAgentId,
    'main',
  ].filter(Boolean);
  const resolvedAgentId = candidates.find((candidate) => fallbackAgentIds.includes(candidate))
    || candidates[0]
    || 'main';
  const persisted = await channelConversationBindings.upsert({
    channelType: target.channelType,
    accountId: target.accountId,
    externalConversationId: target.externalConversationId,
    agentId: resolvedAgentId,
    sessionKey: buildScopedWorkbenchSessionKey(
      resolvedAgentId,
      target.channelType,
      sessionType,
      target.externalConversationId,
    ),
    ...(existing?.displayTitle ? { displayTitle: existing.displayTitle } : {}),
    ...(existing?.hidden ? { hidden: existing.hidden } : {}),
  });

  return {
    agentId: persisted.agentId,
    sessionKey: persisted.sessionKey,
    binding: persisted,
  };
}

async function resolveFeishuBindingForConversation(
  conversationId: string,
  preferredAgentId?: string,
  options?: {
    createIfMissing?: boolean;
    sessionType?: WorkbenchSession['sessionType'];
  },
): Promise<{ agentId: string; sessionKey: string; binding: ChannelConversationBindingRecord } | null> {
  const parsedConversation = parseFeishuConversationId(conversationId);
  if (!parsedConversation) {
    return null;
  }
  return resolveScopedConversationBinding({
    channelType: 'feishu',
    accountId: parsedConversation.accountId,
    externalConversationId: parsedConversation.externalConversationId,
  }, options?.sessionType ?? 'group', preferredAgentId, options);
}

async function resolveWeChatBindingForConversation(
  conversationId: string,
  preferredAgentId?: string,
  options?: {
    createIfMissing?: boolean;
    sessionType?: WorkbenchSession['sessionType'];
  },
): Promise<{ agentId: string; sessionKey: string; binding: ChannelConversationBindingRecord } | null> {
  const parsedConversation = parseWorkbenchConversationTarget(conversationId);
  if (!parsedConversation || parsedConversation.channelType !== 'wechat') {
    return null;
  }
  return resolveScopedConversationBinding(parsedConversation, options?.sessionType ?? 'group', preferredAgentId, {
    ...options,
    allowExistingLegacyMainSessionKey: true,
  });
}

function buildFeishuConversationPayload(
  conversationId: string,
  discoveredConversation: WorkbenchSession | null,
  resolvedAgentId?: string,
): {
  id: string;
  title: string;
  syncState: WorkbenchSession['syncState'];
  participantSummary?: string;
  visibleAgentId?: string;
} {
  const parsedConversation = parseFeishuConversationId(conversationId);
  const fallbackTitle = parsedConversation?.externalConversationId || conversationId;
  const fallbackSummary = parsedConversation?.externalConversationId?.startsWith('user:')
    ? 'synced private chat'
    : 'synced group chat';
  const visibleAgentId = resolvedAgentId
    || discoveredConversation?.visibleAgentId
    || (parsedConversation ? inferAgentIdFromAccountId(parsedConversation.accountId) : undefined);

  return {
    id: conversationId,
    title: discoveredConversation?.title || fallbackTitle,
    syncState: discoveredConversation?.syncState || 'synced',
    participantSummary: discoveredConversation?.participantSummary || fallbackSummary,
    ...(visibleAgentId ? { visibleAgentId } : {}),
  };
}

function resolveRequestedCapability(
  capabilities: NormalizedChannelCapability[],
  requestedChannelId: string,
): 
  | { ok: true; capability: NormalizedChannelCapability }
  | { ok: false; statusCode: 404 | 409; error: string } {
  const exactMatch = capabilities.find((capability) => capability.channelId === requestedChannelId);
  if (exactMatch) {
    return { ok: true, capability: exactMatch };
  }

  const typeMatches = capabilities.filter((capability) => capability.channelType === requestedChannelId);
  if (typeMatches.length === 0) {
    return { ok: false, statusCode: 404, error: 'Channel not found' };
  }
  if (typeMatches.length > 1) {
    return { ok: false, statusCode: 409, error: 'Channel account is ambiguous' };
  }
  return { ok: true, capability: typeMatches[0] };
}

async function listNormalizedCapabilities(ctx: HostApiContext): Promise<NormalizedChannelCapability[]> {
  const configuredChannelTypes = await listConfiguredChannels();
  let statusSnapshot: ChannelsStatusSnapshot | null = null;
  try {
    statusSnapshot = await ctx.gatewayManager.rpc<ChannelsStatusSnapshot>('channels.status', { probe: true });
  } catch {
    // Fall back to configured-channel metadata when live status is unavailable.
  }

  const capabilities: NormalizedChannelCapability[] = [];
  for (const channelType of configuredChannelTypes) {
    const rawChannelType = toOpenClawChannelType(channelType);
    const accounts = statusSnapshot?.channelAccounts?.[rawChannelType] ?? [];
    const summary = statusSnapshot?.channels?.[rawChannelType];
    if (accounts.length > 0) {
      let pushedAnyAccount = false;
      for (const account of accounts) {
        if (account.configured === false) continue;
        pushedAnyAccount = true;
        const accountId = account.accountId || statusSnapshot?.channelDefaultAccountId?.[rawChannelType] || 'default';
        const status = resolveNormalizedStatus(summary, account);
        capabilities.push(buildCapability(channelType, accountId, status));
      }
      if (pushedAnyAccount) {
        continue;
      }
    }
    const status = resolveNormalizedStatus(summary, undefined);
    capabilities.push(buildCapability(channelType, statusSnapshot?.channelDefaultAccountId?.[rawChannelType], status));
  }

  return capabilities;
}

async function buildChannelAccountsView(ctx: HostApiContext): Promise<ChannelAccountsView[]> {
  const [configuredChannelTypes, configuredAccounts, agentsSnapshot] = await Promise.all([
    listConfiguredChannels(),
    listConfiguredChannelAccounts(),
    listAgentsSnapshot(),
  ]);

  let statusSnapshot: ChannelsStatusSnapshot | null = null;
  try {
    statusSnapshot = await ctx.gatewayManager.rpc<ChannelsStatusSnapshot>('channels.status', { probe: true });
  } catch {
    // Fall back to config-only account view when runtime status is unavailable.
  }

  const rawChannelTypes = new Set<string>([
    ...configuredChannelTypes.map((channelType) => toOpenClawChannelType(channelType)),
    ...Object.keys(configuredAccounts),
    ...Object.keys(statusSnapshot?.channelAccounts || {}),
  ]);

  const channels: ChannelAccountsView[] = [];
  for (const rawChannelType of rawChannelTypes) {
    const uiChannelType = toUiChannelType(rawChannelType);
    const configuredAccountIds = configuredAccounts[rawChannelType]?.accountIds ?? [];
    const runtimeAccounts = statusSnapshot?.channelAccounts?.[rawChannelType] ?? [];
    const summary = statusSnapshot?.channels?.[rawChannelType];
    const hasLocalConfig = configuredChannelTypes.includes(uiChannelType) || Boolean(configuredAccounts[rawChannelType]);
    const hasRuntimeConfigured = runtimeAccounts.some((account) => account.configured === true);
    if (!hasLocalConfig && !hasRuntimeConfigured) {
      continue;
    }

    const defaultAccountId = configuredAccounts[rawChannelType]?.defaultAccountId
      ?? statusSnapshot?.channelDefaultAccountId?.[rawChannelType]
      ?? configuredAccountIds[0]
      ?? 'default';
    const runtimeAccountIds = runtimeAccounts
      .map((account) => account.accountId)
      .filter((accountId): accountId is string => typeof accountId === 'string' && accountId.trim().length > 0);
    const accountIds = Array.from(new Set([...configuredAccountIds, ...runtimeAccountIds, defaultAccountId])).sort((left, right) => {
      if (left === defaultAccountId) return -1;
      if (right === defaultAccountId) return 1;
      return left.localeCompare(right);
    });

    const accounts: ChannelAccountView[] = accountIds.map((accountId) => {
      const runtime = runtimeAccounts.find((account) => account.accountId === accountId);
      return {
        accountId,
        name: runtime?.name || accountId,
        configured: configuredAccountIds.includes(accountId) || runtime?.configured === true,
        connected: runtime?.connected === true,
        running: runtime?.running === true,
        linked: runtime?.linked === true,
        ...(typeof runtime?.lastError === 'string' ? { lastError: runtime.lastError } : {}),
        status: resolveNormalizedStatus(summary, runtime),
        isDefault: accountId === defaultAccountId,
        ...(agentsSnapshot.channelOwners?.[`${rawChannelType}:${accountId}`]
          ? { agentId: agentsSnapshot.channelOwners[`${rawChannelType}:${accountId}`] }
          : {}),
      };
    });

    channels.push({
      channelType: uiChannelType,
      defaultAccountId,
      status: resolveAggregateStatus(summary, runtimeAccounts),
      accounts,
    });
  }

  return channels.sort((left, right) => left.channelType.localeCompare(right.channelType));
}

function buildChannelTargetLabel(baseLabel: string, value: string): string {
  const trimmed = baseLabel.trim();
  return trimmed && trimmed !== value ? `${trimmed} (${value})` : value;
}

function normalizeFeishuTargetValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return null;
  if (trimmed.startsWith('chat:') || trimmed.startsWith('user:')) return trimmed;
  if (trimmed.startsWith('open_id:')) return `user:${trimmed.slice('open_id:'.length)}`;
  if (trimmed.startsWith('feishu:')) return normalizeFeishuTargetValue(trimmed.slice('feishu:'.length));
  if (trimmed.startsWith('oc_')) return `chat:${trimmed}`;
  if (trimmed.startsWith('ou_')) return `user:${trimmed}`;
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return `user:${trimmed}`;
  return null;
}

function inferFeishuTargetKind(target: string): ChannelTargetOptionView['kind'] {
  return target.startsWith('chat:') ? 'group' : 'user';
}

function buildFeishuTargetOption(
  value: string,
  label?: string,
  kind?: ChannelTargetOptionView['kind'],
): ChannelTargetOptionView {
  const normalizedLabel = typeof label === 'string' && label.trim() ? label.trim() : value;
  return {
    value,
    label: buildChannelTargetLabel(normalizedLabel, value),
    kind: kind ?? inferFeishuTargetKind(value),
  };
}

function mergeTargetOptions(...groups: ChannelTargetOptionView[][]): ChannelTargetOptionView[] {
  const seen = new Set<string>();
  const results: ChannelTargetOptionView[] = [];
  for (const group of groups) {
    for (const option of group) {
      if (!option.value || seen.has(option.value)) continue;
      seen.add(option.value);
      results.push(option);
    }
  }
  return results;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function inferTargetKindFromValue(
  channelType: string,
  target: string,
  chatType?: string,
): ChannelTargetOptionView['kind'] {
  const normalizedChatType = chatType?.trim().toLowerCase();
  if (normalizedChatType === 'group') return 'group';
  if (normalizedChatType === 'channel') return 'channel';
  if (target.startsWith('chat:') || target.includes(':group:')) return 'group';
  if (target.includes(':channel:')) return 'channel';
  if (channelType === 'dingtalk' && target.startsWith('cid')) return 'group';
  return 'user';
}

type JsonRecord = Record<string, unknown>;

function extractSessionRecords(store: JsonRecord): JsonRecord[] {
  const directEntries = Object.entries(store)
    .filter(([key, value]) => key !== 'sessions' && value && typeof value === 'object')
    .map(([, value]) => value as JsonRecord);
  const arrayEntries = Array.isArray(store.sessions)
    ? store.sessions.filter((entry): entry is JsonRecord => Boolean(entry && typeof entry === 'object'))
    : [];
  return [...directEntries, ...arrayEntries];
}

type SessionRecordEntry = {
  record: JsonRecord;
  sessionKey?: string;
};

type SessionDerivedWorkbenchRecord = {
  sessionKey: string;
  channelType: string;
  accountId: string;
  target: string;
  title: string;
  sessionType: WorkbenchSession['sessionType'];
  latestActivityAt?: string;
  updatedAt: number;
  visibleAgentId?: string;
};

function readInjectedSessionDerivedWorkbenchRecordsForTests(params: {
  channelType: string;
  accountId?: string;
}): SessionDerivedWorkbenchRecord[] {
  const injected = (globalThis as Record<string, unknown>)[TEST_DERIVED_WORKBENCH_RECORDS_KEY];
  const records = Array.isArray(injected)
    ? injected as SessionDerivedWorkbenchRecord[]
    : [];
  return records
    .filter((record) => record.channelType === params.channelType)
    .filter((record) => !params.accountId || record.accountId === params.accountId)
    .sort((left, right) => right.updatedAt - left.updatedAt || left.title.localeCompare(right.title));
}

function buildWorkbenchSessionFromDerivedRecord(record: SessionDerivedWorkbenchRecord): WorkbenchSession {
  return {
    id: `${record.channelType}:${record.accountId}:${record.target}`,
    channelId: `${record.channelType}-${record.accountId}`,
    channelType: record.channelType,
    sessionType: record.sessionType,
    title: record.title,
    pinned: false,
    syncState: 'synced',
    latestActivityAt: record.latestActivityAt,
    participantSummary: record.sessionType === 'group' ? 'synced group chat' : 'synced private chat',
    ...(record.visibleAgentId ? { visibleAgentId: record.visibleAgentId } : {}),
  };
}

function mergeWorkbenchSessionLists(...groups: WorkbenchSession[][]): WorkbenchSession[] {
  const merged = new Map<string, WorkbenchSession>();
  for (const group of groups) {
    for (const session of group) {
      const existing = merged.get(session.id);
      if (!existing) {
        merged.set(session.id, session);
        continue;
      }
      merged.set(session.id, {
        ...session,
        ...existing,
        title: existing.title || session.title,
        previewText: existing.previewText || session.previewText,
        participantSummary: existing.participantSummary || session.participantSummary,
        visibleAgentId: existing.visibleAgentId || session.visibleAgentId,
        latestActivityAt: existing.latestActivityAt || session.latestActivityAt,
        pinned: existing.pinned || session.pinned,
      });
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    const leftTs = Date.parse(left.latestActivityAt ?? '') || 0;
    const rightTs = Date.parse(right.latestActivityAt ?? '') || 0;
    if (leftTs !== rightTs) return rightTs - leftTs;
    return left.title.localeCompare(right.title);
  });
}

async function findDerivedWorkbenchRecordForConversation(
  conversationId: string,
  channelType: 'feishu' | 'wechat',
): Promise<SessionDerivedWorkbenchRecord | undefined> {
  const target = parseWorkbenchConversationTarget(conversationId);
  if (!target || target.channelType !== channelType) {
    return undefined;
  }
  const records = await listSessionDerivedWorkbenchRecords({
    channelType,
    accountId: target.accountId,
  });
  return records.find((record) => record.target === target.externalConversationId);
}

function extractSessionRecordEntries(store: JsonRecord): SessionRecordEntry[] {
  const directEntries = Object.entries(store)
    .filter(([key, value]) => key !== 'sessions' && value && typeof value === 'object')
    .map(([key, value]) => ({
      sessionKey: key,
      record: value as JsonRecord,
    }));
  const arrayEntries = Array.isArray(store.sessions)
    ? store.sessions
      .filter((entry): entry is JsonRecord => Boolean(entry && typeof entry === 'object'))
      .map((entry) => ({
        sessionKey: readNonEmptyString(entry.key) || readNonEmptyString(entry.sessionKey),
        record: entry,
      }))
    : [];
  return [...directEntries, ...arrayEntries];
}

function parseAgentIdFromSessionKey(sessionKey: string | undefined): string | undefined {
  if (!sessionKey?.startsWith('agent:')) return undefined;
  const parts = sessionKey.split(':');
  return parts[1]?.trim() || undefined;
}

async function listSessionDerivedWorkbenchRecords(params: {
  channelType: string;
  accountId?: string;
}): Promise<SessionDerivedWorkbenchRecord[]> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return readInjectedSessionDerivedWorkbenchRecordsForTests(params);
  }
  const storedChannelType = toOpenClawChannelType(params.channelType);
  const agentsDir = join(getOpenClawConfigDir(), 'agents');
  const agentDirs = await readdir(agentsDir, { withFileTypes: true }).catch(() => []);
  const candidates: SessionDerivedWorkbenchRecord[] = [];
  const seen = new Set<string>();

  for (const entry of agentDirs) {
    if (!entry.isDirectory()) continue;
    const sessionsPath = join(agentsDir, entry.name, 'sessions', 'sessions.json');
    const raw = await readFile(sessionsPath, 'utf8').catch(() => '');
    if (!raw.trim()) continue;

    let parsed: JsonRecord;
    try {
      parsed = JSON.parse(raw) as JsonRecord;
    } catch {
      continue;
    }

    for (const item of extractSessionRecordEntries(parsed)) {
      const session = item.record;
      const deliveryContext = session.deliveryContext && typeof session.deliveryContext === 'object'
        ? session.deliveryContext as JsonRecord
        : undefined;
      const origin = session.origin && typeof session.origin === 'object'
        ? session.origin as JsonRecord
        : undefined;
      const sessionChannelType = readNonEmptyString(deliveryContext?.channel)
        || readNonEmptyString(session.lastChannel)
        || readNonEmptyString(session.channel)
        || readNonEmptyString(origin?.provider)
        || readNonEmptyString(origin?.surface);
      if (!sessionChannelType || toOpenClawChannelType(sessionChannelType) !== storedChannelType) {
        continue;
      }

      const sessionAccountId = readNonEmptyString(deliveryContext?.accountId)
        || readNonEmptyString(session.lastAccountId)
        || readNonEmptyString(origin?.accountId)
        || 'default';
      if (params.accountId && sessionAccountId !== params.accountId) {
        continue;
      }

      const target = readNonEmptyString(deliveryContext?.to)
        || readNonEmptyString(session.lastTo)
        || readNonEmptyString(origin?.to);
      const sessionKey = item.sessionKey || readNonEmptyString(session.sessionKey) || readNonEmptyString(session.key);
      if (!target || !sessionKey) continue;

      const conversationId = `${toUiChannelType(storedChannelType)}:${sessionAccountId}:${target}`;
      if (seen.has(conversationId)) continue;
      seen.add(conversationId);

      const targetKind = inferTargetKindFromValue(
        storedChannelType,
        target,
        readNonEmptyString(session.chatType) || readNonEmptyString(origin?.chatType),
      );
      const updatedAt = typeof session.updatedAt === 'number' ? session.updatedAt : 0;
      candidates.push({
        sessionKey,
        channelType: toUiChannelType(storedChannelType),
        accountId: sessionAccountId,
        target,
        title: readNonEmptyString(session.displayName)
          || readNonEmptyString(session.subject)
          || readNonEmptyString(origin?.label)
          || target,
        sessionType: targetKind === 'group' || targetKind === 'channel' ? 'group' : 'private',
        latestActivityAt: updatedAt > 0 ? new Date(updatedAt).toISOString() : undefined,
        updatedAt,
        visibleAgentId: parseAgentIdFromSessionKey(sessionKey),
      });
    }
  }

  return candidates.sort((left, right) => right.updatedAt - left.updatedAt || left.title.localeCompare(right.title));
}

async function listSessionDerivedTargetOptions(params: {
  channelType: string;
  accountId?: string;
  query?: string;
}): Promise<ChannelTargetOptionView[]> {
  const storedChannelType = toOpenClawChannelType(params.channelType);
  const agentsDir = join(getOpenClawConfigDir(), 'agents');
  const agentDirs = await readdir(agentsDir, { withFileTypes: true }).catch(() => []);
  const q = params.query?.trim().toLowerCase() || '';
  const candidates: Array<ChannelTargetOptionView & { updatedAt: number }> = [];
  const seen = new Set<string>();

  for (const entry of agentDirs) {
    if (!entry.isDirectory()) continue;
    const sessionsPath = join(agentsDir, entry.name, 'sessions', 'sessions.json');
    const raw = await readFile(sessionsPath, 'utf8').catch(() => '');
    if (!raw.trim()) continue;

    let parsed: JsonRecord;
    try {
      parsed = JSON.parse(raw) as JsonRecord;
    } catch {
      continue;
    }

    for (const session of extractSessionRecords(parsed)) {
      const deliveryContext = session.deliveryContext && typeof session.deliveryContext === 'object'
        ? session.deliveryContext as JsonRecord
        : undefined;
      const origin = session.origin && typeof session.origin === 'object'
        ? session.origin as JsonRecord
        : undefined;
      const sessionChannelType = readNonEmptyString(deliveryContext?.channel)
        || readNonEmptyString(session.lastChannel)
        || readNonEmptyString(session.channel)
        || readNonEmptyString(origin?.provider)
        || readNonEmptyString(origin?.surface);
      if (!sessionChannelType || toOpenClawChannelType(sessionChannelType) !== storedChannelType) {
        continue;
      }

      const sessionAccountId = readNonEmptyString(deliveryContext?.accountId)
        || readNonEmptyString(session.lastAccountId)
        || readNonEmptyString(origin?.accountId);
      if (params.accountId && sessionAccountId && sessionAccountId !== params.accountId) {
        continue;
      }
      if (params.accountId && !sessionAccountId) {
        continue;
      }

      const value = readNonEmptyString(deliveryContext?.to)
        || readNonEmptyString(session.lastTo)
        || readNonEmptyString(origin?.to);
      if (!value || seen.has(value)) continue;

      const labelBase = readNonEmptyString(session.displayName)
        || readNonEmptyString(session.subject)
        || readNonEmptyString(origin?.label)
        || value;
      const label = buildChannelTargetLabel(labelBase, value);
      if (q && !label.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) {
        continue;
      }

      seen.add(value);
      candidates.push({
        value,
        label,
        kind: inferTargetKindFromValue(
          storedChannelType,
          value,
          readNonEmptyString(session.chatType) || readNonEmptyString(origin?.chatType),
        ),
        updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : 0,
      });
    }
  }

  return candidates
    .sort((left, right) => right.updatedAt - left.updatedAt || left.label.localeCompare(right.label))
    .map(({ updatedAt: _updatedAt, ...option }) => option);
}

async function listWeComReqIdTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  const wecomDir = join(getOpenClawConfigDir(), 'wecom');
  const files = await readdir(wecomDir, { withFileTypes: true }).catch(() => []);
  const q = query?.trim().toLowerCase() || '';
  const options: ChannelTargetOptionView[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!file.isFile() || !file.name.startsWith('reqid-map-') || !file.name.endsWith('.json')) {
      continue;
    }

    const resolvedAccountId = file.name.slice('reqid-map-'.length, -'.json'.length);
    if (accountId && resolvedAccountId !== accountId) {
      continue;
    }

    const raw = await readFile(join(wecomDir, file.name), 'utf8').catch(() => '');
    if (!raw.trim()) continue;

    let records: Record<string, unknown>;
    try {
      records = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    for (const chatId of Object.keys(records)) {
      const trimmedChatId = chatId.trim();
      if (!trimmedChatId) continue;
      const value = `wecom:${trimmedChatId}`;
      const label = buildChannelTargetLabel('WeCom chat', value);
      if (q && !label.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) {
        continue;
      }
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({ value, label, kind: 'channel' });
    }
  }

  return options;
}

async function listWeComTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  const [reqIdTargets, sessionTargets] = await Promise.all([
    listWeComReqIdTargetOptions(accountId, query),
    listSessionDerivedTargetOptions({ channelType: 'wecom', accountId, query }),
  ]);
  return mergeTargetOptions(sessionTargets, reqIdTargets);
}

async function listDingTalkTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  return await listSessionDerivedTargetOptions({ channelType: 'dingtalk', accountId, query });
}

async function listWeChatTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  return await listSessionDerivedTargetOptions({ channelType: OPENCLAW_WECHAT_CHANNEL_TYPE, accountId, query });
}

type DirectoryEntry = {
  kind: 'user' | 'group' | 'channel';
  id: string;
  name?: string;
  handle?: string;
};

function buildDirectoryTargetOptions(
  entries: DirectoryEntry[],
  normalizeTarget: (target: string) => string | undefined,
): ChannelTargetOptionView[] {
  const results: ChannelTargetOptionView[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeTarget(entry.id) ?? entry.id;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push({
      value: normalized,
      label: buildChannelTargetLabel(entry.name || entry.handle || entry.id, normalized),
      kind: entry.kind,
    });
  }
  return results;
}

async function listConfigDirectoryTargetOptions(params: {
  channelType: 'discord' | 'telegram' | 'whatsapp';
  accountId?: string;
  query?: string;
}): Promise<ChannelTargetOptionView[]> {
  const cfg = await readOpenClawConfig();
  const commonParams = {
    cfg,
    accountId: params.accountId ?? null,
    query: params.query ?? null,
    limit: 100,
  };

  if (params.channelType === 'discord') {
    const [users, groups] = await Promise.all([
      listDiscordDirectoryPeersFromConfig(commonParams),
      listDiscordDirectoryGroupsFromConfig(commonParams),
    ]);
    return buildDirectoryTargetOptions(
      [...users, ...groups] as DirectoryEntry[],
      normalizeDiscordMessagingTarget,
    );
  }

  if (params.channelType === 'telegram') {
    const [users, groups] = await Promise.all([
      listTelegramDirectoryPeersFromConfig(commonParams),
      listTelegramDirectoryGroupsFromConfig(commonParams),
    ]);
    return buildDirectoryTargetOptions(
      [...users, ...groups] as DirectoryEntry[],
      normalizeTelegramMessagingTarget,
    );
  }

  return buildDirectoryTargetOptions([], normalizeWhatsAppMessagingTarget);
}

async function listQQBotKnownTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  const knownUsersPath = join(getOpenClawConfigDir(), 'qqbot', 'data', 'known-users.json');
  const raw = await readFile(knownUsersPath, 'utf8').catch(() => '');
  if (!raw.trim()) return [];

  let records: Array<{
    openid?: string;
    type?: 'c2c' | 'group';
    nickname?: string;
    groupOpenid?: string;
    accountId?: string;
    lastSeenAt?: number;
  }>;
  try {
    records = JSON.parse(raw) as typeof records;
  } catch {
    return [];
  }

  const q = query?.trim().toLowerCase() || '';
  const options: ChannelTargetOptionView[] = [];
  const seen = new Set<string>();
  const filtered = records
    .filter((record) => !accountId || record.accountId === accountId)
    .sort((left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0));

  for (const record of filtered) {
    if (record.type === 'group') {
      const groupId = (record.groupOpenid || record.openid || '').trim();
      if (!groupId) continue;
      const value = `qqbot:group:${groupId}`;
      const label = buildChannelTargetLabel(record.nickname || groupId, value);
      if (q && !label.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({ value, label, kind: 'group' });
      continue;
    }

    const userId = (record.openid || '').trim();
    if (!userId) continue;
    const value = `qqbot:c2c:${userId}`;
    const label = buildChannelTargetLabel(record.nickname || userId, value);
    if (q && !label.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label, kind: 'user' });
  }

  return options;
}

async function fetchFeishuTargetOptions(accountId?: string, query?: string): Promise<ChannelTargetOptionView[]> {
  const cfg = await readOpenClawConfig();
  const channels = cfg.channels && typeof cfg.channels === 'object'
    ? cfg.channels as Record<string, Record<string, unknown>>
    : {};
  const section = channels.feishu;
  if (!section) return [];

  const accountConfig = section.accounts && typeof section.accounts === 'object' && accountId
    ? (section.accounts as Record<string, Record<string, unknown>>)[accountId] ?? {}
    : {};
  const mergedConfig = { ...section, ...accountConfig };

  const appId = typeof mergedConfig.appId === 'string' ? mergedConfig.appId.trim() : '';
  const appSecret = typeof mergedConfig.appSecret === 'string' ? mergedConfig.appSecret.trim() : '';
  if (!appId || !appSecret) return [];

  const q = query?.trim().toLowerCase() || '';
  const headers = { 'Content-Type': 'application/json' };
  const tenantTokenResponse = await proxyAwareFetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers,
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tenantTokenPayload = await tenantTokenResponse.json() as { code?: number; tenant_access_token?: string };
  if (!tenantTokenResponse.ok || tenantTokenPayload.code !== 0 || !tenantTokenPayload.tenant_access_token) {
    return [];
  }

  const authHeaders = {
    Authorization: `Bearer ${tenantTokenPayload.tenant_access_token}`,
    'Content-Type': 'application/json',
  };

  const liveTargets: ChannelTargetOptionView[] = [];
  const userResponse = await proxyAwareFetch('https://open.feishu.cn/open-apis/contact/v3/users?page_size=100', { headers: authHeaders });
  const userPayload = await userResponse.json() as { code?: number; data?: { items?: Array<{ open_id?: string; name?: string }> } };
  if (userResponse.ok && userPayload.code === 0) {
    for (const item of userPayload.data?.items ?? []) {
      const value = normalizeFeishuTargetValue(item.open_id);
      if (!value) continue;
      const option = buildFeishuTargetOption(value, item.name, 'user');
      if (q && !option.label.toLowerCase().includes(q) && !option.value.toLowerCase().includes(q)) continue;
      liveTargets.push(option);
    }
  }

  const chatResponse = await proxyAwareFetch('https://open.feishu.cn/open-apis/im/v1/chats?page_size=100', { headers: authHeaders });
  const chatPayload = await chatResponse.json() as { code?: number; data?: { items?: Array<{ chat_id?: string; name?: string }> } };
  if (chatResponse.ok && chatPayload.code === 0) {
    for (const item of chatPayload.data?.items ?? []) {
      const value = normalizeFeishuTargetValue(item.chat_id);
      if (!value) continue;
      const option = buildFeishuTargetOption(value, item.name, 'group');
      if (q && !option.label.toLowerCase().includes(q) && !option.value.toLowerCase().includes(q)) continue;
      liveTargets.push(option);
    }
  }

  return mergeTargetOptions(liveTargets);
}

async function listChannelTargetOptions(params: {
  channelType: string;
  accountId?: string;
  query?: string;
}): Promise<ChannelTargetOptionView[]> {
  const storedChannelType = toOpenClawChannelType(params.channelType);
  if (storedChannelType === 'qqbot') {
    return await listQQBotKnownTargetOptions(params.accountId, params.query);
  }
  if (storedChannelType === 'feishu') {
    return await fetchFeishuTargetOptions(params.accountId, params.query);
  }
  if (storedChannelType === 'wecom') {
    return await listWeComTargetOptions(params.accountId, params.query);
  }
  if (storedChannelType === 'dingtalk') {
    return await listDingTalkTargetOptions(params.accountId, params.query);
  }
  if (storedChannelType === OPENCLAW_WECHAT_CHANNEL_TYPE) {
    return await listWeChatTargetOptions(params.accountId, params.query);
  }
  if (
    storedChannelType === 'discord'
    || storedChannelType === 'telegram'
    || storedChannelType === 'whatsapp'
  ) {
    return await listConfigDirectoryTargetOptions({
      channelType: storedChannelType,
      accountId: params.accountId,
      query: params.query,
    });
  }
  return [];
}

export async function handleChannelRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/channels/accounts' && req.method === 'GET') {
    try {
      const channels = await buildChannelAccountsView(ctx);
      sendJson(res, 200, { success: true, channels });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/targets' && req.method === 'GET') {
    try {
      const channelType = url.searchParams.get('channelType')?.trim() || '';
      const accountId = url.searchParams.get('accountId')?.trim() || undefined;
      const query = url.searchParams.get('query')?.trim() || undefined;
      if (!channelType) {
        sendJson(res, 400, { success: false, error: 'channelType is required' });
        return true;
      }

      const targets = await listChannelTargetOptions({ channelType, accountId, query });
      sendJson(res, 200, { success: true, channelType, accountId, targets });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/default-account' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string }>(req);
      await setChannelDefaultAccount(body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:setDefaultAccount:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/binding' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string; agentId: string }>(req);
      await assignChannelAccountToAgent(body.agentId, toOpenClawChannelType(body.channelType), body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:setBinding:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/binding' && req.method === 'DELETE') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string }>(req);
      await clearChannelBinding(toOpenClawChannelType(body.channelType), body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:clearBinding:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/capabilities' && req.method === 'GET') {
    try {
      const allCapabilities = await listNormalizedCapabilities(ctx);
      const requestedChannelId = url.searchParams.get('channelId');
      const capabilities = requestedChannelId
        ? allCapabilities.filter((item) => item.channelId === requestedChannelId)
        : allCapabilities;
      sendJson(res, 200, { success: true, capabilities });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), capabilities: [] });
    }
    return true;
  }

  if (url.pathname === '/api/channels/workbench/sessions' && req.method === 'GET') {
    try {
      const channelType = url.searchParams.get('channelType')?.trim() || '';
      const accountId = url.searchParams.get('accountId')?.trim() || undefined;
      if (!channelType) {
        sendJson(res, 400, { success: false, error: 'channelType is required', sessions: [] });
        return true;
      }
      if (channelType === 'feishu') {
        const [liveSnapshot, derivedRecords] = await Promise.all([
          fetchFeishuWorkbenchSnapshot().catch(() => ({ sessions: [], messagesByConversationId: new Map() })),
          listSessionDerivedWorkbenchRecords({ channelType, accountId }),
        ]);
        const filteredFeishuSessions = liveSnapshot.sessions
          .filter((session) => !accountId || session.channelId === `feishu-${accountId}`);
        const liveSessions = (
          await Promise.all(
            filteredFeishuSessions.map(async (session) => {
              const target = parseWorkbenchConversationTarget(session.id);
              if (!target) return session;
              const binding = await getConversationBinding(
                target.channelType,
                target.accountId,
                target.externalConversationId,
              );
              return applyWorkbenchBindingMetadata(session, binding);
            }),
          )
        ).filter((session): session is WorkbenchSession => session != null);
        const derivedSessions = (
          await Promise.all(
            derivedRecords.map(async (record) => {
              const binding = await getConversationBinding(
                record.channelType,
                record.accountId,
                record.target,
              );
              return applyWorkbenchBindingMetadata(buildWorkbenchSessionFromDerivedRecord(record), binding);
            }),
          )
        ).filter((session): session is WorkbenchSession => session != null);
        const sessions = mergeWorkbenchSessionLists(liveSessions, derivedSessions);
        if (sessions.length > 0) {
          sendJson(res, 200, {
            success: true,
            sessions,
          });
          return true;
        }
      }
      if (channelType === 'wechat') {
        const derivedRecords = await listSessionDerivedWorkbenchRecords({ channelType, accountId });
        if (derivedRecords.length > 0) {
          const sessions = (
            await Promise.all(
              derivedRecords.map(async (record) => {
                const session: WorkbenchSession = {
                  id: `${record.channelType}:${record.accountId}:${record.target}`,
                  channelId: `${record.channelType}-${record.accountId}`,
                  channelType: record.channelType,
                  sessionType: record.sessionType,
                  title: record.title,
                  pinned: false,
                  syncState: 'synced',
                  latestActivityAt: record.latestActivityAt,
                  participantSummary: record.sessionType === 'group' ? '已同步群聊' : '已同步私聊',
                  visibleAgentId: record.visibleAgentId,
                };
                const binding = await getConversationBinding(
                  record.channelType,
                  record.accountId,
                  record.target,
                );
                return applyWorkbenchBindingMetadata(session, binding);
              }),
            )
          ).filter((session): session is WorkbenchSession => session != null);
          sendJson(res, 200, {
            success: true,
            sessions,
          });
          return true;
        }
      }
      const statusSnapshot = await ctx.gatewayManager.rpc<ChannelsStatusSnapshot>('channels.status', { probe: true }).catch(() => null);
      const baseSessions = buildWorkbenchSessions(channelType, statusSnapshot, accountId);
      const sessions = (
        await Promise.all(
          baseSessions.map(async (session) => {
            const target = parseWorkbenchConversationTarget(session.id);
            if (!target) return session;
            const binding = await getConversationBinding(
              target.channelType,
              target.accountId,
              target.externalConversationId,
            );
            return applyWorkbenchBindingMetadata(session, binding);
          }),
        )
      ).filter((session): session is WorkbenchSession => session != null);
      sendJson(res, 200, {
        success: true,
        sessions,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), sessions: [] });
    }
    return true;
  }

  const workbenchConversationMatch = /^\/api\/channels\/workbench\/conversations\/([^/]+)$/.exec(url.pathname);
  if (workbenchConversationMatch && req.method === 'PATCH') {
    try {
      const conversationId = decodeURIComponent(workbenchConversationMatch[1]);
      const target = parseWorkbenchConversationTarget(conversationId);
      if (!target) {
        sendJson(res, 400, { success: false, error: 'Invalid conversationId' });
        return true;
      }
      const body = await parseJsonBody<{ title?: string }>(req);
      const title = body.title?.trim();
      if (!title) {
        sendJson(res, 400, { success: false, error: 'title is required' });
        return true;
      }
      const binding = target.channelType === 'feishu'
        ? await resolveFeishuBindingForConversation(conversationId, undefined, { createIfMissing: true, sessionType: 'group' })
        : target.channelType === 'wechat'
          ? await resolveWeChatBindingForConversation(conversationId, undefined, { createIfMissing: true, sessionType: 'group' })
          : await resolveScopedConversationBinding(target, 'group', undefined, { createIfMissing: true });
      if (!binding) {
        sendJson(res, 404, { success: false, error: 'Conversation binding not found' });
        return true;
      }
      await channelConversationBindings.upsert({
        ...binding.binding,
        displayTitle: title,
        hidden: false,
      });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (workbenchConversationMatch && req.method === 'DELETE') {
    try {
      const conversationId = decodeURIComponent(workbenchConversationMatch[1]);
      const target = parseWorkbenchConversationTarget(conversationId);
      if (!target) {
        sendJson(res, 400, { success: false, error: 'Invalid conversationId' });
        return true;
      }
      const binding = target.channelType === 'feishu'
        ? await resolveFeishuBindingForConversation(conversationId, undefined, { createIfMissing: true, sessionType: 'group' })
        : target.channelType === 'wechat'
          ? await resolveWeChatBindingForConversation(conversationId, undefined, { createIfMissing: true, sessionType: 'group' })
          : await resolveScopedConversationBinding(target, 'group', undefined, { createIfMissing: true });
      if (!binding) {
        sendJson(res, 404, { success: false, error: 'Conversation binding not found' });
        return true;
      }
      await channelConversationBindings.upsert({
        ...binding.binding,
        hidden: true,
      });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/workbench/messages' && req.method === 'GET') {
    try {
      const conversationId = url.searchParams.get('conversationId')?.trim() || '';
      if (!conversationId) {
        sendJson(res, 400, { success: false, error: 'conversationId is required', conversation: null, messages: [] });
        return true;
      }
      if (conversationId.startsWith('feishu:')) {
        const liveSnapshot = await fetchFeishuWorkbenchSnapshot().catch(() => ({ sessions: [], messagesByConversationId: new Map() }));
        const discoveredConversation = liveSnapshot.sessions.find((session) => session.id === conversationId) ?? null;
        const derivedSession = await findDerivedWorkbenchRecordForConversation(conversationId, 'feishu');
        const resolvedConversation = discoveredConversation ?? (derivedSession ? buildWorkbenchSessionFromDerivedRecord(derivedSession) : null);
        const target = parseWorkbenchConversationTarget(conversationId);
        const existingBinding = target
          ? await getConversationBinding(target.channelType, target.accountId, target.externalConversationId)
          : null;
        let derivedBinding: ChannelConversationBindingRecord | null = null;
        if (target && derivedSession) {
          derivedBinding = await channelConversationBindings.upsert({
            channelType: target.channelType,
            accountId: target.accountId,
            externalConversationId: target.externalConversationId,
            agentId: existingBinding?.agentId || derivedSession.visibleAgentId || 'main',
            sessionKey: derivedSession.sessionKey,
            ...(existingBinding?.displayTitle ? { displayTitle: existingBinding.displayTitle } : {}),
            ...(existingBinding?.hidden ? { hidden: existingBinding.hidden } : {}),
          }).catch(() => existingBinding);
        }
        let binding = await resolveFeishuBindingForConversation(
          conversationId,
          resolvedConversation?.visibleAgentId,
          { createIfMissing: false, sessionType: resolvedConversation?.sessionType },
        ).catch(() => null);
        if (derivedBinding?.sessionKey) {
          binding = {
            sessionKey: derivedBinding.sessionKey,
            agentId: derivedBinding.agentId || derivedSession?.visibleAgentId || 'main',
            binding: derivedBinding,
          };
        }

        const shouldCreateBindingOnRead = Boolean(resolvedConversation) && !derivedSession;

        if (!binding && shouldCreateBindingOnRead) {
          binding = await resolveFeishuBindingForConversation(
            conversationId,
            resolvedConversation?.visibleAgentId,
            { createIfMissing: true, sessionType: resolvedConversation?.sessionType },
          ).catch(() => null);
        }

        if (binding?.sessionKey) {
          const runtimePayload = await ctx.gatewayManager.rpc<unknown>('chat.history', {
            sessionKey: binding.sessionKey,
            limit: 200,
          }).catch(() => null);
          let runtimeMessages = runtimePayload
            ? mapRuntimeHistoryToWorkbenchMessages(runtimePayload, 'feishu')
            : [];

          const fallbackMessages = liveSnapshot.messagesByConversationId.get(conversationId) ?? [];
          const merged = mergeWorkbenchMessages(runtimeMessages, fallbackMessages);

          sendJson(res, 200, {
            success: true,
            conversation: applyWorkbenchConversationBindingMetadata(
              buildFeishuConversationPayload(conversationId, resolvedConversation, binding.agentId),
              binding.binding ?? derivedBinding ?? existingBinding,
            ),
            messages: merged.length > 0 ? merged : fallbackMessages,
          });
          return true;
        }

        if (resolvedConversation) {
          sendJson(res, 200, {
            success: true,
            conversation: applyWorkbenchConversationBindingMetadata(
              buildFeishuConversationPayload(conversationId, resolvedConversation),
              derivedBinding ?? existingBinding,
            ),
            messages: liveSnapshot.messagesByConversationId.get(conversationId) ?? [],
          });
          return true;
        }

        sendJson(res, 200, {
          success: true,
          conversation: null,
          messages: [],
        });
        return true;
      }
      const channelType = resolveConversationChannelType(conversationId);
      const statusSnapshot = await ctx.gatewayManager.rpc<ChannelsStatusSnapshot>('channels.status', { probe: true }).catch(() => null);
      const sessions = buildWorkbenchSessions(channelType, statusSnapshot);
      const parsedWeChatConversation = parseWeChatConversationId(conversationId);
      const conversation = sessions.find((session) => session.id === conversationId)
        ?? (
          parsedWeChatConversation
            ? sessions.find((session) => session.channelId === `wechat-${parsedWeChatConversation.accountId}`) ?? null
            : null
        );
      const fallbackConversationTitle = parsedWeChatConversation?.externalConversationId || conversationId;
      sendJson(res, 200, {
        success: true,
        conversation: conversation
          ? {
            id: conversation.id,
            title: conversation.title,
            syncState: conversation.syncState,
            participantSummary: conversation.participantSummary,
            visibleAgentId: conversation.visibleAgentId,
          }
          : (
            parsedWeChatConversation
              ? {
                id: conversationId,
                title: fallbackConversationTitle,
                syncState: 'connecting',
                participantSummary: '等待同步会话',
                visibleAgentId: 'main',
              }
              : null
          ),
        messages: [],
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), conversation: null, messages: [] });
    }
    return true;
  }

  // Paginated messages: GET /api/channels/workbench/conversations/:id/messages?cursor=<createdAt>&limit=<n>
  const conversationMessagesMatch = /^\/api\/channels\/workbench\/conversations\/([^/]+)\/messages$/.exec(url.pathname);
  if (conversationMessagesMatch && req.method === 'GET') {
    try {
      const conversationId = decodeURIComponent(conversationMessagesMatch[1]);
      const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
      const cursor = url.searchParams.get('cursor')?.trim() || null;

      let allMessages: Array<Record<string, unknown>> = [];
      let conversationObj: WorkbenchConversationView | null = null;

      if (conversationId.startsWith('feishu:')) {
        const liveSnapshot = await fetchFeishuWorkbenchSnapshot().catch(() => ({ sessions: [], messagesByConversationId: new Map() }));
        const discoveredConversation = liveSnapshot.sessions.find((s) => s.id === conversationId) ?? null;
        const derivedSession = await findDerivedWorkbenchRecordForConversation(conversationId, 'feishu');
        const resolvedConversation = discoveredConversation ?? (derivedSession ? buildWorkbenchSessionFromDerivedRecord(derivedSession) : null);
        const target = parseWorkbenchConversationTarget(conversationId);
        const existingBinding = target
          ? await getConversationBinding(target.channelType, target.accountId, target.externalConversationId)
          : null;
        let derivedBinding: ChannelConversationBindingRecord | null = null;
        if (target && derivedSession) {
          derivedBinding = await channelConversationBindings.upsert({
            channelType: target.channelType,
            accountId: target.accountId,
            externalConversationId: target.externalConversationId,
            agentId: existingBinding?.agentId || derivedSession.visibleAgentId || 'main',
            sessionKey: derivedSession.sessionKey,
            ...(existingBinding?.displayTitle ? { displayTitle: existingBinding.displayTitle } : {}),
            ...(existingBinding?.hidden ? { hidden: existingBinding.hidden } : {}),
          }).catch(() => existingBinding);
        }
        let binding = await resolveFeishuBindingForConversation(
          conversationId,
          resolvedConversation?.visibleAgentId,
          { createIfMissing: false, sessionType: resolvedConversation?.sessionType },
        ).catch(() => null);
        if (derivedBinding?.sessionKey) {
          binding = {
            sessionKey: derivedBinding.sessionKey,
            agentId: derivedBinding.agentId || derivedSession?.visibleAgentId || 'main',
            binding: derivedBinding,
          };
        }

        if (!binding && resolvedConversation && !derivedSession) {
          binding = await resolveFeishuBindingForConversation(
            conversationId,
            resolvedConversation?.visibleAgentId,
            { createIfMissing: true, sessionType: resolvedConversation?.sessionType },
          ).catch(() => null);
        }

        let workbenchMessages: WorkbenchConversationMessage[] = [];
        if (binding?.sessionKey) {
          const runtimePayload = await ctx.gatewayManager.rpc<unknown>('chat.history', {
            sessionKey: binding.sessionKey,
            limit: 500,
          }).catch(() => null);
          workbenchMessages = runtimePayload ? mapRuntimeHistoryToWorkbenchMessages(runtimePayload, 'feishu') : [];
        }

        const snapshotMessages = liveSnapshot.messagesByConversationId.get(conversationId) ?? [];
        workbenchMessages = workbenchMessages.length > 0
          ? mergeWorkbenchMessages(workbenchMessages, snapshotMessages)
          : snapshotMessages;

        allMessages = workbenchMessages as unknown as Array<Record<string, unknown>>;
        conversationObj = applyWorkbenchConversationBindingMetadata(
          buildFeishuConversationPayload(conversationId, resolvedConversation, binding?.agentId),
          binding?.binding ?? derivedBinding ?? existingBinding,
        );
      } else {
        const channelType = resolveConversationChannelType(conversationId);
        const statusSnap = await ctx.gatewayManager.rpc<ChannelsStatusSnapshot>('channels.status', { probe: true }).catch(() => null);
        const sessions = buildWorkbenchSessions(channelType, statusSnap);
        const target = parseWorkbenchConversationTarget(conversationId);
        const existingBinding = target
          ? await getConversationBinding(target.channelType, target.accountId, target.externalConversationId)
          : null;
        const derivedSession = channelType === 'wechat' && target
          ? (await listSessionDerivedWorkbenchRecords({ channelType, accountId: target.accountId }))
            .find((record) => record.target === target.externalConversationId)
          : undefined;
        const session = sessions.find((s) => s.id === conversationId)
          ?? (
            target
              ? sessions.find((s) => s.channelId === `${target.channelType}-${target.accountId}`) ?? null
              : null
          );
        if (session || target) {
          const resolvedConversationId = session?.id ?? conversationId;
          const resolvedConversationTitle = derivedSession?.title
            ?? session?.title
            ?? target?.externalConversationId
            ?? conversationId;
          conversationObj = applyWorkbenchConversationBindingMetadata({
            id: target ? conversationId : resolvedConversationId,
            title: resolvedConversationTitle,
            syncState: session?.syncState ?? 'connecting',
            ...(session?.participantSummary ? { participantSummary: session.participantSummary } : {}),
            ...((derivedSession?.visibleAgentId || session?.visibleAgentId)
              ? { visibleAgentId: derivedSession?.visibleAgentId || session?.visibleAgentId }
              : {}),
          }, existingBinding);
          if (target) {
            if (derivedSession) {
              await channelConversationBindings.upsert({
                channelType: target.channelType,
                accountId: target.accountId,
                externalConversationId: target.externalConversationId,
                agentId: derivedSession.visibleAgentId || 'main',
                sessionKey: derivedSession.sessionKey,
                ...(existingBinding?.displayTitle ? { displayTitle: existingBinding.displayTitle } : {}),
                ...(existingBinding?.hidden ? { hidden: existingBinding.hidden } : {}),
              }).catch(() => undefined);
            }
            const binding = derivedSession
              ? {
                sessionKey: derivedSession.sessionKey,
                agentId: derivedSession.visibleAgentId || 'main',
              }
              : target.channelType === 'wechat'
                ? await resolveWeChatBindingForConversation(conversationId, session?.visibleAgentId, { createIfMissing: true, sessionType: session?.sessionType })
                : await resolveScopedConversationBinding(target, session?.sessionType ?? 'group', session?.visibleAgentId, { createIfMissing: true });
            if (binding?.sessionKey) {
              const payload = await ctx.gatewayManager.rpc<unknown>('chat.history', { sessionKey: binding.sessionKey, limit: 500 }).catch(() => null);
              if (payload) {
                const msgs = mapRuntimeHistoryToWorkbenchMessages(payload, target.channelType);
                const visible = msgs.filter((m) => m.role !== 'system' || !m.internal);
                if (visible.length > 0) {
                  allMessages = visible as unknown as Array<Record<string, unknown>>;
                }
              }
            }
          }
        }
      }

      // Apply cursor-based pagination (older messages before cursor createdAt)
      const typed = allMessages as unknown as WorkbenchConversationMessage[];
      let filtered = typed;
      if (cursor) {
        const cursorMs = Date.parse(cursor);
        if (Number.isFinite(cursorMs)) {
          filtered = typed.filter((m) => {
            const ts = Date.parse(m.createdAt ?? '');
            return Number.isFinite(ts) && ts < cursorMs;
          });
        }
      }

      const page = filtered.slice(-limit);
      const hasMore = filtered.length > limit;

      sendJson(res, 200, { success: true, conversation: conversationObj, messages: page, hasMore, nextCursor: page[0]?.createdAt ?? null });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), messages: [], hasMore: false, nextCursor: null });
    }
    return true;
  }

  // Media proxy: GET /api/channels/workbench/media?url=<encoded-url>
  // SSRF guard: only .feishu.cn and .larksuite.com origins are allowed.
  if (url.pathname === '/api/channels/workbench/media' && req.method === 'GET') {
    try {
      const rawUrl = url.searchParams.get('url')?.trim() || '';
      if (!rawUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'url parameter is required' }));
        return true;
      }

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(rawUrl);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid URL' }));
        return true;
      }

      // SSRF guard — only allow Feishu / Lark CDN domains
      const allowedSuffixes = ['.feishu.cn', '.larksuite.com'];
      const hostname = parsedTarget.hostname.toLowerCase();
      const isAllowed = allowedSuffixes.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
      if (!isAllowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'URL origin not allowed' }));
        return true;
      }

      // Only allow https
      if (parsedTarget.protocol !== 'https:') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Only HTTPS URLs are allowed' }));
        return true;
      }

      const { net } = await import('electron');
      const upstream = net.fetch(rawUrl);
      const upstreamRes = await upstream;

      if (!upstreamRes.ok) {
        res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Upstream error: ${upstreamRes.status}` }));
        return true;
      }

      const contentType = upstreamRes.headers.get('content-type') ?? 'application/octet-stream';
      const contentLength = upstreamRes.headers.get('content-length');
      const responseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      };
      if (contentLength) responseHeaders['Content-Length'] = contentLength;

      res.writeHead(200, responseHeaders);
      const buffer = await upstreamRes.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
    }
    return true;
  }

  // WeChat media proxy: GET /api/channels/workbench/wechat/media?url=<encoded-url>&accountId=<accountId>
  // WeChat CDN media is AES-128-ECB encrypted — cannot be directly proxied.
  // Must call plugin's downloadRemoteImageToTemp to decrypt to a temp file.
  if (url.pathname === '/api/channels/workbench/wechat/media' && req.method === 'GET') {
    try {
      const rawUrl = url.searchParams.get('url')?.trim() || '';
      const accountId = url.searchParams.get('accountId')?.trim() || 'default';
      if (!rawUrl) {
        sendJson(res, 400, { success: false, error: 'url parameter is required' });
        return true;
      }
      let parsedTarget: URL;
      try {
        parsedTarget = new URL(rawUrl);
      } catch {
        sendJson(res, 400, { success: false, error: 'Invalid URL' });
        return true;
      }
      // SSRF guard — only allow WeChat CDN domains
      const allowedWeChatSuffixes = ['.qpic.cn', '.weixin.qq.com', '.wx.qq.com'];
      const hostname = parsedTarget.hostname.toLowerCase();
      const isAllowed = allowedWeChatSuffixes.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
      if (!isAllowed) {
        sendJson(res, 400, { success: false, error: 'URL not allowed: only WeChat CDN domains are permitted' });
        return true;
      }
      const pluginModule = await importWeChatPluginModule('index.js').catch(() => null);
      const downloadFn = pluginModule?.downloadRemoteImageToTemp as
        | ((url: string, accountId: string) => Promise<{ path: string; mimeType?: string }>) | undefined;
      if (!downloadFn) {
        sendJson(res, 503, { success: false, error: 'WeChat media download unavailable' });
        return true;
      }
      const result = await downloadFn(rawUrl, accountId);
      const fileBuffer = await readFile(result.path);
      const contentType = result.mimeType || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(fileBuffer);
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
    }
    return true;
  }

  if (url.pathname === '/api/channels/configured' && req.method === 'GET') {
    sendJson(res, 200, { success: true, channels: await listConfiguredChannels() });
    return true;
  }

  if (url.pathname === '/api/channels/config/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string }>(req);
      sendJson(res, 200, { success: true, ...(await validateChannelConfig(body.channelType)) });
    } catch (error) {
      sendJson(res, 500, { success: false, valid: false, errors: [String(error)], warnings: [] });
    }
    return true;
  }

  if (url.pathname === '/api/channels/credentials/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string; config: Record<string, string> }>(req);
      sendJson(res, 200, { success: true, ...(await validateChannelCredentials(body.channelType, body.config)) });
    } catch (error) {
      sendJson(res, 500, { success: false, valid: false, errors: [String(error)], warnings: [] });
    }
    return true;
  }

  if (url.pathname === '/api/channels/whatsapp/start' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ accountId: string }>(req);
      if (!(await ensureKnownScopedAccountId(body.accountId))) {
        sendJson(res, 404, { success: false, error: 'Scoped channel account not found' });
        return true;
      }
      await whatsAppLoginManager.start(body.accountId);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/wechat/qr' && req.method === 'GET') {
    try {
      await cleanupDanglingWeChatPluginState();
      await weChatLoginManager.start();
      const state = weChatLoginManager.getState();
      if (!state) {
        sendJson(res, 500, { success: false, error: 'Failed to generate QR code: no state' });
        return true;
      }
      if (state.status === 'error') {
        sendJson(res, 500, { success: false, error: state.error || state.message || 'Unknown error' });
        return true;
      }
      if (!state.qrcode) {
        sendJson(res, 500, { success: false, error: 'Failed to generate QR code: empty qrcode' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        qrcode: state.qrcode,
        qrcodeUrl: state.qrcodeUrl,
        sessionKey: state.sessionKey,
        connected: state.connected,
        status: state.status,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/wechat/qr/status' && req.method === 'GET') {
    const state = weChatLoginManager.getState();
    if (!state) {
      sendJson(res, 200, { success: true, sessionKey: 'wechat-login', status: 'idle', connected: false });
      return true;
    }
    sendJson(res, 200, {
      success: true,
      sessionKey: state.sessionKey,
      status: state.status,
      connected: state.connected,
      accountId: state.accountId,
      message: state.message,
      error: state.error,
    });
    return true;
  }

  if (url.pathname === '/api/channels/wechat/cancel' && req.method === 'POST') {
    weChatLoginManager.stop();
    sendJson(res, 200, { success: true });
    return true;
  }

  if (url.pathname === '/api/channels/config' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string; config: Record<string, unknown>; accountId?: string }>(req);
      if (!(await ensureKnownScopedAccountId(body.accountId))) {
        sendJson(res, 404, { success: false, error: 'Scoped channel account not found' });
        return true;
      }
      if (body.channelType === 'dingtalk') {
        const installResult = await ensureDingTalkPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'DingTalk plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'wecom') {
        const installResult = await ensureWeComPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'WeCom plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'qqbot') {
        const installResult = await ensureQQBotPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'QQ Bot plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'feishu') {
        const installResult = await ensureFeishuPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'Feishu plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'wechat') {
        const installResult = ensureWeChatPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'WeChat plugin install failed' });
          return true;
        }
      }
      const existingValues = await getChannelFormValues(body.channelType, body.accountId);
      if (isSameConfigValues(existingValues, body.config)) {
        await ensureScopedChannelBinding(body.channelType, body.accountId);
        sendJson(res, 200, { success: true, noChange: true });
        return true;
      }
      await saveChannelConfig(body.channelType, body.config, body.accountId);
      await ensureScopedChannelBinding(body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:saveConfig:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/config/enabled' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; enabled: boolean }>(req);
      await setChannelEnabled(body.channelType, body.enabled);
      scheduleGatewayChannelRestart(ctx, `channel:setEnabled:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/channels/config/') && req.method === 'GET') {
    try {
      const channelType = decodeURIComponent(url.pathname.slice('/api/channels/config/'.length));
      const accountId = url.searchParams.get('accountId') || undefined;
      if (!(await ensureKnownScopedAccountId(accountId))) {
        sendJson(res, 404, { success: false, error: 'Scoped channel account not found' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        values: await getChannelFormValues(channelType, accountId),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/channels/config/') && req.method === 'DELETE') {
    try {
      const channelType = decodeURIComponent(url.pathname.slice('/api/channels/config/'.length));
      const accountId = url.searchParams.get('accountId') || undefined;
      if (!(await ensureKnownScopedAccountId(accountId))) {
        sendJson(res, 404, { success: false, error: 'Scoped channel account not found' });
        return true;
      }
      if (accountId) {
        await deleteChannelAccountConfig(channelType, accountId);
        await clearChannelBinding(channelType, accountId);
        scheduleGatewayChannelRestart(ctx, `channel:deleteConfig:${channelType}:${accountId}`);
      } else {
        await deleteChannelConfig(channelType);
        await clearAllBindingsForChannel(channelType);
        scheduleGatewayChannelRestart(ctx, `channel:deleteConfig:${channelType}`);
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // POST /api/channels/:id/test — send a test message via the gateway
  const testMatch = url.pathname.match(/^\/api\/channels\/([^/]+)\/test$/);
  if (testMatch && req.method === 'POST') {
    const channelId = decodeURIComponent(testMatch[1]);
    try {
      const status = ctx.gatewayManager.getStatus();
      if (status.state !== 'running') {
        sendJson(res, 503, { success: false, error: 'Gateway is not running' });
        return true;
      }
      const capabilities = await listNormalizedCapabilities(ctx);
      const resolvedCapability = resolveRequestedCapability(capabilities, channelId);
      if (!resolvedCapability.ok) {
        sendJson(res, resolvedCapability.statusCode, { success: false, error: resolvedCapability.error });
        return true;
      }
      const resolvedChannelId = resolvedCapability.capability.channelId;
      const rateKey = `${resolvedChannelId}:test`;
      const rateResult = checkChannelRateLimit(rateKey, CHANNEL_RATE_LIMITS.test);
      if (!rateResult.allowed) {
        sendRateLimitError(res, rateResult.retryAfterSeconds);
        return true;
      }
      // Attempt to send a test message via the gateway HTTP API
      const port = status.port ?? 3000;
      const http = await import('node:http');
      const payload = JSON.stringify({ channelId: resolvedChannelId, text: '✅ ClawCorp 测试消息 — 连接正常' });
      await new Promise<void>((resolve, reject) => {
        const req2 = http.request(
          { hostname: '127.0.0.1', port, path: '/api/channel/test', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
          (r) => { r.resume(); r.on('end', resolve); },
        );
        req2.on('error', reject);
        req2.write(payload);
        req2.end();
      });
      sendJson(res, 200, { success: true, message: '测试消息已发送' });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // POST /api/channels/:id/send — send a custom message via the gateway
  const sendMatch = url.pathname.match(/^\/api\/channels\/([^/]+)\/send$/);
  if (sendMatch && req.method === 'POST') {
    const channelId = decodeURIComponent(sendMatch[1]);
    try {
      const body = await parseJsonBody<{ text: string; conversationId?: string; identity?: 'bot' | 'self' }>(req);
      if (!body.text?.trim()) {
        sendJson(res, 400, { success: false, error: 'text is required' });
        return true;
      }
      // identity defaults to 'bot'; 'self' routes to user-identity send when available
      const sendIdentity: 'bot' | 'self' = body.identity === 'self' ? 'self' : 'bot';
      const status = ctx.gatewayManager.getStatus();
      if (status.state !== 'running') {
        sendJson(res, 503, { success: false, error: 'Gateway is not running' });
        return true;
      }
      const capabilities = await listNormalizedCapabilities(ctx);
      const resolvedCapability = resolveRequestedCapability(capabilities, channelId);
      if (!resolvedCapability.ok) {
        sendJson(res, resolvedCapability.statusCode, { success: false, error: resolvedCapability.error });
        return true;
      }
      const resolvedChannelId = resolvedCapability.capability.channelId;
      const rateKey = `${resolvedChannelId}:send`;
      const rateResult = checkChannelRateLimit(rateKey, CHANNEL_RATE_LIMITS.send);
      if (!rateResult.allowed) {
        sendRateLimitError(res, rateResult.retryAfterSeconds);
        return true;
      }
      if (body.conversationId?.startsWith('feishu:')) {
        const sendResult = await sendFeishuViaPreferredPath({
          directSend: async () => sendFeishuConversationMessage({
            conversationId: body.conversationId,
            text: body.text.trim(),
            identity: sendIdentity,
          }),
          runtimeSend: async () => {
            const binding = await resolveFeishuBindingForConversation(
              body.conversationId,
              undefined,
              { createIfMissing: true, sessionType: 'group' },
            ).catch(() => null);
            const sendSessionKey = binding?.sessionKey;
            if (!sendSessionKey) {
              throw new Error('Feishu runtime session binding not found');
            }
            const result = await ctx.gatewayManager.rpc<Record<string, unknown>>('chat.send', {
              sessionKey: sendSessionKey,
              message: body.text.trim(),
              idempotencyKey: randomUUID(),
            });
            return {
              sessionKey: sendSessionKey,
              runId: extractFirstStringValue(result, ['runId', 'run_id']),
            };
          },
        });
        sendJson(res, 200, sendResult.transport === 'runtime'
          ? {
            success: true,
            message: '消息已发送',
            runId: sendResult.runId,
            sessionKey: sendResult.sessionKey,
          }
          : {
            success: true,
            message: '消息已发送',
            messageId: sendResult.messageId,
            chatId: sendResult.chatId,
          });
        return true;
      }
      if (body.conversationId?.startsWith('wechat:')) {
        const wechatBinding = await resolveWeChatBindingForConversation(
          body.conversationId,
          undefined,
          { createIfMissing: true, sessionType: 'group' },
        ).catch(() => null);
        const wechatSessionKey = wechatBinding?.sessionKey;
        if (!wechatSessionKey) {
          sendJson(res, 404, { success: false, error: 'WeChat conversation binding not found' });
          return true;
        }
        await ctx.gatewayManager.rpc('chat.send', {
          sessionKey: wechatSessionKey,
          message: body.text.trim(),
          idempotencyKey: randomUUID(),
        });
        sendJson(res, 200, { success: true, message: '消息已发送' });
        return true;
      }
      const port = status.port ?? 3000;
      const http = await import('node:http');
      const payload = JSON.stringify({ channelId: resolvedChannelId, text: body.text.trim() });
      await new Promise<void>((resolve, reject) => {
        const req2 = http.request(
          { hostname: '127.0.0.1', port, path: '/api/channel/send', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
          (r) => { r.resume(); r.on('end', resolve); },
        );
        req2.on('error', reject);
        req2.write(payload);
        req2.end();
      });
      sendJson(res, 200, { success: true, message: '消息已发送' });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // GET /api/channels/workbench/members?sessionId= — return group member list for @mention popover
  // GET /api/channels/workbench/wechat/members?sessionId= — WeChat group member list
  if (url.pathname === '/api/channels/workbench/wechat/members' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      sendJson(res, 400, { success: false, error: 'sessionId is required', members: [] });
      return true;
    }
    try {
      const pluginModule = await importWeChatPluginModule('index.js').catch(() => null);
      const getGroupMembers = pluginModule?.getGroupMembers as ((params: {
        cfg: Record<string, unknown>;
        chatId: string;
        accountId?: string;
      }) => Promise<Array<{ openId: string; name: string }>>) | undefined;
      if (!getGroupMembers) {
        sendJson(res, 200, { success: true, members: [] });
        return true;
      }
      const parts = sessionId.split(':');
      const accountId = parts[1] ?? 'default';
      const chatId = parts[2] ?? sessionId;
      const config = await readOpenClawConfigJson();
      if (!config) {
        sendJson(res, 200, { success: true, members: [] });
        return true;
      }
      const members = await getGroupMembers({ cfg: config, chatId, accountId });
      sendJson(res, 200, { success: true, members: Array.isArray(members) ? members : [] });
    } catch (error) {
      sendJson(res, 200, { success: true, members: [], error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/workbench/members' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      sendJson(res, 400, { success: false, error: 'sessionId is required', members: [] });
      return true;
    }
    try {
      const pluginModule = await importFeishuPluginModule('index.js').catch(() => null);
      const getGroupMembers = pluginModule?.getGroupMembers as ((params: {
        cfg: Record<string, unknown>;
        chatId: string;
        accountId?: string;
      }) => Promise<Array<{ openId: string; name: string }>>) | undefined;

      if (!getGroupMembers) {
        // Plugin doesn't export getGroupMembers — return empty list gracefully
        sendJson(res, 200, { success: true, members: [] });
        return true;
      }

      // sessionId format: feishu:<accountId>:<chatId>
      const parts = sessionId.split(':');
      const accountId = parts[1] ?? 'default';
      const chatId = parts[2] ?? sessionId;
      const config = await readOpenClawConfigJson();
      if (!config) {
        sendJson(res, 200, { success: true, members: [] });
        return true;
      }

      const members = await getGroupMembers({ cfg: config, chatId, accountId });
      sendJson(res, 200, { success: true, members: Array.isArray(members) ? members : [] });
    } catch (error) {
      sendJson(res, 200, { success: true, members: [], error: String(error) });
    }
    return true;
  }

  void ctx;
  return false;
}
