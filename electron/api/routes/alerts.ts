import type { IncomingMessage, ServerResponse } from 'http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

export interface AlertRule {
  id: string;
  name: string;
  type: 'daily_token' | 'cost_usd' | 'session_count';
  threshold: number;
  enabled: boolean;
  createdAt: string;
}

const ALERTS_FILE = join(homedir(), '.openclaw', 'alerts.json');

async function readAlerts(): Promise<AlertRule[]> {
  try {
    const raw = await readFile(ALERTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AlertRule[]) : [];
  } catch {
    return [];
  }
}

async function writeAlerts(rules: AlertRule[]): Promise<void> {
  const dir = join(homedir(), '.openclaw');
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(ALERTS_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

export async function handleAlertsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/alerts')) return false;

  // GET /api/alerts
  if (url.pathname === '/api/alerts' && req.method === 'GET') {
    sendJson(res, 200, await readAlerts());
    return true;
  }

  // POST /api/alerts
  if (url.pathname === '/api/alerts' && req.method === 'POST') {
    const body = await parseJsonBody<Partial<AlertRule>>(req);
    if (!body.name || body.threshold == null) {
      sendJson(res, 400, { error: 'name and threshold are required' });
      return true;
    }
    const rules = await readAlerts();
    const rule: AlertRule = {
      id: `alert-${Date.now()}`,
      name: body.name,
      type: body.type ?? 'daily_token',
      threshold: body.threshold,
      enabled: body.enabled ?? true,
      createdAt: new Date().toISOString(),
    };
    rules.push(rule);
    await writeAlerts(rules);
    sendJson(res, 201, rule);
    return true;
  }

  // PATCH /api/alerts/:id
  const patchMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const id = patchMatch[1];
    const body = await parseJsonBody<Partial<AlertRule>>(req);
    const rules = await readAlerts();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: 'not found' });
      return true;
    }
    rules[idx] = { ...rules[idx], ...body, id };
    await writeAlerts(rules);
    sendJson(res, 200, rules[idx]);
    return true;
  }

  // DELETE /api/alerts/:id
  if (patchMatch && req.method === 'DELETE') {
    const id = patchMatch[1];
    const rules = await readAlerts();
    const filtered = rules.filter((r) => r.id !== id);
    await writeAlerts(filtered);
    sendJson(res, 200, { success: true });
    return true;
  }

  return false;
}
