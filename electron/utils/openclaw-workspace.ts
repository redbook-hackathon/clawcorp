/**
 * OpenClaw workspace context utilities.
 *
 * All file I/O is async (fs/promises) to avoid blocking the Electron
 * main thread.
 */
import { access, readFile, writeFile, readdir, mkdir, unlink } from 'fs/promises';
import { constants } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { logger } from './logger';
import { getResourcesDir } from './paths';
import { createTeam } from './team-config';

const CLAWX_BEGIN = '<!-- clawx:begin -->';
const CLAWX_END = '<!-- clawx:end -->';

// ── Helpers ──────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function ensureDir(dir: string): Promise<void> {
  if (!(await fileExists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

// ── Pure helpers (no I/O) ────────────────────────────────────────

/**
 * Merge a ClawCorp context section into an existing file's content.
 * If markers already exist, replaces the section in-place.
 * Otherwise appends it at the end.
 */
export function mergeClawCorpSection(existing: string, section: string): string {
  const wrapped = `${CLAWX_BEGIN}\n${section.trim()}\n${CLAWX_END}`;
  const beginIdx = existing.indexOf(CLAWX_BEGIN);
  const endIdx = existing.indexOf(CLAWX_END);
  if (beginIdx !== -1 && endIdx !== -1) {
    return existing.slice(0, beginIdx) + wrapped + existing.slice(endIdx + CLAWX_END.length);
  }
  return existing.trimEnd() + '\n\n' + wrapped + '\n';
}

// ── Workspace directory resolution ───────────────────────────────

/**
 * Collect all unique workspace directories from the openclaw config:
 * the defaults workspace, each agent's workspace, and any workspace-*
 * directories that already exist under ~/.openclaw/.
 */
async function resolveAllWorkspaceDirs(): Promise<string[]> {
  const openclawDir = join(homedir(), '.openclaw');
  const dirs = new Set<string>();

  const configPath = join(openclawDir, 'openclaw.json');
  try {
    if (await fileExists(configPath)) {
      const config = JSON.parse(await readFile(configPath, 'utf-8'));

      const defaultWs = config?.agents?.defaults?.workspace;
      if (typeof defaultWs === 'string' && defaultWs.trim()) {
        dirs.add(defaultWs.replace(/^~/, homedir()));
      }

      const agents = config?.agents?.list;
      if (Array.isArray(agents)) {
        for (const agent of agents) {
          const ws = agent?.workspace;
          if (typeof ws === 'string' && ws.trim()) {
            dirs.add(ws.replace(/^~/, homedir()));
          }
        }
      }
    }
  } catch {
    // ignore config parse errors
  }

  // We intentionally do NOT scan ~/.openclaw/ for any directory starting
  // with 'workspace'. Doing so causes a race condition where a recently deleted
  // agent's workspace (e.g., workspace-code23) is found and resuscitated by
  // the context merge routine before its deletion finishes. Only workspaces
  // explicitly declared in openclaw.json should be seeded.

  if (dirs.size === 0) {
    dirs.add(join(openclawDir, 'workspace'));
  }

  return [...dirs];
}

// ── Bootstrap file repair ────────────────────────────────────────

/**
 * Detect and remove bootstrap .md files that contain only ClawCorp markers
 * with no meaningful OpenClaw content outside them.
 */
export async function repairClawCorpOnlyBootstrapFiles(): Promise<void> {
  const workspaceDirs = await resolveAllWorkspaceDirs();
  for (const workspaceDir of workspaceDirs) {
    if (!(await fileExists(workspaceDir))) continue;

    let entries: string[];
    try {
      entries = (await readdir(workspaceDir)).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of entries) {
      const filePath = join(workspaceDir, file);
      let content: string;
      try {
        content = await readFile(filePath, 'utf-8');
      } catch {
        continue;
      }
      const beginIdx = content.indexOf(CLAWX_BEGIN);
      const endIdx = content.indexOf(CLAWX_END);
      if (beginIdx === -1 || endIdx === -1) continue;

      const before = content.slice(0, beginIdx).trim();
      const after = content.slice(endIdx + CLAWX_END.length).trim();
      if (before === '' && after === '') {
        try {
          await unlink(filePath);
          logger.info(`Removed ClawCorp-only bootstrap file for re-seeding: ${file} (${workspaceDir})`);
        } catch {
          logger.warn(`Failed to remove ClawCorp-only bootstrap file: ${filePath}`);
        }
      }
    }
  }
}

// ── Context merging ──────────────────────────────────────────────

/**
 * Merge ClawCorp context snippets into workspace bootstrap files that
 * already exist on disk.  Returns the number of target files that were
 * skipped because they don't exist yet.
 */
async function mergeClawCorpContextOnce(): Promise<number> {
  const contextDir = join(getResourcesDir(), 'context');
  if (!(await fileExists(contextDir))) {
    logger.debug('ClawCorp context directory not found, skipping context merge');
    return 0;
  }

  let files: string[];
  try {
    files = (await readdir(contextDir)).filter((f) => f.endsWith('.clawx.md'));
  } catch {
    return 0;
  }

  const workspaceDirs = await resolveAllWorkspaceDirs();
  let skipped = 0;

  for (const workspaceDir of workspaceDirs) {
    await ensureDir(workspaceDir);

    for (const file of files) {
      const targetName = file.replace('.clawx.md', '.md');
      const targetPath = join(workspaceDir, targetName);

      if (!(await fileExists(targetPath))) {
        logger.debug(`Skipping ${targetName} in ${workspaceDir} (file does not exist yet, will be seeded by gateway)`);
        skipped++;
        continue;
      }

      const section = await readFile(join(contextDir, file), 'utf-8');
      const existing = await readFile(targetPath, 'utf-8');

      const merged = mergeClawCorpSection(existing, section);
      if (merged !== existing) {
        await writeFile(targetPath, merged, 'utf-8');
        logger.info(`Merged ClawCorp context into ${targetName} (${workspaceDir})`);
      }
    }
  }

  return skipped;
}

const RETRY_INTERVAL_MS = 2000;
const MAX_RETRIES = 15;

/**
 * Ensure ClawCorp context snippets are merged into the openclaw workspace
 * bootstrap files.
 */
export async function ensureClawCorpContext(): Promise<void> {
  let skipped = await mergeClawCorpContextOnce();
  if (skipped === 0) return;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    skipped = await mergeClawCorpContextOnce();
    if (skipped === 0) {
      logger.info(`ClawCorp context merge completed after ${attempt} retry(ies)`);
      return;
    }
    logger.debug(`ClawCorp context merge: ${skipped} file(s) still missing (retry ${attempt}/${MAX_RETRIES})`);
  }

  logger.warn(`ClawCorp context merge: ${skipped} file(s) still missing after ${MAX_RETRIES} retries`);
}

// ── Workspace clone utilities ──────────────────────────────────────

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function readOpenclawConfig(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(OPENCLAW_CONFIG, 'utf-8'));
  } catch {
    return { agents: { defaults: {}, list: [] }, templates: [] };
  }
}

