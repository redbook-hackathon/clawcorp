import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'os';
import { listAgentsSnapshot } from './agent-config';
import { expandPath } from './paths';

async function getAgentWorkspace(agentId: string): Promise<string> {
  const snapshot = await listAgentsSnapshot();
  const agent = snapshot.agents.find((entry) => entry.id === agentId);
  if (!agent?.workspace) {
    throw new Error(`Agent workspace not found: ${agentId}`);
  }

  return expandPath(agent.workspace);
}

export async function assignInstalledSkillToAgentWorkspace(agentId: string, slug: string): Promise<void> {
  const workspaceDir = await getAgentWorkspace(agentId);
  const sourceDir = join(homedir(), '.openclaw', 'skills', slug);
  const skillsDir = join(workspaceDir, 'skills');
  const targetDir = join(skillsDir, slug);

  await mkdir(skillsDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

export async function updateAgentWorkspaceSkill(
  agentId: string,
  skillName: string,
  content: string,
): Promise<void> {
  const workspaceDir = await getAgentWorkspace(agentId);
  const skillDir = join(workspaceDir, 'skills', skillName);

  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), content, 'utf8');
}

export async function removeAgentWorkspaceSkill(agentId: string, skillName: string): Promise<void> {
  const workspaceDir = await getAgentWorkspace(agentId);
  await rm(join(workspaceDir, 'skills', skillName), {
    recursive: true,
    force: true,
  });
}
