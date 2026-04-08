import { randomUUID } from 'node:crypto';

export type RuntimeSessionStatus =
  | 'running'
  | 'blocked'
  | 'waiting_approval'
  | 'error'
  | 'completed'
  | 'killed';
export type RuntimeSessionMode = 'session' | 'thread';

export interface RuntimeHistoryMessage {
  role: string;
  content: unknown;
  timestamp?: number;
  id?: string;
  toolCallId?: string;
  toolName?: string;
  details?: unknown;
  isError?: boolean;
}

export type RuntimeToolExecutionStatus = 'running' | 'completed' | 'error';

export interface RuntimeToolExecutionRecord {
  id: string;
  toolCallId?: string;
  toolName: string;
  status: RuntimeToolExecutionStatus;
  summary?: string;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  details?: unknown;
  linkedRuntimeId?: string;
  linkedRuntimeSessionKey?: string;
}

export interface RuntimeSessionRecord {
  id: string;
  parentSessionKey: string;
  parentRuntimeId?: string;
  rootRuntimeId: string;
  depth: number;
  sessionKey: string;
  mode: RuntimeSessionMode;
  prompt: string;
  agentName?: string;
  attachments: string[];
  sandbox?: string;
  timeoutMs?: number;
  status: RuntimeSessionStatus;
  runId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  history: RuntimeHistoryMessage[];
  transcript: string[];
  executionRecords: RuntimeToolExecutionRecord[];
  childRuntimeIds: string[];
  toolSnapshot: Array<{ server: string; name: string }>;
  skillSnapshot: string[];
}

export interface SpawnRuntimeSessionInput {
  parentSessionKey: string;
  parentRuntimeId?: string;
  prompt: string;
  mode?: RuntimeSessionMode;
  agentName?: string;
  attachments?: string[];
  sandbox?: string;
  timeoutMs?: number;
}

interface GatewayRpcClient {
  rpc<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
}

interface RuntimeSessionSnapshot {
  sessionKey: string;
  status?: string;
  runId?: string;
  lastError?: string;
  updatedAt?: string;
}

interface RuntimeHistorySnapshot {
  history: RuntimeHistoryMessage[];
  transcript: string[];
  executionRecords: RuntimeToolExecutionRecord[];
  status?: string;
  runId?: string;
  lastError?: string;
  updatedAt?: string;
}

interface RuntimeCapabilityProvider {
  listMcpTools?: () => Array<{ server: string; name: string }>;
  listEnabledSkills?: () => Promise<string[]> | string[];
}

export interface RuntimeSessionTree {
  root: RuntimeSessionRecord;
  descendants: RuntimeSessionRecord[];
}

export interface RuntimeSessionPersistence {
  load: () => Promise<RuntimeSessionRecord[]>;
  save: (records: RuntimeSessionRecord[]) => Promise<void>;
}

interface SessionRuntimeManagerOptions {
  persistence?: RuntimeSessionPersistence;
  maxPersistedRecords?: number;
}

export class SessionRuntimeManager {
  private readonly sessions = new Map<string, RuntimeSessionRecord>();
  private readonly persistence?: RuntimeSessionPersistence;
  private readonly maxPersistedRecords: number;
  private hasHydrated = false;
  private hydrationPromise: Promise<void> | null = null;

  constructor(
    private readonly gatewayClient?: GatewayRpcClient,
    private readonly capabilityProvider: RuntimeCapabilityProvider = {},
    persistenceOrOptions?: RuntimeSessionPersistence | SessionRuntimeManagerOptions,
  ) {
    const options = this.resolveOptions(persistenceOrOptions);
    this.persistence = options.persistence;
    this.maxPersistedRecords = options.maxPersistedRecords;
  }

