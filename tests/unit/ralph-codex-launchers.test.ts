import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const workspaceRoots: string[] = [];

function makeWorkspace(name: string) {
  const root = mkdtempSync(path.join(tmpdir(), `${name}-`));
  workspaceRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of workspaceRoots.splice(0)) {
    if (existsSync(root)) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('ralph codex launchers', () => {
  it('bash launcher forwards to the node runner with all args', () => {
    const launcherPath = path.join(process.cwd(), 'scripts', 'ralph', 'ralph-codex.sh');
    const source = readFileSync(launcherPath, 'utf8');

    expect(source).toContain('ralph-codex.mjs');
    expect(source).toContain('"$@"');
    expect(source).toMatch(/RALPH_NODE_BIN|node/);
  });

  it('powershell launcher forwards arguments into the node runner', () => {
    const root = makeWorkspace('ralph-codex-ps1');
    const scriptsDir = path.join(root, 'scripts', 'ralph');
    const outputFile = path.join(root, 'ps1-args.txt');
    const runnerPath = path.join(scriptsDir, 'ralph-codex.mjs');
    const launcherPath = path.join(scriptsDir, 'ralph-codex.ps1');

    mkdirSync(scriptsDir, { recursive: true });
    copyFileSync(path.join(process.cwd(), 'scripts', 'ralph', 'ralph-codex.ps1'), launcherPath);
    writeFileSync(
      runnerPath,
      `
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(outputFile)}, JSON.stringify(process.argv.slice(2)), 'utf8');
`,
      { encoding: 'utf8', flag: 'w' },
    );

    const result = spawnSync(
      'powershell',
      [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        launcherPath,
        '5',
        '--forever',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          RALPH_NODE_BIN: process.execPath,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(outputFile, 'utf8')).toBe(JSON.stringify(['5', '--forever']));
  });
});
