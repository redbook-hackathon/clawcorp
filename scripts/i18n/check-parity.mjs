import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCALES_DIR = join(THIS_DIR, '..', '..', 'src', 'i18n', 'locales');
const BASE_LANGUAGE = 'zh';
const SUPPORTED_LANGUAGES = ['en', 'zh'];

function flattenObject(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = flattenObject(child, nextPrefix);
      return nested.length > 0 ? nested : [nextPrefix];
    }
    return [nextPrefix];
  });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function collectLocaleParityProblems(localesDir = DEFAULT_LOCALES_DIR) {
  const languages = readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((language) => SUPPORTED_LANGUAGES.includes(language))
    .sort();

  if (!languages.includes(BASE_LANGUAGE)) {
    throw new Error(`Base language "${BASE_LANGUAGE}" not found in ${localesDir}`);
  }

  const namespaceSet = new Set();
  for (const language of languages) {
    for (const entry of readdirSync(join(localesDir, language), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        namespaceSet.add(entry.name);
      }
    }
  }

  const namespaces = [...namespaceSet].sort();
  const problems = [];

  for (const namespace of namespaces) {
    const basePath = join(localesDir, BASE_LANGUAGE, namespace);
    const baseKeys = new Set(flattenObject(readJson(basePath)));

    for (const language of languages) {
      const filePath = join(localesDir, language, namespace);
      const currentKeys = new Set(flattenObject(readJson(filePath)));
      const missing = [...baseKeys].filter((key) => !currentKeys.has(key));
      const extra = [...currentKeys].filter((key) => !baseKeys.has(key));

      if (missing.length > 0) {
        problems.push({ type: 'missing', language, namespace, keys: missing });
      }
      if (extra.length > 0) {
        problems.push({ type: 'extra', language, namespace, keys: extra });
      }
    }
  }

  return { languages, namespaces, problems };
}

export function formatLocaleParityProblems(report) {
  if (report.problems.length === 0) {
    return `Locale parity OK across ${report.languages.join(', ')} (${report.namespaces.length} namespaces).`;
  }

  return report.problems
    .map((problem) => `${problem.type.toUpperCase()} ${problem.language}/${problem.namespace}: ${problem.keys.join(', ')}`)
    .join('\n');
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const report = collectLocaleParityProblems();
  const output = formatLocaleParityProblems(report);
  if (report.problems.length > 0) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
}
