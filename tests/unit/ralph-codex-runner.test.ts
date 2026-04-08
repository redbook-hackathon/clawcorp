import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function writeExecutable(filePath: string, contents: string) {
  writeFileSync(filePath, contents, 'utf8');
  chmodSync(filePath, 0o755);
}

function createCodexStub(root: string, behavior: 'complete' | 'continue') {
  const binDir = path.join(root, 'bin');
  const logFile = path.join(root, 'codex-log.json');
  const outputFile = path.join(root, 'codex-output.txt');
  const codexCmd = path.join(binDir, 'codex.cmd');
  const codexJs = path.join(binDir, 'codex-stub.mjs');

  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    codexJs,
    `
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + '\\n', 'utf8');
const prompt = readFileSync(0, 'utf8');
writeFileSync(${JSON.stringify(outputFile)}, prompt, 'utf8');
process.stdout.write(${JSON.stringify(behavior === 'complete' ? '<promise>COMPLETE</promise>' : 'keep-going')});
`,
    'utf8',
  );

  writeExecutable(codexCmd, `@echo off\r\nnode "${codexJs}" %*\r\n`);

  return { binDir, logFile, outputFile };
}

function writeFixtureRepo(root: string, options?: { withProgress?: boolean }) {
  writeFileSync(
    path.join(root, 'prd.json'),
    JSON.stringify(
      {
        project: 'ClawCorp',
        branchName: 'ralph/codex-loop',
        description: 'Codex Ralph',
        userStories: [
          {
            id: 'US-001',
            title: 'Add loop',
            description: 'As a developer, I want a loop.',
            acceptanceCriteria: ['Typecheck passes'],
            priority: 1,
            passes: false,
            notes: '',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  if (options?.withProgress) {
    writeFileSync(path.join(root, 'progress.txt'), '# Ralph Progress Log\n---\n', 'utf8');
  }
}

function runRunner(repoRoot: string, args: string[] = [], extraPath?: string) {
  return spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts', 'ralph', 'ralph-codex.mjs'), ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: extraPath ? `${extraPath};${process.env.PATH ?? ''}` : process.env.PATH,
      },
    },
  );
}

afterEach(() => {
  for (const root of workspaceRoots.splice(0)) {
    if (existsSync(root)) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('ralph-codex runner', () => {
  it('fails fast when prd.json is missing', () => {
    const repoRoot = makeWorkspace('ralph-codex-no-prd');

    const result = runRunner(repoRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('prd.json');
  });

  it('initializes progress and stops on completion marker', () => {
    const repoRoot = makeWorkspace('ralph-codex-complete');
    writeFixtureRepo(repoRoot);
    writeFileSync(path.join(repoRoot, 'CODEX.md'), 'Prompt body', 'utf8');
    const { binDir, logFile, outputFile } = createCodexStub(repoRoot, 'complete');

    const result = runRunner(repoRoot, ['--prompt', 'CODEX.md', '3'], binDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Ralph completed all tasks');
    expect(readFileSync(path.join(repoRoot, 'progress.txt'), 'utf8')).toContain('# Ralph Progress Log');
    expect(readFileSync(outputFile, 'utf8')).toBe('Prompt body');
    const firstCall = JSON.parse(readFileSync(logFile, 'utf8').trim().split(/\r?\n/)[0] ?? '[]') as string[];
    expect(firstCall).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(firstCall).toContain('-C');
    expect(firstCall).toContain(repoRoot);
    expect(firstCall.at(-1)).toBe('-');
  });

  it('continues until the requested iteration count when completion is absent', () => {
    const repoRoot = makeWorkspace('ralph-codex-continue');
    writeFixtureRepo(repoRoot, { withProgress: true });
    writeFileSync(path.join(repoRoot, 'CODEX.md'), 'Keep going prompt', 'utf8');
    const { binDir, logFile } = createCodexStub(repoRoot, 'continue');

    const result = runRunner(repoRoot, ['--prompt', 'CODEX.md', '2'], binDir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Ralph reached max iterations (2)');
    expect(readFileSync(logFile, 'utf8').trim().split(/\r?\n/)).toHaveLength(2);
  });

  it('supports explicit forever mode', () => {
    const repoRoot = makeWorkspace('ralph-codex-forever');
    writeFixtureRepo(repoRoot, { withProgress: true });
    writeFileSync(path.join(repoRoot, 'CODEX.md'), 'Forever prompt', 'utf8');
    const { binDir, logFile } = createCodexStub(repoRoot, 'complete');

    const result = runRunner(repoRoot, ['--prompt', 'CODEX.md', '--forever'], binDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Max iterations: forever');
    expect(readFileSync(logFile, 'utf8').trim().split(/\r?\n/)).toHaveLength(1);
  });
});
