import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { sendJson } from '../route-utils';

export async function handleHealthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if ((url.pathname === '/healthz' || url.pathname === '/api/healthz') && req.method === 'GET') {
    const gatewayStatus = ctx.gatewayManager.getStatus();
    sendJson(res, 200, {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gateway: { state: gatewayStatus.state, port: gatewayStatus.port },
    });
    return true;
  }
  return false;
}
