import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadMiniMaxPortalOAuthModule,
  loadQwenPortalOAuthModule,
} from '@electron/utils/openclaw-oauth-runtime';

const OPENCLAW_DIR = join(process.cwd(), 'node_modules', 'openclaw');

describe('openclaw oauth runtime loader', () => {
  it('loads MiniMax device OAuth from the published openclaw dist runtime', async () => {
    const runtime = await loadMiniMaxPortalOAuthModule(OPENCLAW_DIR);

    expect(typeof runtime.loginMiniMaxPortalOAuth).toBe('function');
  }, 10000);

  it('loads Qwen device OAuth from the published openclaw dist runtime', async () => {
    const runtime = await loadQwenPortalOAuthModule(OPENCLAW_DIR);

    expect(typeof runtime.loginQwenPortalOAuth).toBe('function');
  }, 10000);
});
