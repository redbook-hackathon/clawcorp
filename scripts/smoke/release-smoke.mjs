#!/usr/bin/env node

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.split('=');
    return [key.replace(/^--/, ''), value];
  }),
);

const releaseDir = path.resolve(cwd, args.get('release-dir') || 'release');
const linuxUnpackedDir = path.resolve(cwd, args.get('linux-unpacked') || path.join('release', 'linux-unpacked'));

function fail(message) {
  console.error(`[release-smoke] FAIL: ${message}`);
  process.exit(1);
}

function walkFiles(rootDir) {
  if (!existsSync(rootDir)) return [];

  const out = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

function assertExists(relativePath, description) {
  const fullPath = path.resolve(cwd, relativePath);
  if (!existsSync(fullPath)) {
    fail(`${description} not found: ${fullPath}`);
  }
}

function warnIfMissing(relativePath, description) {
  const fullPath = path.resolve(cwd, relativePath);
  if (!existsSync(fullPath)) {
    console.warn(`[release-smoke] WARN: ${description} not found: ${fullPath}`);
  }
}
// These build/* directories are intermediate packaging inputs. They are useful
// for diagnostics, but release correctness is determined by the packaged
// payloads under linux-unpacked / final artifacts. Do not fail the smoke check
// solely because an intermediate build directory was cleaned up or omitted.
warnIfMissing('build/openclaw/package.json', 'OpenClaw bundle');
warnIfMissing('build/preinstalled-skills/.preinstalled-lock.json', 'preinstalled-skills lock');
warnIfMissing('build/openclaw-plugins', 'OpenClaw plugin mirror bundle');

if (!existsSync(releaseDir)) {
  fail(`release directory not found: ${releaseDir}`);
}

const releaseFiles = walkFiles(releaseDir);
const linuxArtifacts = releaseFiles.filter((file) => /-linux-.*\.(AppImage|deb|rpm)$/i.test(path.basename(file)));

if (linuxArtifacts.length === 0) {
  fail(`no Linux release artifacts found under ${releaseDir}`);
}

if (existsSync(linuxUnpackedDir)) {
  const unpackedChecks = [
    'resources/preinstalled-skills/.preinstalled-lock.json',
    'resources/openclaw/package.json',
    'resources/openclaw/node_modules',
    'resources/openclaw-plugins',
  ];

  for (const rel of unpackedChecks) {
    const full = path.join(linuxUnpackedDir, rel);
    if (!existsSync(full)) {
      fail(`linux-unpacked missing ${rel}`);
    }
  }
}

console.log('[release-smoke] PASS');
console.log(`[release-smoke] linux artifacts: ${linuxArtifacts.length}`);