  async spawn(input: SpawnRuntimeSessionInput): Promise<RuntimeSessionRecord> {
    await this.ensureHydrated();
    const now = new Date().toISOString();
    const id = randomUUID();
    const parentRuntime = input.parentRuntimeId ? this.sessions.get(input.parentRuntimeId) : undefined;
    if (input.parentRuntimeId && !parentRuntime) {
      throw new Error(`Runtime parent session not found: ${input.parentRuntimeId}`);
    }
    const actualParentSessionKey = parentRuntime?.sessionKey ?? input.parentSessionKey;
    const sessionKey = this.buildRuntimeSessionKey(actualParentSessionKey, id);
    const capabilitySnapshot = await this.buildCapabilitySnapshot();
    const record: RuntimeSessionRecord = {
      id,
      parentSessionKey: actualParentSessionKey,
      parentRuntimeId: parentRuntime?.id,
      rootRuntimeId: parentRuntime?.rootRuntimeId ?? parentRuntime?.id ?? id,
      depth: parentRuntime ? parentRuntime.depth + 1 : 0,
      sessionKey,
      mode: input.mode ?? 'session',
      prompt: input.prompt,
      agentName: input.agentName,
      attachments: input.attachments ?? [],
      sandbox: input.sandbox,
      timeoutMs: input.timeoutMs,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      history: [{ role: 'user', content: input.prompt }],
      transcript: [input.prompt],
      executionRecords: [],
      childRuntimeIds: [],
      toolSnapshot: capabilitySnapshot.toolSnapshot,
      skillSnapshot: capabilitySnapshot.skillSnapshot,
    };
    this.sessions.set(record.id, record);
    if (parentRuntime) {
      const linkedExecutionRecords = this.linkParentExecutionRecord(parentRuntime, record);
      this.patchRecord(parentRuntime.id, {
        executionRecords: linkedExecutionRecords,
        childRuntimeIds: [...new Set([...parentRuntime.childRuntimeIds, record.id])],
        updatedAt: now,
      });
    }
    await this.persistSessions();
    const sendResult = await this.gatewayRpc<Record<string, unknown>>('chat.send', {
      sessionKey,
      message: input.prompt,
      idempotencyKey: randomUUID(),
      deliver: false,
      ...(record.attachments.length > 0 ? { attachments: record.attachments } : {}),
      ...(record.sandbox ? { sandbox: record.sandbox } : {}),
      ...(typeof record.timeoutMs === 'number' ? { timeoutMs: record.timeoutMs } : {}),
    });
    const withRun = this.patchRecord(record.id, {
      runId: this.extractFirstString(sendResult, ['runId', 'run_id']) ?? record.runId,
      updatedAt: new Date().toISOString(),
    });
    await this.persistSessions();
    return await this.refreshRecord(withRun.id, {
      fallbackStatus: 'running',
      fallbackTranscript: withRun.transcript,
      fallbackRunId: withRun.runId,
    });
  }

  async list(): Promise<RuntimeSessionRecord[]> {
    await this.ensureHydrated();
    const snapshots = await this.loadSessionSnapshots();
    const records = [...this.sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return await Promise.all(
      records.map(async (record) => await this.refreshRecord(record.id, {
        snapshots,
        fallbackStatus: record.status,
        fallbackTranscript: record.transcript,
        fallbackRunId: record.runId,
        fallbackLastError: record.lastError,
      })),
    );
  }

  async kill(id: string): Promise<RuntimeSessionRecord | null> {
    await this.ensureHydrated();
    const existing = this.sessions.get(id);
    if (!existing) return null;
    await this.gatewayRpc('chat.abort', { sessionKey: existing.sessionKey });
    return await this.refreshRecord(id, {
      fallbackStatus: 'killed',
      forcedStatus: 'killed',
      fallbackTranscript: existing.transcript,
      fallbackRunId: existing.runId,
      fallbackLastError: existing.lastError,
    });
  }

  async steer(id: string, input: string): Promise<RuntimeSessionRecord | null> {
    await this.ensureHydrated();
    const existing = this.sessions.get(id);
    if (!existing) return null;
    const sendResult = await this.gatewayRpc<Record<string, unknown>>('chat.send', {
      sessionKey: existing.sessionKey,
      message: input,
      idempotencyKey: randomUUID(),
      deliver: false,
    });
    const patched = this.patchRecord(id, {
      runId: this.extractFirstString(sendResult, ['runId', 'run_id']) ?? existing.runId,
      updatedAt: new Date().toISOString(),
    });
    await this.persistSessions();
    return await this.refreshRecord(id, {
      fallbackStatus: 'running',
      fallbackTranscript: [...existing.transcript, input],
      fallbackRunId: patched.runId,
      fallbackLastError: existing.lastError,
    });
  }

  async wait(id: string): Promise<RuntimeSessionRecord | null> {
    await this.ensureHydrated();
    const existing = this.sessions.get(id);
    if (!existing) return null;
    return await this.refreshRecord(id, {
      fallbackStatus: existing.status,
      fallbackTranscript: existing.transcript,
      fallbackRunId: existing.runId,
      fallbackLastError: existing.lastError,
    });
  }

  async get(id: string): Promise<RuntimeSessionRecord | null> {
    await this.ensureHydrated();
    const existing = this.sessions.get(id);
    if (!existing) return null;
    return await this.refreshRecord(id, {
      fallbackStatus: existing.status,
      fallbackTranscript: existing.transcript,
      fallbackRunId: existing.runId,
      fallbackLastError: existing.lastError,
    });
  }

  async getTree(id: string): Promise<RuntimeSessionTree | null> {
    await this.ensureHydrated();
    const root = await this.get(id);
    if (!root) return null;

    const descendants: RuntimeSessionRecord[] = [];
    const queue = [...root.childRuntimeIds];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const childId = queue.shift();
      if (!childId || visited.has(childId)) continue;
      visited.add(childId);
      const child = await this.get(childId);
      if (!child) continue;
      descendants.push(child);
      queue.push(...child.childRuntimeIds);
    }

    return { root, descendants };
  }

