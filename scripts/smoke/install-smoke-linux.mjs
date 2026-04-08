#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.split('=');
    return [key.replace(/^--/, ''), value];
  }),
);

const releaseDir = path.resolve(cwd, args.get('release-dir') || 'release');

function fail(message) {
  console.error(`[install-smoke-linux] FAIL: ${message}`);
  process.exit(1);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  if (result.error) {
    fail(`${command} failed to launch: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

if (!existsSync(releaseDir)) {
  fail(`release directory not found: ${releaseDir}`);
}

const debFiles = readdirSync(releaseDir)
  .filter((name) => /-linux-.*\.deb$/i.test(name))
  .map((name) => path.join(releaseDir, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

if (debFiles.length === 0) {
  fail(`no Linux .deb package found under ${releaseDir}`);
}

const debPath = debFiles[0];
const fields = run('dpkg-deb', ['--field', debPath]);
const contents = run('dpkg-deb', ['--contents', debPath]);

if (!/Depends:/i.test(fields)) {
  fail('deb control metadata has no Depends field');
}

if (!/(libgtk-3-0|libgtk-3-0t64)/i.test(fields)) {
  fail('deb dependencies do not include libgtk-3-0/libgtk-3-0t64');
}

const requiredContentPatterns = [
  /resources\/preinstalled-skills\/\.preinstalled-lock\.json/,
  /resources\/openclaw\/package\.json/,
  /resources\/openclaw-plugins\/[^/]+\/openclaw\.plugin\.json/,
];

for (const pattern of requiredContentPatterns) {
  if (!pattern.test(contents)) {
    fail(`deb payload missing expected entry pattern: ${pattern}`);
  }
}

console.log('[install-smoke-linux] PASS');
console.log(`[install-smoke-linux] checked: ${path.basename(debPath)}`);
