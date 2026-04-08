import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { ClawHubService } from '../gateway/clawhub';
import type { HostEventBus } from './event-bus';
import type { McpRuntimeManager } from '../services/mcp/runtime-manager';
import type { SessionRuntimeManager } from '../services/session-runtime-manager';

export interface HostApiContext {
  gatewayManager: GatewayManager;
  clawHubService: ClawHubService;
  mcpRuntimeManager: McpRuntimeManager;
  sessionRuntimeManager: SessionRuntimeManager;
  eventBus: HostEventBus;
  mainWindow: BrowserWindow | null;
  hostApiSessionToken: string;
}
