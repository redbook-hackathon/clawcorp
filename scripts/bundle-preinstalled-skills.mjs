#!/usr/bin/env zx

import 'zx/globals';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'resources', 'skills', 'preinstalled-manifest.json');
const OUTPUT_ROOT = join(ROOT, 'build', 'preinstalled-skills');
const TMP_ROOT = join(ROOT, 'build', '.tmp-preinstalled-skills');

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing manifest: ${MANIFEST_PATH}`);
  }

  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.skills)) {
    throw new Error('Invalid preinstalled-skills manifest format');
  }

  for (const item of parsed.skills) {
    if (!item.slug || !item.repo || !item.repoPath) {
      throw new Error(`Invalid manifest entry: ${JSON.stringify(item)}`);
    }
  }

  return parsed.skills;
}

function groupByRepoRef(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const ref = entry.ref || 'main';
    const key = `${entry.repo}#${ref}`;
    if (!grouped.has(key)) {
      grouped.set(key, { repo: entry.repo, ref, entries: [] });
    }
    grouped.get(key).entries.push(entry);
  }
  return [...grouped.values()];
}

function createRepoDirName(repo, ref) {
  return `${repo.replace(/[\\/]/g, '__')}__${ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function getSparseCheckoutGitCommands({ repo, ref, paths, checkoutDir }) {
  const remote = `https://github.com/${repo}.git`;
  // On Windows, MSYS git can misinterpret backslashes in paths passed via CLI as escape chars.
  // We must normalize paths to use forward slashes before giving them to git.
  const nCheckoutDir = checkoutDir.replace(/\\/g, '/');
  const nPaths = paths.map((p) => p.replace(/\\/g, '/'));
  
  return [
    ['git', ['init', nCheckoutDir]],
    ['git', ['-C', nCheckoutDir, 'remote', 'add', 'origin', remote]],
    ['git', ['-C', nCheckoutDir, 'sparse-checkout', 'init', '--cone']],
    ['git', ['-C', nCheckoutDir, 'sparse-checkout', 'set', ...nPaths]],
    ['git', ['-C', nCheckoutDir, 'fetch', '--depth', '1', 'origin', ref]],
    ['git', ['-C', nCheckoutDir, 'checkout', 'FETCH_HEAD']],
    ['git', ['-C', nCheckoutDir, 'rev-parse', 'HEAD']],
  ];
}

function runGit(command, args, { capture = false } = {}) {
  return execFileSync(command, args, {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: capture ? 'utf8' : undefined,
  });
}

async function fetchSparseRepo(repo, ref, paths, checkoutDir) {
  mkdirSync(checkoutDir, { recursive: true });

  const commands = getSparseCheckoutGitCommands({
    repo,
    ref,
    paths,
    checkoutDir,
  });

  for (let index = 0; index < commands.length - 1; index += 1) {
    const [command, args] = commands[index];
    runGit(command, args);
  }

  const [command, args] = commands[commands.length - 1];
  return runGit(command, args, { capture: true }).trim();
}

function isWindowsPathCompatibilityError(error) {
  const message = String(error?.message || error || '');
  return process.platform === 'win32'
    && message.includes('invalid path');
}

export async function main() {
  echo('Bundling preinstalled skills...');
  const manifestSkills = loadManifest();

  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  rmSync(TMP_ROOT, { recursive: true, force: true });
  mkdirSync(TMP_ROOT, { recursive: true });

  const lock = {
    generatedAt: new Date().toISOString(),
    skills: [],
  };

  const groups = groupByRepoRef(manifestSkills);
  for (const group of groups) {
    if (process.platform === 'win32' && group.repo === 'openclaw/skills') {
      echo(`   WARN skipped ${group.repo} on Windows due to upstream path names incompatible with NTFS checkout`);
      continue;
    }

    const repoDir = join(TMP_ROOT, createRepoDirName(group.repo, group.ref));
    const sparsePaths = [...new Set(group.entries.map((entry) => entry.repoPath))];

    echo(`Fetching ${group.repo} @ ${group.ref}`);
    let commit;
    try {
      commit = await fetchSparseRepo(group.repo, group.ref, sparsePaths, repoDir);
    } catch (error) {
      if (isWindowsPathCompatibilityError(error)) {
        echo(`   WARN skipped ${group.repo} on Windows due to invalid upstream path names`);
        continue;
      }
      throw error;
    }
    echo(`   commit ${commit}`);

    for (const entry of group.entries) {
      const sourceDir = join(repoDir, entry.repoPath);
      const targetDir = join(OUTPUT_ROOT, entry.slug);

      if (!existsSync(sourceDir)) {
        throw new Error(`Missing source path in repo checkout: ${entry.repoPath}`);
      }

      rmSync(targetDir, { recursive: true, force: true });
      cpSync(sourceDir, targetDir, { recursive: true, dereference: true });

      const skillManifest = join(targetDir, 'SKILL.md');
      if (!existsSync(skillManifest)) {
        throw new Error(`Skill ${entry.slug} is missing SKILL.md after copy`);
      }

      const requestedVersion = (entry.version || '').trim();
      const resolvedVersion = !requestedVersion || requestedVersion === 'main'
        ? commit
        : requestedVersion;

      lock.skills.push({
        slug: entry.slug,
        version: resolvedVersion,
        repo: entry.repo,
        repoPath: entry.repoPath,
        ref: group.ref,
        commit,
      });

      echo(`   OK ${entry.slug}`);
    }
  }

  writeFileSync(join(OUTPUT_ROOT, '.preinstalled-lock.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  rmSync(TMP_ROOT, { recursive: true, force: true });
  echo(`Preinstalled skills ready: ${OUTPUT_ROOT}`);
}

const scriptPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);
const invokedViaArgv = process.argv.some((arg) => arg?.includes('bundle-preinstalled-skills.mjs'));
const invokedViaNpmScript = process.env.npm_lifecycle_event === 'bundle:preinstalled-skills';

if (scriptPath === currentModulePath || invokedViaArgv || invokedViaNpmScript) {
  await main();
}