async function writeOpenclawConfig(config: Record<string, unknown>): Promise<void> {
  await ensureDir(OPENCLAW_DIR);
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      const { copyFile } = await import('fs/promises');
      await copyFile(srcPath, destPath);
    }
  }
}

export async function cloneWorkspaceFromTemplate(templateId: string, agentName: string): Promise<string> {
  const config = await readOpenclawConfig();
  const templates = (config.templates || []) as Array<{ id: string; path: string }>;
  const template = templates.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const slug = slugify(agentName) || templateId;
  const newDir = join(OPENCLAW_DIR, `workspace-${slug}`);

  if (await fileExists(newDir)) {
    throw new Error(`Workspace already exists: ${newDir}`);
  }

  await copyDir(template.path, newDir);

  const agentsSection = (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents))
    ? { ...(config.agents as Record<string, unknown>) }
    : {};
  const agentList = Array.isArray(agentsSection.list)
    ? [...(agentsSection.list as Array<Record<string, unknown>>)]
    : [];
  agentList.push({
    id: slug,
    name: agentName,
    workspace: `~/.openclaw/workspace-${slug}`,
    source: 'marketplace',
  });
  config.agents = { ...agentsSection, list: agentList };
  await writeOpenclawConfig(config);

  return newDir;
}

export async function importLocalWorkspace(sourcePath: string): Promise<string> {
  if (!(await fileExists(sourcePath))) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const entries = await readdir(sourcePath);
  const hasStructure = entries.some(f =>
    f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.claude'
  );
  if (!hasStructure) {
    throw new Error('Source does not look like an OpenClaw workspace (missing AGENTS.md, CLAUDE.md, or .claude)');
  }

  const dirname = basename(sourcePath);
  const slug = slugify(dirname);
  const newDir = join(OPENCLAW_DIR, `workspace-${slug}`);

  if (await fileExists(newDir)) {
    throw new Error(`Workspace already exists: ${newDir}`);
  }

  await copyDir(sourcePath, newDir);

  const config = await readOpenclawConfig();
  const agentsSection = (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents))
    ? { ...(config.agents as Record<string, unknown>) }
    : {};
  const agentList = Array.isArray(agentsSection.list)
    ? [...(agentsSection.list as Array<Record<string, unknown>>)]
    : [];
  const localSlug = slugify(dirname);
  agentList.push({
    id: `local-${Date.now()}`,
    name: dirname,
    workspace: `~/.openclaw/workspace-${localSlug}`,
    source: 'local',
  });
  config.agents = { ...agentsSection, list: agentList };
  await writeOpenclawConfig(config);

  return newDir;
}