  private resolveOptions(
    persistenceOrOptions?: RuntimeSessionPersistence | SessionRuntimeManagerOptions,
  ): { persistence?: RuntimeSessionPersistence; maxPersistedRecords: number } {
    if (!persistenceOrOptions) {
      return { maxPersistedRecords: 200 };
    }

    if (this.isPersistence(persistenceOrOptions)) {
      return {
        persistence: persistenceOrOptions,
        maxPersistedRecords: 200,
      };
    }

    return {
      persistence: persistenceOrOptions.persistence,
      maxPersistedRecords: this.normalizeMaxPersistedRecords(persistenceOrOptions.maxPersistedRecords),
    };
  }

  private isPersistence(
    value: RuntimeSessionPersistence | SessionRuntimeManagerOptions,
  ): value is RuntimeSessionPersistence {
    return typeof (value as RuntimeSessionPersistence).load === 'function'
      && typeof (value as RuntimeSessionPersistence).save === 'function';
  }

  private normalizeMaxPersistedRecords(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 200;
    }
    return Math.max(1, Math.floor(value));
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hasHydrated) {
      return;
    }

    if (!this.persistence) {
      this.hasHydrated = true;
      return;
    }

    if (this.hydrationPromise) {
      await this.hydrationPromise;
      return;
    }

    this.hydrationPromise = (async () => {
      try {
        const loaded = await this.persistence?.load();
        const normalizedRecords = (loaded ?? [])
          .map((item) => this.normalizePersistedRecord(item))
          .filter((item): item is RuntimeSessionRecord => item != null);
        for (const record of this.clampPersistedRecords(normalizedRecords)) {
          this.sessions.set(record.id, record);
        }
        for (const record of this.sessions.values()) {
          if (!record.parentRuntimeId) continue;
          const parent = this.sessions.get(record.parentRuntimeId);
          if (!parent || parent.childRuntimeIds.includes(record.id)) continue;
          this.sessions.set(parent.id, {
            ...parent,
            childRuntimeIds: [...parent.childRuntimeIds, record.id],
          });
        }
      } catch {
        // Best effort: runtime APIs still work in-memory when hydration fails.
      } finally {
        this.hasHydrated = true;
        this.hydrationPromise = null;
      }
    })();

    await this.hydrationPromise;
  }

  private normalizePersistedRecord(value: unknown): RuntimeSessionRecord | null {
    if (typeof value !== 'object' || value == null) {
      return null;
    }
    const row = value as Record<string, unknown>;
    const id = this.extractFirstString(row, ['id']);
    const parentSessionKey = this.extractFirstString(row, ['parentSessionKey']);
    const sessionKey = this.extractFirstString(row, ['sessionKey']);
    const prompt = this.extractFirstString(row, ['prompt']);

    if (!id || !parentSessionKey || !sessionKey || !prompt) {
      return null;
    }

    const history = this.normalizeRuntimeHistory(row.history);
    const executionRecords = this.normalizeExecutionRecords(row.executionRecords);
    const derivedExecutionRecords = executionRecords.length > 0
      ? executionRecords
      : this.collectExecutionRecords(history);

    const modeRaw = this.extractFirstString(row, ['mode']);
    const mode: RuntimeSessionMode = modeRaw === 'thread' ? 'thread' : 'session';

    const status = this.mapRuntimeStatus(
      this.extractFirstString(row, ['status']),
      'running',
    );

    return {
      id,
      parentSessionKey,
      parentRuntimeId: this.extractFirstString(row, ['parentRuntimeId']),
      rootRuntimeId: this.extractFirstString(row, ['rootRuntimeId']) ?? id,
      depth: typeof row.depth === 'number' && Number.isFinite(row.depth) ? Math.max(0, Math.floor(row.depth)) : 0,
      sessionKey,
      mode,
      prompt,
      agentName: this.extractFirstString(row, ['agentName']),
      attachments: this.normalizeStringArray(row.attachments),
      sandbox: this.extractFirstString(row, ['sandbox']),
      timeoutMs: typeof row.timeoutMs === 'number' ? row.timeoutMs : undefined,
      status,
      runId: this.extractFirstString(row, ['runId', 'run_id']),
      lastError: this.extractFirstString(row, ['lastError', 'error', 'errorMessage']),
      createdAt: this.resolveUpdatedAt([this.coerceIsoDate(row.createdAt)]),
      updatedAt: this.resolveUpdatedAt([this.coerceIsoDate(row.updatedAt), this.coerceIsoDate(row.createdAt)]),
      history,
      transcript: this.normalizeStringArray(row.transcript),
      executionRecords: derivedExecutionRecords,
      childRuntimeIds: this.normalizeStringArray(row.childRuntimeIds),
      toolSnapshot: this.normalizeToolSnapshot(row.toolSnapshot),
      skillSnapshot: this.normalizeStringArray(row.skillSnapshot),
    };
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private normalizeToolSnapshot(value: unknown): Array<{ server: string; name: string }> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (typeof item !== 'object' || item == null) {
          return null;
        }
        const row = item as Record<string, unknown>;
        const server = this.extractFirstString(row, ['server']);
        const name = this.extractFirstString(row, ['name']);
        if (!server || !name) {
          return null;
        }
        return { server, name };
      })
      .filter((item): item is { server: string; name: string } => item != null);
  }

  private normalizeRuntimeHistory(value: unknown): RuntimeHistoryMessage[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => this.normalizeRuntimeHistoryMessage(item))
      .filter((item): item is RuntimeHistoryMessage => item != null);
  }

  private normalizeRuntimeHistoryMessage(value: unknown): RuntimeHistoryMessage | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      return { role: 'assistant', content: trimmed };
    }
    if (typeof value !== 'object' || value == null) {
      return null;
    }

    const row = value as Record<string, unknown>;
    const role = this.extractFirstString(row, ['role']) ?? 'assistant';
    const content = row.content ?? row.message ?? row.text;
    if (content === undefined) {
      return null;
    }

    return {
      role,
      content,
      timestamp: typeof row.timestamp === 'number' ? row.timestamp : undefined,
      id: this.extractFirstString(row, ['id']),
      toolCallId: this.extractFirstString(row, ['toolCallId', 'tool_call_id']),
      toolName: this.extractFirstString(row, ['toolName', 'tool_name']),
      details: row.details,
      isError: typeof row.isError === 'boolean' ? row.isError : undefined,
    };
  }

  private normalizeExecutionRecords(value: unknown): RuntimeToolExecutionRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => this.normalizeExecutionRecord(item))
      .filter((item): item is RuntimeToolExecutionRecord => item != null);
  }

  private normalizeExecutionRecord(value: unknown): RuntimeToolExecutionRecord | null {
    if (typeof value !== 'object' || value == null) {
      return null;
    }

    const row = value as Record<string, unknown>;
    const toolCallId = this.extractFirstString(row, ['toolCallId', 'tool_call_id']);
    const toolName = this.extractFirstString(row, ['toolName', 'tool_name', 'name']) ?? toolCallId ?? 'tool';
    const id = this.extractFirstString(row, ['id']) ?? toolCallId ?? toolName;
    if (!id) {
      return null;
    }

    return {
      id,
      toolCallId,
      toolName,
      status: this.mapToolExecutionStatus(row.status, 'completed'),
      summary: this.extractFirstString(row, ['summary']),
      durationMs: this.parseDurationMs(row.durationMs ?? row.duration),
      input: row.input ?? row.arguments,
      output: row.output ?? row.content ?? row.result,
      details: row.details,
      linkedRuntimeId: this.extractFirstString(row, ['linkedRuntimeId']),
      linkedRuntimeSessionKey: this.extractFirstString(row, ['linkedRuntimeSessionKey']),
    };
  }

  private collectExecutionRecords(history: RuntimeHistoryMessage[]): RuntimeToolExecutionRecord[] {
    const records = new Map<string, RuntimeToolExecutionRecord>();
    for (const message of history) {
      for (const update of this.collectExecutionUpdates(message, records.size)) {
        this.upsertExecutionRecord(records, update);
      }
    }
    return [...records.values()];
  }

  private collectExecutionUpdates(
    message: RuntimeHistoryMessage,
    seed: number,
  ): RuntimeToolExecutionRecord[] {
    const updates: RuntimeToolExecutionRecord[] = [];
    const role = message.role.trim().toLowerCase();

    if (Array.isArray(message.content)) {
      let offset = seed;
      for (const item of message.content) {
        if (typeof item !== 'object' || item == null) {
          continue;
        }
        const block = item as Record<string, unknown>;
        const blockType = this.extractFirstString(block, ['type'])?.trim().toLowerCase();
        if (blockType === 'tool_use' || blockType === 'toolcall') {
          const toolCallId = this.extractFirstString(block, ['id']);
          const toolName = this.extractFirstString(block, ['name']) ?? toolCallId ?? 'tool';
          updates.push({
            id: toolCallId ?? `${toolName}:${offset}`,
            toolCallId,
            toolName,
            status: 'running',
            input: block.input ?? block.arguments,
          });
          offset += 1;
          continue;
        }
        if (blockType === 'tool_result' || blockType === 'toolresult') {
          const toolCallId = this.extractFirstString(block, ['id']);
          const toolName = this.extractFirstString(block, ['name']) ?? toolCallId ?? 'tool';
          const output = block.content ?? block.text;
          const summary = this.summarizeToolOutput(this.extractText(output) ?? '');
          updates.push({
            id: toolCallId ?? `${toolName}:${offset}`,
            toolCallId,
            toolName,
            status: 'completed',
            output,
            ...(summary ? { summary } : {}),
          });
          offset += 1;
        }
      }
    }

    if (role === 'toolresult' || role === 'tool_result') {
      const details = message.details && typeof message.details === 'object'
        ? message.details as Record<string, unknown>
        : undefined;
      const toolCallId = message.toolCallId;
      const toolName = message.toolName
        ?? this.extractFirstString(details, ['toolName', 'tool_name'])
        ?? toolCallId
        ?? 'tool';
      const output = details?.content ?? details?.aggregated ?? message.content;
      const summary = this.summarizeToolOutput(this.extractText(output) ?? String(details?.error ?? ''));
      updates.push({
        id: toolCallId ?? message.id ?? `${toolName}:${seed + updates.length}`,
        toolCallId,
        toolName,
        status: this.mapToolExecutionStatus(details?.status, message.isError ? 'error' : 'completed'),
        ...(summary ? { summary } : {}),
        ...(this.parseDurationMs(details?.durationMs ?? details?.duration) !== undefined
          ? { durationMs: this.parseDurationMs(details?.durationMs ?? details?.duration) }
          : {}),
        output,
        details: message.details,
      });
    }

    return updates;
  }

  private upsertExecutionRecord(
    records: Map<string, RuntimeToolExecutionRecord>,
    update: RuntimeToolExecutionRecord,
  ): void {
    const key = update.toolCallId ?? update.id;
    const existing = records.get(key);
    if (!existing) {
      records.set(key, update);
      return;
    }

    records.set(key, {
      ...existing,
      ...update,
      toolName: update.toolName || existing.toolName,
      status: this.mergeToolExecutionStatus(existing.status, update.status),
      summary: update.summary ?? existing.summary,
      durationMs: update.durationMs ?? existing.durationMs,
      input: update.input ?? existing.input,
      output: update.output ?? existing.output,
      details: update.details ?? existing.details,
      linkedRuntimeId: update.linkedRuntimeId ?? existing.linkedRuntimeId,
      linkedRuntimeSessionKey: update.linkedRuntimeSessionKey ?? existing.linkedRuntimeSessionKey,
    });
  }

  private linkParentExecutionRecord(
    parentRuntime: RuntimeSessionRecord,
    childRuntime: RuntimeSessionRecord,
  ): RuntimeToolExecutionRecord[] {
    const nextRecords = parentRuntime.executionRecords.map((execution) => ({ ...execution }));
    for (let index = nextRecords.length - 1; index >= 0; index -= 1) {
      const record = nextRecords[index];
      if (record.linkedRuntimeId) continue;
      const toolName = record.toolName.trim().toLowerCase();
      if (!toolName.startsWith('skill:') && !toolName.includes('subagent') && !toolName.includes('spawn')) {
        continue;
      }
      nextRecords[index] = {
        ...record,
        linkedRuntimeId: childRuntime.id,
        linkedRuntimeSessionKey: childRuntime.sessionKey,
      };
      break;
    }
    return nextRecords;
  }

  private mergeExecutionRecordLinks(
    nextRecords: RuntimeToolExecutionRecord[],
    existingRecords: RuntimeToolExecutionRecord[],
  ): RuntimeToolExecutionRecord[] {
    if (nextRecords.length === 0 || existingRecords.length === 0) {
      return nextRecords;
    }

    const existingByKey = new Map<string, RuntimeToolExecutionRecord>();
    for (const record of existingRecords) {
      existingByKey.set(record.toolCallId ?? record.id, record);
    }

    return nextRecords.map((record) => {
      const existing = existingByKey.get(record.toolCallId ?? record.id);
      if (!existing) return record;
      return {
        ...record,
        linkedRuntimeId: record.linkedRuntimeId ?? existing.linkedRuntimeId,
        linkedRuntimeSessionKey: record.linkedRuntimeSessionKey ?? existing.linkedRuntimeSessionKey,
      };
    });
  }

  private mergeToolExecutionStatus(
    existing: RuntimeToolExecutionStatus,
    incoming: RuntimeToolExecutionStatus,
  ): RuntimeToolExecutionStatus {
    const order: Record<RuntimeToolExecutionStatus, number> = {
      running: 0,
      completed: 1,
      error: 2,
    };
    return order[incoming] >= order[existing] ? incoming : existing;
  }

  private mapToolExecutionStatus(
    rawStatus: unknown,
    fallback: RuntimeToolExecutionStatus,
  ): RuntimeToolExecutionStatus {
    const normalized = typeof rawStatus === 'string'
      ? rawStatus.trim().toLowerCase().replace(/[\s-]+/g, '_')
      : '';
    if (!normalized) {
      return fallback;
    }
    if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
      return 'error';
    }
    if (normalized === 'completed' || normalized === 'success' || normalized === 'done') {
      return 'completed';
    }
    return 'running';
  }

  private parseDurationMs(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private summarizeToolOutput(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return undefined;
    }
    const summary = lines.slice(0, 2).join(' / ');
    return summary.length > 160 ? `${summary.slice(0, 157)}...` : summary;
  }

  private async persistSessions(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    const clamped = this.clampPersistedRecords([...this.sessions.values()]);
    if (this.sessions.size > clamped.length) {
      const keep = new Set(clamped.map((record) => record.id));
      for (const sessionId of [...this.sessions.keys()]) {
        if (!keep.has(sessionId)) {
          this.sessions.delete(sessionId);
        }
      }
    }

    try {
      await this.persistence.save(clamped.map((record) => this.cloneRecord(record)));
    } catch {
      // Best effort: operations should remain available even if persistence fails.
    }
  }

  private clampPersistedRecords(records: RuntimeSessionRecord[]): RuntimeSessionRecord[] {
    return [...records]
      .sort((a, b) => this.recordSortValue(b) - this.recordSortValue(a))
      .slice(0, this.maxPersistedRecords);
  }

  private recordSortValue(record: RuntimeSessionRecord): number {
    const updated = Date.parse(record.updatedAt);
    if (!Number.isNaN(updated)) {
      return updated;
    }
    const created = Date.parse(record.createdAt);
    return Number.isNaN(created) ? 0 : created;
  }

  private cloneRecord(record: RuntimeSessionRecord): RuntimeSessionRecord {
    return {
      ...record,
      attachments: [...record.attachments],
      history: record.history.map((message) => ({ ...message })),
      transcript: [...record.transcript],
      executionRecords: record.executionRecords.map((execution) => ({ ...execution })),
      childRuntimeIds: [...record.childRuntimeIds],
      toolSnapshot: record.toolSnapshot.map((tool) => ({ ...tool })),
      skillSnapshot: [...record.skillSnapshot],
    };
  }

  private buildRuntimeSessionKey(parentSessionKey: string, localRuntimeId: string): string {
    return `${parentSessionKey.replace(/:+$/, '')}:subagent:${localRuntimeId}`;
  }

  private async buildCapabilitySnapshot(): Promise<{
    toolSnapshot: Array<{ server: string; name: string }>;
    skillSnapshot: string[];
  }> {
    const toolSnapshot = (this.capabilityProvider.listMcpTools?.() ?? [])
      .filter((tool): tool is { server: string; name: string } => Boolean(tool?.server && tool?.name));

    let skillSnapshot = await this.resolveEnabledSkills();
    skillSnapshot = [...new Set(skillSnapshot.filter((skill) => skill.trim().length > 0))].sort((a, b) => a.localeCompare(b));

    return { toolSnapshot, skillSnapshot };
  }

  private async resolveEnabledSkills(): Promise<string[]> {
    if (this.capabilityProvider.listEnabledSkills) {
      return await Promise.resolve(this.capabilityProvider.listEnabledSkills());
    }

    if (!this.gatewayClient) {
      return [];
    }

    try {
      const payload = await this.gatewayClient.rpc<{
        skills?: Array<{ skillKey?: string; slug?: string; disabled?: boolean }>;
      }>('skills.status');
      return (payload.skills ?? [])
        .filter((skill) => skill.disabled !== true)
        .map((skill) => {
          if (typeof skill.skillKey === 'string' && skill.skillKey.trim()) return skill.skillKey.trim();
          if (typeof skill.slug === 'string' && skill.slug.trim()) return skill.slug.trim();
          return '';
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private async refreshRecord(
    id: string,
    options: {
      snapshots?: RuntimeSessionSnapshot[];
      fallbackStatus: RuntimeSessionStatus;
      forcedStatus?: RuntimeSessionStatus;
      fallbackTranscript: string[];
      fallbackRunId?: string;
      fallbackLastError?: string;
    },
  ): Promise<RuntimeSessionRecord> {
    const existing = this.sessions.get(id);
    if (!existing) {
      throw new Error(`Runtime session not found: ${id}`);
    }
    const snapshots = options.snapshots ?? await this.loadSessionSnapshots();
    const sessionSnapshot = snapshots.find((item) => item.sessionKey === existing.sessionKey);
    const history = await this.loadHistorySnapshot(existing.sessionKey);

    const next: RuntimeSessionRecord = {
      ...existing,
      status: options.forcedStatus ?? this.mapRuntimeStatus(
        sessionSnapshot?.status ?? history.status,
        options.fallbackStatus,
      ),
      runId: sessionSnapshot?.runId
        ?? history.runId
        ?? options.fallbackRunId
        ?? existing.runId,
      lastError: sessionSnapshot?.lastError
        ?? history.lastError
        ?? options.fallbackLastError
        ?? existing.lastError,
      history: history.history.length > 0 ? history.history : existing.history,
      transcript: history.transcript.length > 0 ? history.transcript : options.fallbackTranscript,
      executionRecords: this.mergeExecutionRecordLinks(
        history.executionRecords.length > 0 ? history.executionRecords : existing.executionRecords,
        existing.executionRecords,
      ),
      updatedAt: this.resolveUpdatedAt([
        sessionSnapshot?.updatedAt,
        history.updatedAt,
        existing.updatedAt,
      ]),
    };
    this.sessions.set(id, next);
    await this.persistSessions();
    return next;
  }

  private async loadSessionSnapshots(): Promise<RuntimeSessionSnapshot[]> {
    const payload = await this.gatewayRpc<unknown>('sessions.list', {});
    const sessionItems = this.extractArray(payload, ['sessions'])
      ?? (Array.isArray(payload) ? payload : []);
    return sessionItems
      .map((item) => this.normalizeSessionSnapshot(item))
      .filter((item): item is RuntimeSessionSnapshot => item != null);
  }

  private normalizeSessionSnapshot(item: unknown): RuntimeSessionSnapshot | null {
    if (typeof item !== 'object' || item == null) {
      return null;
    }
    const row = item as Record<string, unknown>;
    const sessionKey = this.extractFirstString(row, ['sessionKey', 'key']);
    if (!sessionKey) {
      return null;
    }
    return {
      sessionKey,
      status: this.extractFirstString(row, ['status', 'state']),
      runId: this.extractFirstString(row, ['runId', 'run_id']),
      lastError: this.extractFirstString(row, ['lastError', 'error', 'errorMessage']),
      updatedAt: this.coerceIsoDate(row.updatedAt),
    };
  }

  private async loadHistorySnapshot(sessionKey: string): Promise<RuntimeHistorySnapshot> {
    const payload = await this.gatewayRpc<unknown>('chat.history', { sessionKey, limit: 200 });
    const messageItems = this.extractArray(payload, ['messages', 'history'])
      ?? (Array.isArray(payload) ? payload : []);
    const history = messageItems
      .map((message) => this.normalizeRuntimeHistoryMessage(message))
      .filter((item): item is RuntimeHistoryMessage => item != null);
    const explicitStatus = this.extractFirstString(payload, ['status', 'state']);
    // Derive status from history if Gateway doesn't provide an explicit status:
    // if there are messages and the last assistant message has no pending tool_use,
    // the run has likely completed.
    let derivedStatus = explicitStatus;
    if (!derivedStatus && history.length > 0) {
      const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        const hasPendingToolUse = Array.isArray(lastAssistant.content)
          && (lastAssistant.content as Array<Record<string, unknown>>).some(
            (b) => b.type === 'tool_use' || b.type === 'toolCall',
          );
        if (!hasPendingToolUse) {
          derivedStatus = 'completed';
        }
      }
    }
    return {
      history,
      transcript: messageItems
        .map((message) => this.extractTranscriptLine(message))
        .filter((line): line is string => Boolean(line)),
      executionRecords: this.collectExecutionRecords(history),
      status: derivedStatus,
      runId: this.extractFirstString(payload, ['runId', 'run_id']),
      lastError: this.extractFirstString(payload, ['lastError', 'error', 'errorMessage']),
      updatedAt: this.coerceIsoDate(this.extractFirstValue(payload, ['updatedAt', 'updated_at'])),
    };
  }

  private extractTranscriptLine(message: unknown): string | null {
    if (typeof message === 'string') {
      const value = message.trim();
      return value.length > 0 ? value : null;
    }
    if (typeof message !== 'object' || message == null) {
      return null;
    }
    const row = message as Record<string, unknown>;
    const fromContent = this.extractText(row.content);
    if (fromContent) {
      return fromContent;
    }
    const fromMessage = this.extractText(row.message);
    if (fromMessage) {
      return fromMessage;
    }
    const fromText = this.extractText(row.text);
    if (fromText) {
      return fromText;
    }
    return null;
  }

  private extractText(value: unknown): string | null {
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 ? text : null;
    }
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => this.extractText(item))
        .filter((entry): entry is string => Boolean(entry))
        .join('\n')
        .trim();
      return joined.length > 0 ? joined : null;
    }
    if (typeof value !== 'object' || value == null) {
      return null;
    }
    const row = value as Record<string, unknown>;
    const blockText = this.extractFirstString(row, ['text', 'thinking']);
    if (blockText) {
      return blockText;
    }
    return this.extractText(this.extractFirstValue(row, ['content', 'message']));
  }

  private mapRuntimeStatus(rawStatus: unknown, fallback: RuntimeSessionStatus): RuntimeSessionStatus {
    const normalized = typeof rawStatus === 'string'
      ? rawStatus.trim().toLowerCase().replace(/[\s-]+/g, '_')
      : '';
    if (!normalized) {
      return fallback;
    }
    if (normalized === 'running' || normalized === 'in_progress' || normalized === 'active' || normalized === 'started') {
      return 'running';
    }
    if (normalized === 'blocked') {
      return 'blocked';
    }
    if (normalized === 'waiting_approval' || normalized === 'awaiting_approval' || normalized === 'pending_approval') {
      return 'waiting_approval';
    }
    if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
      return 'error';
    }
    if (normalized === 'completed' || normalized === 'done' || normalized === 'finished' || normalized === 'success') {
      return 'completed';
    }
    if (
      normalized === 'killed'
      || normalized === 'aborted'
      || normalized === 'cancelled'
      || normalized === 'canceled'
      || normalized === 'terminated'
      || normalized === 'stopped'
    ) {
      return 'killed';
    }
    return fallback;
  }

  private patchRecord(id: string, patch: Partial<RuntimeSessionRecord>): RuntimeSessionRecord {
    const current = this.sessions.get(id);
    if (!current) {
      throw new Error(`Runtime session not found: ${id}`);
    }
    const next = { ...current, ...patch };
    this.sessions.set(id, next);
    return next;
  }

  private resolveUpdatedAt(candidates: Array<string | undefined>): string {
    for (const candidate of candidates) {
      if (candidate && !Number.isNaN(Date.parse(candidate))) {
        return candidate;
      }
    }
    return new Date().toISOString();
  }

  private coerceIsoDate(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      if (!Number.isNaN(Date.parse(trimmed))) {
        return new Date(trimmed).toISOString();
      }
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const millis = value < 1_000_000_000_000 ? value * 1000 : value;
      return new Date(millis).toISOString();
    }
    return undefined;
  }

  private extractFirstString(source: unknown, keys: string[]): string | undefined {
    const value = this.extractFirstValue(source, keys);
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private extractFirstValue(source: unknown, keys: string[]): unknown {
    if (typeof source !== 'object' || source == null) {
      return undefined;
    }
    const row = source as Record<string, unknown>;
    for (const key of keys) {
      if (row[key] !== undefined) {
        return row[key];
      }
    }
    return undefined;
  }

  private extractArray(source: unknown, keys: string[]): unknown[] | null {
    const value = this.extractFirstValue(source, keys);
    return Array.isArray(value) ? value : null;
  }

  private async gatewayRpc<T>(method: string, params?: unknown): Promise<T> {
    if (!this.gatewayClient) {
      throw new Error(`SessionRuntimeManager requires Gateway RPC client for method ${method}`);
    }
    return await this.gatewayClient.rpc<T>(method, params);
  }
}
