import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export const AVATAR_PREFERENCES_PATH = join(process.cwd(), "runtime", "avatar-preferences.json");
export const AVATAR_UPLOADS_DIR = join(process.cwd(), "runtime", "avatars");

export type AvatarMode = "agent" | "pixel" | "custom";

export interface AgentAvatarPreference {
  mode: AvatarMode;
  animal?: string;
  image?: string;
  updatedAt: string;
}

export interface AvatarPreferences {
  version: 1;
  updatedAt: string;
  agents: Record<string, AgentAvatarPreference>;
}

export interface AvatarUploadEntry {
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface AvatarPreferencesLoadResult {
  path: string;
  preferences: AvatarPreferences;
  issues: string[];
}

export function defaultAvatarPreferences(now = new Date().toISOString()): AvatarPreferences {
  return {
    version: 1,
    updatedAt: now,
    agents: {},
  };
}

export async function loadAvatarPreferences(): Promise<AvatarPreferencesLoadResult> {
  let parsed: unknown;
  let issues: string[] = [];

  try {
    const raw = await readFile(AVATAR_PREFERENCES_PATH, "utf8");
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const fallback = defaultAvatarPreferences();
    const reason = error instanceof Error ? error.message : "unable to read preference file";
    issues = [`avatar preferences fallback applied: ${reason}`];
    // 只读模式：不自动创建文件，只返回默认配置
    return {
      path: AVATAR_PREFERENCES_PATH,
      preferences: fallback,
      issues,
    };
  }

  const normalized = normalizeAvatarPreferences(parsed);
  // 只读模式：不自动修复写入文件，只返回问题和规范化后的配置

  return {
    path: AVATAR_PREFERENCES_PATH,
    preferences: normalized.preferences,
    issues: normalized.issues,
  };
}

export async function saveAvatarPreferences(preferences: AvatarPreferences): Promise<AvatarPreferencesLoadResult> {
  const normalized = normalizeAvatarPreferences(preferences);
  await writeAvatarPreferences(normalized.preferences);
  return {
    path: AVATAR_PREFERENCES_PATH,
    preferences: normalized.preferences,
    issues: normalized.issues,
  };
}

export function resolveEffectiveAvatar(input: {
  agentId: string;
  agentAnimal: string;
  preferences: AvatarPreferences;
}): { mode: "pixel"; animal: string } | { mode: "custom"; image: string } {
  const pref = input.preferences.agents[input.agentId];
  if (!pref || pref.mode === "agent") {
    return { mode: "pixel", animal: input.agentAnimal };
  }
  if (pref.mode === "custom" && typeof pref.image === "string" && pref.image.trim()) {
    return { mode: "custom", image: pref.image.trim() };
  }
  if (pref.mode === "pixel" && typeof pref.animal === "string" && pref.animal.trim()) {
    return { mode: "pixel", animal: pref.animal.trim() };
  }
  return { mode: "pixel", animal: input.agentAnimal };
}

export async function listAvatarUploads(): Promise<AvatarUploadEntry[]> {
  let entries;
  try {
    entries = await readdir(AVATAR_UPLOADS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const ext = extname(name).toLowerCase();
      return ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp";
    });

  const out: AvatarUploadEntry[] = [];
  for (const fileName of files) {
    try {
      const filePath = join(AVATAR_UPLOADS_DIR, fileName);
      const info = await stat(filePath);
      out.push({
        fileName,
        sizeBytes: info.size,
        updatedAt: info.mtime.toISOString(),
      });
    } catch {
      // Ignore races / deleted files.
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertAgentAvatarPreference(input: {
  preferences: AvatarPreferences;
  agentId: string;
  mode: AvatarMode;
  animal?: string;
  image?: string;
  now?: string;
}): AvatarPreferences {
  const now = input.now ?? new Date().toISOString();
  const agentId = String(input.agentId || "").trim();
  if (!agentId) return input.preferences;

  const next: AvatarPreferences = {
    ...input.preferences,
    version: 1,
    updatedAt: now,
    agents: { ...input.preferences.agents },
  };

  const mode = input.mode;
  const preference: AgentAvatarPreference = {
    mode,
    updatedAt: now,
  };

  if (mode === "pixel") {
    const animal = String(input.animal || "").trim().toLowerCase();
    if (animal) preference.animal = animal;
  }
  if (mode === "custom") {
    const image = String(input.image || "").trim();
    if (image) preference.image = image;
  }

  next.agents[agentId] = preference;
  return next;
}

function normalizeAvatarPreferences(input: unknown): { preferences: AvatarPreferences; issues: string[] } {
  const now = new Date().toISOString();
  const base = defaultAvatarPreferences(now);
  const issues: string[] = [];

  const obj = asObject(input);
  if (!obj) {
    issues.push("avatar preferences must be a JSON object");
    return { preferences: base, issues };
  }

  const agents: Record<string, AgentAvatarPreference> = {};
  const rawAgents = asObject(obj.agents);
  if (rawAgents) {
    for (const [rawAgentId, rawPref] of Object.entries(rawAgents)) {
      const agentId = String(rawAgentId || "").trim();
      if (!agentId) continue;
      const prefObj = asObject(rawPref);
      if (!prefObj) continue;
      const mode = normalizeMode(prefObj.mode);
      if (!mode) continue;
      const updatedAt =
        typeof prefObj.updatedAt === "string" && !Number.isNaN(Date.parse(prefObj.updatedAt))
          ? new Date(prefObj.updatedAt).toISOString()
          : now;

      const normalized: AgentAvatarPreference = { mode, updatedAt };
      if (mode === "pixel" && typeof prefObj.animal === "string") {
        const animal = prefObj.animal.trim().toLowerCase();
        if (animal) normalized.animal = animal;
      }
      if (mode === "custom" && typeof prefObj.image === "string") {
        const image = prefObj.image.trim();
        if (image) normalized.image = image;
      }
      agents[agentId] = normalized;
    }
  }

  return {
    preferences: {
      version: 1,
      updatedAt: now,
      agents,
    },
    issues,
  };
}

function normalizeMode(input: unknown): AvatarMode | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "agent" || trimmed === "pixel" || trimmed === "custom") return trimmed;
  return undefined;
}

function asObject(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object") return undefined;
  if (Array.isArray(input)) return undefined;
  return input as Record<string, unknown>;
}

async function writeAvatarPreferences(preferences: AvatarPreferences): Promise<void> {
  await mkdir(join(process.cwd(), "runtime"), { recursive: true });
  await writeFile(AVATAR_PREFERENCES_PATH, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
}