// ── Marketplace template utilities ───────────────────────────────

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  vibe: string;
  role: string;
  hireType: 'single' | 'team';
  capabilities: string[];
  tags: string[];
  price: string;
  avatar: string;
  rating: number;
  hiredCount: number;
}

async function readIdentityFile(dirPath: string): Promise<{ name: string; emoji: string; vibe: string; role: string; avatar: string; rating?: number } | null> {
  const identityPath = join(dirPath, 'IDENTITY.md');
  if (!(await fileExists(identityPath))) return null;
  const content = await readFile(identityPath, 'utf-8');
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);
  const vibeMatch = content.match(/\*\*Vibe:\*\*\s*(.+)/);
  const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
  const avatarMatch = content.match(/\*\*Avatar:\*\*\s*(.+)/);
  const ratingMatch = content.match(/\*\*Rating:\*\*\s*(.+)/);
  const parsedRating = ratingMatch ? parseFloat(ratingMatch[1].trim()) : undefined;
  return {
    name: nameMatch?.[1]?.trim() || '',
    emoji: emojiMatch?.[1]?.trim() || '',
    vibe: vibeMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || '',
    avatar: avatarMatch?.[1]?.trim() || '',
    rating: parsedRating && !isNaN(parsedRating) ? parsedRating : undefined,
  };
}

async function readAgentsFile(dirPath: string): Promise<string[]> {
  const agentsPath = join(dirPath, 'AGENTS.md');
  if (!(await fileExists(agentsPath))) return [];
  const content = await readFile(agentsPath, 'utf-8');
  const lines = content.split('\n');
  const capabilities: string[] = [];
  for (const line of lines) {
    if (line.startsWith('- **') && line.includes('**：')) {
      const match = line.match(/- \*\*[^：]+[^：]*\*\*[：:]\s*(.+)/);
      if (match) {
        capabilities.push(match[1].trim());
      }
    }
  }
  return capabilities;
}

