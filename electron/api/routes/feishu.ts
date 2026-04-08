import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import {
  getFeishuRobotCreationEntry,
  getFeishuUserAuthorizationSession,
  getFeishuIntegrationStatus,
  installOrUpdateFeishuPlugin,
  runFeishuIntegrationDoctor,
  startFeishuUserAuthorization,
} from '../../services/feishu-integration';

export async function handleFeishuRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/feishu/status' && req.method === 'GET') {
    sendJson(res, 200, await getFeishuIntegrationStatus());
    return true;
  }

  if ((url.pathname === '/api/feishu/install' || url.pathname === '/api/feishu/update') && req.method === 'POST') {
    sendJson(res, 200, await installOrUpdateFeishuPlugin());
    return true;
  }

  if (url.pathname === '/api/feishu/doctor' && req.method === 'POST') {
    sendJson(res, 200, await runFeishuIntegrationDoctor());
    return true;
  }

  if (url.pathname === '/api/feishu/create/start' && req.method === 'POST') {
    sendJson(res, 200, getFeishuRobotCreationEntry());
    return true;
  }

  if (url.pathname === '/api/feishu/auth/start' && req.method === 'POST') {
    const body = await parseJsonBody<{ accountId?: string }>(req);
    sendJson(res, 200, await startFeishuUserAuthorization(body.accountId || 'default'));
    return true;
  }

  if (url.pathname === '/api/feishu/auth/status' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      sendJson(res, 400, { success: false, error: 'sessionId is required' });
      return true;
    }
    const session = getFeishuUserAuthorizationSession(sessionId);
    if (!session) {
      sendJson(res, 404, { success: false, error: 'Feishu auth session not found' });
      return true;
    }
    sendJson(res, 200, session);
    return true;
  }

  return false;
}
