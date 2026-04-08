import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'http';
import { join } from 'node:path';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getOpenClawConfigDir } from '../../utils/paths';

interface ApprovalItem {
  id?: string;
  key?: string;
  sessionKey?: string;
  agentId?: string;
  state?: string;
  status?: string;
  decision?: string;
  command?: string;
  prompt?: string;
  reason?: string;
  createdAt?: string;
  requestedAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

interface DecisionEntry {
  approvalId: string;
  action: 'approve' | 'reject';
  reason?: string;
  decidedAt: string;
}

async function readApprovals(): Promise<ApprovalItem[]> {
  const configDir = getOpenClawConfigDir();
  const pendingPath = join(configDir, 'approvals', 'pending.json');
  try {
    const raw = await readFile(pendingPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as ApprovalItem[];
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.approvals)) return obj.approvals as ApprovalItem[];
      if (Array.isArray(obj.pending)) return obj.pending as ApprovalItem[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeDecision(entry: DecisionEntry): Promise<void> {
  const configDir = getOpenClawConfigDir();
  const approvalsDir = join(configDir, 'approvals');
  const decisionsPath = join(approvalsDir, 'decisions.json');
  await mkdir(approvalsDir, { recursive: true });
  let existing: DecisionEntry[] = [];
  try {
    const raw = await readFile(decisionsPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) existing = parsed as DecisionEntry[];
  } catch {
    // file doesn't exist yet
  }
  existing.push(entry);
  await writeFile(decisionsPath, JSON.stringify(existing, null, 2), 'utf8');
}

export async function handleApprovalRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/approvals' && req.method === 'GET') {
    const approvals = await readApprovals();
    sendJson(res, 200, { approvals });
    return true;
  }

  if (url.pathname === '/api/approvals/approve' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ approvalId: string; reason?: string }>(req);
      if (!body.approvalId) {
        sendJson(res, 400, { ok: false, error: 'approvalId is required' });
        return true;
      }
      await writeDecision({
        approvalId: body.approvalId,
        action: 'approve',
        reason: body.reason,
        decidedAt: new Date().toISOString(),
      });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return true;
  }

  if (url.pathname === '/api/approvals/reject' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ approvalId: string; reason: string }>(req);
      if (!body.approvalId) {
        sendJson(res, 400, { ok: false, error: 'approvalId is required' });
        return true;
      }
      if (!body.reason) {
        sendJson(res, 400, { ok: false, error: 'reason is required for reject' });
        return true;
      }
      await writeDecision({
        approvalId: body.approvalId,
        action: 'reject',
        reason: body.reason,
        decidedAt: new Date().toISOString(),
      });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return true;
  }

  return false;
}