export async function listMarketplaceTemplates(): Promise<MarketplaceTemplate[]> {
  const marketplaceDir = join(getResourcesDir(), 'marketplace');
  if (!(await fileExists(marketplaceDir))) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(marketplaceDir);
  } catch {
    return [];
  }

  const templates: MarketplaceTemplate[] = [];
  for (const entry of entries) {
    const dirPath = join(marketplaceDir, entry);
    // Skip non-directory entries (e.g. avatars/ folder)
    try {
      const stat = await import('fs/promises').then(m => m.stat(dirPath));
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const identity = await readIdentityFile(dirPath);
    if (!identity) continue;

    const capabilities = await readAgentsFile(dirPath);
    const hireType: 'single' | 'team' = capabilities.length > 1 ? 'team' : 'single';

    // Derive tags from capabilities (simple heuristic)
    const tags = capabilities.length > 0
      ? capabilities.slice(0, 3).map(cap => cap)
      : [identity.vibe.split('、')[0] || '专家'];

    // Check for local avatar file → convert to data URL
    let avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${entry}&backgroundColor=FFD233`;
    // Check for avatar.png or avatar.jpg in template dir
    for (const ext of ['png', 'jpg', 'jpeg', 'svg']) {
      const avatarPath = join(dirPath, `avatar.${ext}`);
      if (await fileExists(avatarPath)) {
        try {
          const avatarData = await readFile(avatarPath);
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
          avatarUrl = `data:${mime};base64,${avatarData.toString('base64')}`;
        } catch {
          // fallback to dicebear
        }
        break;
      }
    }

    templates.push({
      id: entry,
      name: identity.name,
      description: identity.role,
      emoji: identity.emoji,
      vibe: identity.vibe,
      role: identity.role,
      hireType,
      capabilities,
      tags,
      price: hireType === 'team' ? '$59/mo' : '$19/mo',
      avatar: avatarUrl,
      rating: identity.rating ?? (4.5 + Math.random() * 0.5),
      hiredCount: Math.floor(Math.random() * 300) + 1,
    });
  }

  return templates;
}

function buildSingleSoulContent(identity: { name: string; vibe: string; role: string }): string {
  return [
    `# ${identity.name}`,
    '',
    `**Vibe:** ${identity.vibe}`,
    '',
    `**Role:** ${identity.role}`,
    '',
  ].join('\n');
}

