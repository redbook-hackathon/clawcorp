#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`[ralph-codex] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let promptPath = null;
  let forever = false;
  let maxIterations = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prompt') {
      promptPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--forever') {
      forever = true;
      continue;
    }
    if (/^\d+$/.test(arg)) {
      maxIterations = Number.parseInt(arg, 10);
    }
  }

  return { promptPath, forever, maxIterations };
}

function ensureProgressFile(progressFile) {
  if (existsSync(progressFile)) {
    return;
  }
  writeFileSync(progressFile, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`, 'utf8');
}

function archiveIfBranchChanged(repoRoot, prdData) {
  const lastBranchFile = path.join(repoRoot, '.last-branch');
  const progressFile = path.join(repoRoot, 'progress.txt');
  if (!existsSync(lastBranchFile)) {
    return;
  }

  const previousBranch = readFileSync(lastBranchFile, 'utf8').trim();
  const currentBranch = typeof prdData.branchName === 'string' ? prdData.branchName : '';
  if (!previousBranch || !currentBranch || previousBranch === currentBranch) {
    return;
  }

  const archiveRoot = path.join(repoRoot, 'archive');
  const date = new Date().toISOString().slice(0, 10);
  const folderName = `${date}-${previousBranch.replace(/^ralph\//, '').replace(/[\\/]/g, '-')}`;
  const archiveDir = path.join(archiveRoot, folderName);
  mkdirSync(archiveDir, { recursive: true });
  const prdFile = path.join(repoRoot, 'prd.json');
  cpSync(prdFile, path.join(archiveDir, 'prd.json'));
  if (existsSync(progressFile)) {
    cpSync(progressFile, path.join(archiveDir, 'progress.txt'));
  }
  writeFileSync(progressFile, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`, 'utf8');
}

function loadPrd(repoRoot) {
  const prdFile = path.join(repoRoot, 'prd.json');
  if (!existsSync(prdFile)) {
    fail(`Missing prd.json at ${prdFile}`);
  }

  try {
    return JSON.parse(readFileSync(prdFile, 'utf8'));
  } catch (error) {
    fail(`Unable to parse prd.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolvePromptPath(repoRoot, promptPathArg) {
  if (promptPathArg) {
    return path.resolve(repoRoot, promptPathArg);
  }
  return path.join(repoRoot, 'scripts', 'ralph', 'CODEX.md');
}

function runCodexIteration(repoRoot, prompt, codexBin) {
  const result = spawnSync(
    codexBin,
    ['exec', '--dangerously-bypass-approvals-and-sandbox', '-C', repoRoot, '-'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
      input: prompt,
      shell: process.platform === 'win32',
    },
  );

  if (result.error) {
    fail(`Unable to launch ${codexBin}: ${result.error.message}`);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function main() {
  const repoRoot = process.cwd();
  const { promptPath, forever, maxIterations } = parseArgs(process.argv.slice(2));
  const prdData = loadPrd(repoRoot);
  const promptFile = resolvePromptPath(repoRoot, promptPath);
  if (!existsSync(promptFile)) {
    fail(`Missing prompt file at ${promptFile}`);
  }

  const prompt = readFileSync(promptFile, 'utf8');
  archiveIfBranchChanged(repoRoot, prdData);

  const lastBranchFile = path.join(repoRoot, '.last-branch');
  if (typeof prdData.branchName === 'string' && prdData.branchName) {
    writeFileSync(lastBranchFile, `${prdData.branchName}\n`, 'utf8');
  }

  const progressFile = path.join(repoRoot, 'progress.txt');
  ensureProgressFile(progressFile);

  const codexBin = process.env.RALPH_CODEX_BIN || 'codex';
  const maxLabel = forever ? 'forever' : String(maxIterations);
  console.log(`Starting Ralph - Tool: codex - Max iterations: ${maxLabel}`);

  let iteration = 1;
  while (forever || iteration <= maxIterations) {
    console.log('');
    console.log('===============================================================');
    console.log(`  Ralph Iteration ${iteration} of ${maxLabel} (codex)`);
    console.log('===============================================================');

    const output = runCodexIteration(repoRoot, prompt, codexBin);
    if (output.includes('<promise>COMPLETE</promise>')) {
      console.log('');
      console.log('Ralph completed all tasks!');
      console.log(`Completed at iteration ${iteration} of ${maxLabel}`);
      process.exit(0);
    }

    console.log(`Iteration ${iteration} complete. Continuing...`);
    iteration += 1;
  }

  console.log('');
  console.log(`Ralph reached max iterations (${maxIterations}) without completing all tasks.`);
  console.log(`Check ${progressFile} for status.`);
  process.exit(1);
}

main();
