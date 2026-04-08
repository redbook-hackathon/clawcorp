import type { IncomingMessage, ServerResponse } from 'http';
import { join } from 'node:path';
import { getOpenClawConfigDir } from '../../utils/paths';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

export async function handleSessionRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/sessions/spawn' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        parentSessionKey?: string;
        parentRuntimeId?: string;
        prompt: string;
        mode?: 'session' | 'thread';
        agentName?: string;
        attachments?: string[];
        sandbox?: string;
        timeoutMs?: number;
      }>(req);
      if ((!body.parentSessionKey?.trim() && !body.parentRuntimeId?.trim()) || !body.prompt?.trim()) {
        sendJson(res, 400, { success: false, error: 'prompt and parentSessionKey or parentRuntimeId are required' });
        return true;
      }
      const session = await ctx.sessionRuntimeManager.spawn({
        parentSessionKey: body.parentSessionKey?.trim() || '',
        parentRuntimeId: body.parentRuntimeId?.trim() || undefined,
        prompt: body.prompt.trim(),
        mode: body.mode,
        agentName: body.agentName,
        attachments: body.attachments,
        sandbox: body.sandbox,
        timeoutMs: body.timeoutMs,
      });
      sendJson(res, 200, { success: true, session });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/sessions/subagents' && req.method === 'GET') {
    try {
      const sessions = await ctx.sessionRuntimeManager.list();
      sendJson(res, 200, { success: true, sessions });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  const runtimeDetailMatch = url.pathname.match(/^\/api\/sessions\/subagents\/([^/]+)$/);
  if (runtimeDetailMatch && req.method === 'GET') {
    try {
      const [, encodedId] = runtimeDetailMatch;
      const id = decodeURIComponent(encodedId);
      const session = await ctx.sessionRuntimeManager.get(id);
      if (!session) {
        sendJson(res, 404, { success: false, error: 'Runtime session not found' });
        return true;
      }
      sendJson(res, 200, { success: true, session });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  const runtimeTreeMatch = url.pathname.match(/^\/api\/sessions\/subagents\/([^/]+)\/tree$/);
  if (runtimeTreeMatch && req.method === 'GET') {
    try {
      const [, encodedId] = runtimeTreeMatch;
      const id = decodeURIComponent(encodedId);
      const tree = await ctx.sessionRuntimeManager.getTree(id);
      if (!tree) {
        sendJson(res, 404, { success: false, error: 'Runtime session not found' });
        return true;
      }
      sendJson(res, 200, { success: true, tree });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  const runtimeActionMatch = url.pathname.match(/^\/api\/sessions\/subagents\/([^/]+)\/(kill|steer|wait)$/);
  if (runtimeActionMatch && req.method === 'POST') {
    try {
      const [, encodedId, action] = runtimeActionMatch;
      const id = decodeURIComponent(encodedId);
      if (action === 'kill') {
        const session = await ctx.sessionRuntimeManager.kill(id);
        if (!session) {
          sendJson(res, 404, { success: false, error: 'Runtime session not found' });
          return true;
        }
        sendJson(res, 200, { success: true, session });
        return true;
      }

      if (action === 'steer') {
        const body = await parseJsonBody<{ input?: string }>(req);
        if (!body.input?.trim()) {
          sendJson(res, 400, { success: false, error: 'input is required' });
          return true;
        }
        const session = await ctx.sessionRuntimeManager.steer(id, body.input.trim());
        if (!session) {
          sendJson(res, 404, { success: false, error: 'Runtime session not found' });
          return true;
        }
        sendJson(res, 200, { success: true, session });
        return true;
      }

      const session = await ctx.sessionRuntimeManager.wait(id);
      if (!session) {
        sendJson(res, 404, { success: false, error: 'Runtime session not found' });
        return true;
      }
      sendJson(res, 200, { success: true, session });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/sessions/delete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ sessionKey: string }>(req);
      const sessionKey = body.sessionKey;
      if (!sessionKey || !sessionKey.startsWith('agent:')) {
        sendJson(res, 400, { success: false, error: `Invalid sessionKey: ${sessionKey}` });
        return true;
      }
      const parts = sessionKey.split(':');
      if (parts.length < 3) {
        sendJson(res, 400, { success: false, error: `sessionKey has too few parts: ${sessionKey}` });
        return true;
      }
      const agentId = parts[1];
      const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
      const sessionsJsonPath = join(sessionsDir, 'sessions.json');
      const fsP = await import('node:fs/promises');
      const raw = await fsP.readFile(sessionsJsonPath, 'utf8');
      const sessionsJson = JSON.parse(raw) as Record<string, unknown>;

      let uuidFileName: string | undefined;
      let resolvedSrcPath: string | undefined;
      if (Array.isArray(sessionsJson.sessions)) {
        const entry = (sessionsJson.sessions as Array<Record<string, unknown>>)
          .find((s) => s.key === sessionKey || s.sessionKey === sessionKey);
        if (entry) {
          uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (!uuidFileName && typeof entry.id === 'string') {
            uuidFileName = `${entry.id}.jsonl`;
          }
        }
      }
      if (!uuidFileName && sessionsJson[sessionKey] != null) {
        const val = sessionsJson[sessionKey];
        if (typeof val === 'string') {
          uuidFileName = val;
        } else if (typeof val === 'object' && val !== null) {
          const entry = val as Record<string, unknown>;
          const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (absFile) {
            if (absFile.startsWith('/') || absFile.match(/^[A-Za-z]:\\/)) {
              resolvedSrcPath = absFile;
            } else {
              uuidFileName = absFile;
            }
          } else {
            const uuidVal = (entry.id ?? entry.sessionId) as string | undefined;
            if (uuidVal) uuidFileName = uuidVal.endsWith('.jsonl') ? uuidVal : `${uuidVal}.jsonl`;
          }
        }
      }
      if (!uuidFileName && !resolvedSrcPath) {
        sendJson(res, 404, { success: false, error: `Cannot resolve file for session: ${sessionKey}` });
        return true;
      }
      if (!resolvedSrcPath) {
        if (!uuidFileName!.endsWith('.jsonl')) uuidFileName = `${uuidFileName}.jsonl`;
        resolvedSrcPath = join(sessionsDir, uuidFileName!);
      }
      const dstPath = resolvedSrcPath.replace(/\.jsonl$/, '.deleted.jsonl');
      try {
        await fsP.access(resolvedSrcPath);
        await fsP.rename(resolvedSrcPath, dstPath);
      } catch {
        // Non-fatal; still try to update sessions.json.
      }
      const raw2 = await fsP.readFile(sessionsJsonPath, 'utf8');
      const json2 = JSON.parse(raw2) as Record<string, unknown>;
      if (Array.isArray(json2.sessions)) {
        json2.sessions = (json2.sessions as Array<Record<string, unknown>>)
          .filter((s) => s.key !== sessionKey && s.sessionKey !== sessionKey);
      } else if (json2[sessionKey]) {
        delete json2[sessionKey];
      }
      await fsP.writeFile(sessionsJsonPath, JSON.stringify(json2, null, 2), 'utf8');
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
