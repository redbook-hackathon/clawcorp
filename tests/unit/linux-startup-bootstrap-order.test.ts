// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not find block between ${startMarker} and ${endMarker}`);
  }
  return source.slice(start, end);
}

describe('linux/electron startup bootstrap order', () => {
  it('keeps renderer loading separate from raw BrowserWindow construction', () => {
    const source = readFileSync(resolve(process.cwd(), 'electron/main/index.ts'), 'utf8');
    const createWindowBlock = sliceBetween(
      source,
      'function createWindow(): BrowserWindow {',
      'function loadWindowContents(win: BrowserWindow): void {',
    );

    expect(createWindowBlock).not.toContain('win.loadURL(');
    expect(createWindowBlock).not.toContain('win.loadFile(');
  });

  it('starts IPC and host api before loading renderer content', () => {
    const source = readFileSync(resolve(process.cwd(), 'electron/main/index.ts'), 'utf8');

    const registerIpcIndex = source.indexOf('registerIpcHandlers(gatewayManager, clawHubService, window, hostApiSessionToken);');
    const hostApiIndex = source.indexOf('hostApiServer = startHostApiServer({');
    const loadRendererIndex = source.indexOf('loadWindowContents(window);');

    expect(registerIpcIndex).toBeGreaterThan(-1);
    expect(hostApiIndex).toBeGreaterThan(-1);
    expect(loadRendererIndex).toBeGreaterThan(-1);
    expect(registerIpcIndex).toBeLessThan(loadRendererIndex);
    expect(hostApiIndex).toBeLessThan(loadRendererIndex);
  });
});
