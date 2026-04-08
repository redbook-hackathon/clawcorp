import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const OUTBOUND_MEDIA_DIR = join(homedir(), '.openclaw', 'media', 'outbound');

function normalizePath(value: string): string {
  const resolved = resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function getOutboundMediaDir(): string {
  return OUTBOUND_MEDIA_DIR;
}

export function isOutboundMediaPath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return false;
  }
  const base = normalizePath(OUTBOUND_MEDIA_DIR);
  const target = normalizePath(filePath);
  if (target === base) {
    return true;
  }
  const baseWithSep = base.endsWith(sep) ? base : `${base}${sep}`;
  return target.startsWith(baseWithSep);
}
