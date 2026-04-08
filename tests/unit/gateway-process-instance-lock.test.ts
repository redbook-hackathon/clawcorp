import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { acquireProcessInstanceFileLock } from '@electron/main/process-instance-lock';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'clawcorp-instance-lock-'));
}

describe('process instance file lock', () => {
  it('acquires and releases lock file for current process', () => {
    const userDataDir = createTempDir();
    try {
      const lock = acquireProcessInstanceFileLock({
        userDataDir,
        lockName: 'clawcorp',
        pid: 1234,
      });

      expect(lock.acquired).toBe(true);
      expect(existsSync(lock.lockPath)).toBe(true);

      lock.release();
      expect(existsSync(lock.lockPath)).toBe(false);
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  it('replaces stale lock owner when pid is no longer alive', () => {
    const userDataDir = createTempDir();
    try {
      const lockPath = join(userDataDir, 'clawcorp.instance.lock');
      writeFileSync(lockPath, '99999', 'utf8');

      const lock = acquireProcessInstanceFileLock({
        userDataDir,
        lockName: 'clawcorp',
        pid: 5678,
        isPidAlive: () => false,
      });

      expect(lock.acquired).toBe(true);
      lock.release();
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  it('force mode removes existing lock before acquisition', () => {
    const userDataDir = createTempDir();
    try {
      const lockPath = join(userDataDir, 'clawcorp.instance.lock');
      writeFileSync(lockPath, '7777', 'utf8');

      const lock = acquireProcessInstanceFileLock({
        userDataDir,
        lockName: 'clawcorp',
        pid: 1357,
        isPidAlive: () => true,
        force: true,
      });

      expect(lock.acquired).toBe(true);
      lock.release();
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