export async function hireFromMarketplaceTemplate(
  templateId: string,
  agentName: string,
): Promise<{ workspacePath: string; agentId: string }> {
  const templateDir = join(getResourcesDir(), 'marketplace', templateId);
  if (!(await fileExists(templateDir))) {
    throw new Error(`Marketplace template not found: ${templateId}`);
  }

  const slug = slugify(agentName) || templateId;
  const newWorkspace = join(OPENCLAW_DIR, `workspace-${slug}`);

  // Clean up empty/broken workspace from a prior failed attempt
  if (await fileExists(newWorkspace)) {
    try {
      const entries = await readdir(newWorkspace);
      // If workspace is empty or only has partial data from a failed clone, remove it
      if (entries.length === 0 || (entries.length <= 2 && !entries.some(e => e.endsWith('.md')))) {
        await (await import('fs/promises')).rm(newWorkspace, { recursive: true, force: true });
      } else {
        throw new Error(`Workspace already exists: ${newWorkspace}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Workspace already exists')) throw err;
      throw new Error(`Workspace already exists: ${newWorkspace}`);
    }
  }

  if (await fileExists(newWorkspace)) {
    throw new Error(`Workspace already exists: ${newWorkspace}`);
  }

  // Copy template files to new workspace
  await copyDir(templateDir, newWorkspace);

  // Read identity for SOUL.md customization
  const identityPath = join(templateDir, 'IDENTITY.md');
  let identity = { name: agentName, vibe: '', role: '' };
  if (await fileExists(identityPath)) {
    const content = await readFile(identityPath, 'utf-8');
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const vibeMatch = content.match(/\*\*Vibe:\*\*\s*(.+)/);
    const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
    identity = {
      name: nameMatch?.[1]?.trim() || agentName,
      vibe: vibeMatch?.[1]?.trim() || '',
      role: roleMatch?.[1]?.trim() || '',
    };
  }

  // Read avatar for agent entry
  let avatarUrl: string | undefined;
  for (const ext of ['png', 'jpg', 'jpeg', 'svg']) {
    const avatarPath = join(templateDir, `avatar.${ext}`);
    if (await fileExists(avatarPath)) {
      try {
        const avatarData = await readFile(avatarPath);
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
        avatarUrl = `data:${mime};base64,${avatarData.toString('base64')}`;
      } catch { /* fallback */ }
      break;
    }
  }

  // Write customized SOUL.md
  const soulContent = buildSingleSoulContent(identity);
  await writeFile(join(newWorkspace, 'SOUL.md'), soulContent, 'utf-8');

  // Register agent in openclaw.json
  const config = await readOpenclawConfig();
  const agentsSection = (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents))
    ? { ...(config.agents as Record<string, unknown>) }
    : {};
  const existingList = Array.isArray(agentsSection.list)
    ? [...(agentsSection.list as Array<Record<string, unknown>>)]
    : [];

  // Ensure unique ID — use templateId as fallback when slug is empty (CJK names)
  let agentId = slug;
  let suffix = 2;
  const existingIds = new Set(existingList.map((a: Record<string, unknown>) => String(a.id)));
  while (existingIds.has(agentId)) {
    agentId = `${slug}-${suffix}`;
    suffix++;
  }

  const agentEntry: Record<string, unknown> = {
    id: agentId,
    name: agentName,
    workspace: `~/.openclaw/workspace-${agentId}`,
    source: 'marketplace',
    templateId,
  };
  if (avatarUrl) agentEntry.avatar = avatarUrl;
  existingList.push(agentEntry);

  config.agents = { ...agentsSection, list: existingList };
  await writeOpenclawConfig(config);

  return { workspacePath: newWorkspace, agentId };
}

export async function hireTeamFromMarketplaceTemplate(
  templateId: string,
  teamName: string,
  capabilities: string[],
): Promise<{ leaderId: string; workerIds: string[]; teamId: string; teamName: string }> {
  const templateDir = join(getResourcesDir(), 'marketplace', templateId);
  if (!(await fileExists(templateDir))) {
    throw new Error(`Marketplace template not found: ${templateId}`);
  }

  const config = await readOpenclawConfig();
  const agentsSection = (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents))
    ? { ...(config.agents as Record<string, unknown>) }
    : {};
  const existingList = Array.isArray(agentsSection.list)
    ? [...(agentsSection.list as Array<Record<string, unknown>>)]
    : [];
  const existingIds = new Set(existingList.map((a: Record<string, unknown>) => String(a.id)));

  // Read template identity
  const identityPath = join(templateDir, 'IDENTITY.md');
  let templateIdentity = { name: teamName, vibe: '', role: '' };
  if (await fileExists(identityPath)) {
    const content = await readFile(identityPath, 'utf-8');
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const vibeMatch = content.match(/\*\*Vibe:\*\*\s*(.+)/);
    const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
    templateIdentity = {
      name: nameMatch?.[1]?.trim() || teamName,
      vibe: vibeMatch?.[1]?.trim() || '',
      role: roleMatch?.[1]?.trim() || '',
    };
  }

  // Read avatar for agent entries
  let teamAvatarUrl: string | undefined;
  for (const ext of ['png', 'jpg', 'jpeg', 'svg']) {
    const avatarPath = join(templateDir, `avatar.${ext}`);
    if (await fileExists(avatarPath)) {
      try {
        const avatarData = await readFile(avatarPath);
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
        teamAvatarUrl = `data:${mime};base64,${avatarData.toString('base64')}`;
      } catch { /* fallback */ }
      break;
    }
  }

  const leaderSlug = slugify(teamName) || templateId;
  let leaderId = leaderSlug;
  let suffix = 2;
  while (existingIds.has(leaderId)) {
    leaderId = `${leaderSlug}-${suffix}`;
    suffix++;
  }

  const leaderDir = join(OPENCLAW_DIR, `workspace-${leaderId}`);
  if (await fileExists(leaderDir)) {
    throw new Error(`Leader workspace already exists: ${leaderDir}`);
  }

  await copyDir(templateDir, leaderDir);
  const leaderSoulContent = buildLeaderSoulContent(teamName, capabilities);
  await writeFile(join(leaderDir, 'SOUL.md'), leaderSoulContent, 'utf-8');

  const leaderEntry: Record<string, unknown> = {
    id: leaderId,
    name: teamName,
    workspace: `~/.openclaw/workspace-${leaderId}`,
    teamRole: 'leader',
    responsibility: `Team leader for ${teamName}`,
    source: 'marketplace',
    templateId,
    templateName: templateIdentity.name,
  };
  if (teamAvatarUrl) leaderEntry.avatar = teamAvatarUrl;

  const newAgents: Record<string, unknown>[] = [leaderEntry];

  const workerIds: string[] = [];
  for (const capability of capabilities) {
    const capSlug = slugify(capability);
    let workerId = `${leaderSlug}-${capSlug}`;
    suffix = 2;
    while (existingIds.has(workerId) || workerIds.includes(workerId)) {
      workerId = `${leaderSlug}-${capSlug}-${suffix}`;
      suffix++;
    }
    workerIds.push(workerId);

    const workerDir = join(OPENCLAW_DIR, `workspace-${workerId}`);
    if (await fileExists(workerDir)) {
      throw new Error(`Worker workspace already exists: ${workerDir}`);
    }

    await copyDir(templateDir, workerDir);
    const workerSoulContent = buildWorkerSoulContent(teamName, capability, leaderId);
    await writeFile(join(workerDir, 'SOUL.md'), workerSoulContent, 'utf-8');

    const workerEntry: Record<string, unknown> = {
      id: workerId,
      name: capability,
      workspace: `~/.openclaw/workspace-${workerId}`,
      teamRole: 'worker',
      reportsTo: leaderId,
      chatAccess: 'leader_only',
      responsibility: capability,
      source: 'marketplace',
      templateId,
      templateName: templateIdentity.name,
    };
    if (teamAvatarUrl) workerEntry.avatar = teamAvatarUrl;
    newAgents.push(workerEntry);
  }

  config.agents = { ...agentsSection, list: [...existingList, ...newAgents] };
  await writeOpenclawConfig(config);

  // Create Team entity
  const team = await createTeam({
    leaderId,
    memberIds: workerIds,
    name: teamName,
    description: `${teamName} — ${templateIdentity.vibe}`,
  });

  return { leaderId, workerIds, teamId: team.id, teamName };
}

// ── Team hire utilities ──────────────────────────────────────────

function buildLeaderSoulContent(teamName: string, capabilities: string[]): string {
  const capabilityLines = capabilities
    .map((cap, i) => `${i + 1}. **${cap}** — delegated to worker agent`)
    .join('\n');

  return [
    `# ${teamName} — Team Leader`,
    '',
    `You are the leader of the "${teamName}" team.`,
    'Your role is to coordinate tasks across your team members.',
    '',
    '## Team Capabilities',
    capabilityLines,
    '',
    '## How to Delegate',
    'When a task matches one of the capabilities above, spawn a sub-session',
    'for the corresponding worker agent using sessions_spawn.',
    'Each worker is specialized in their domain.',
    '',
    '## Decision Making',
    '- Break down complex requests into sub-tasks for each capability',
    '- Synthesize results from workers into a coherent response',
    '- Escalate ambiguous requests back to the user for clarification',
    '',
  ].join('\n');
}

function buildWorkerSoulContent(teamName: string, capability: string, leaderId: string): string {
  return [
    `# ${capability} Specialist`,
    '',
    `You are the "${capability}" specialist worker on the "${teamName}" team.`,
    `You report to the team leader (${leaderId}).`,
    '',
    '## Your Responsibility',
    `You focus exclusively on: **${capability}**`,
    '',
    '## Guidelines',
    '- Focus only on tasks related to your specialization',
    '- Return clear, structured results to the leader',
    '- Ask the leader for clarification if the task is outside your scope',
    '',
  ].join('\n');
}

export interface HireTeamResult {
  leaderId: string;
  workerIds: string[];
  teamId: string;
  teamName: string;
}

export async function hireTeamFromTemplate(
  templateId: string,
  teamName: string,
  capabilities: string[],
): Promise<HireTeamResult> {
  const config = await readOpenclawConfig();
  const templates = (config.templates || []) as Array<{ id: string; path: string }>;
  const template = templates.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Build leader
  const leaderSlug = slugify(teamName);
  const leaderDir = join(OPENCLAW_DIR, `workspace-${leaderSlug}`);
  if (await fileExists(leaderDir)) {
    throw new Error(`Leader workspace already exists: ${leaderDir}`);
  }

  await copyDir(template.path, leaderDir);

  const agentsSection = (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents))
    ? { ...(config.agents as Record<string, unknown>) }
    : {};
  const existingList = Array.isArray(agentsSection.list)
    ? [...(agentsSection.list as Array<Record<string, unknown>>)]
    : [];
  const existingIds = new Set(existingList.map((a: Record<string, unknown>) => String(a.id)));

  // Ensure unique leader ID
  let leaderId = leaderSlug;
  let suffix = 2;
  while (existingIds.has(leaderId)) {
    leaderId = `${leaderSlug}-${suffix}`;
    suffix++;
  }

  // Write leader SOUL.md
  const leaderSoulContent = buildLeaderSoulContent(teamName, capabilities);
  await writeFile(join(leaderDir, 'SOUL.md'), leaderSoulContent, 'utf-8');

  const agentListEntries: Record<string, unknown>[] = [];

  const leaderEntry: Record<string, unknown> = {
    id: leaderId,
    name: teamName,
    workspace: `~/.openclaw/workspace-${leaderId}`,
    teamRole: 'leader',
    responsibility: `Team leader for ${teamName}`,
    source: 'marketplace',
  };
  agentListEntries.push(leaderEntry);

  // Create worker agents
  const workerIds: string[] = [];
  for (const capability of capabilities) {
    const capSlug = slugify(capability);
    let workerId = `${leaderSlug}-${capSlug}`;
    suffix = 2;
    while (existingIds.has(workerId) || workerIds.includes(workerId)) {
      workerId = `${leaderSlug}-${capSlug}-${suffix}`;
      suffix++;
    }
    workerIds.push(workerId);

    const workerDir = join(OPENCLAW_DIR, `workspace-${workerId}`);
    if (await fileExists(workerDir)) {
      throw new Error(`Worker workspace already exists: ${workerDir}`);
    }

    await copyDir(template.path, workerDir);

    const workerSoulContent = buildWorkerSoulContent(teamName, capability, leaderId);
    await writeFile(join(workerDir, 'SOUL.md'), workerSoulContent, 'utf-8');

    const workerEntry: Record<string, unknown> = {
      id: workerId,
      name: capability,
      workspace: `~/.openclaw/workspace-${workerId}`,
      teamRole: 'worker',
      reportsTo: leaderId,
      chatAccess: 'leader_only',
      responsibility: capability,
      source: 'marketplace',
    };
    agentListEntries.push(workerEntry);
  }

  // Write all agents to config
  config.agents = {
    ...agentsSection,
    list: [...existingList, ...agentListEntries],
  };
  await writeOpenclawConfig(config);

  // Create Team entity
  const team = await createTeam({
    leaderId,
    memberIds: workerIds,
    name: teamName,
    description: `${teamName} team with ${capabilities.length} specialists`,
  });

  return {
    leaderId,
    workerIds,
    teamId: team.id,
    teamName,
  };
}
