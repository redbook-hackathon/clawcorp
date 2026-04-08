/**
 * Dynamic imports for OpenClaw plugin-sdk subpath exports.
 *
 * OpenClaw is bundled outside the app's normal node_modules tree. Static imports like
 * `openclaw/plugin-sdk/discord` are therefore fragile under packaging and pnpm symlinks.
 * Resolve the package from the OpenClaw installation itself and then self-reference its
 * exported subpaths.
 */
import { createRequire } from 'module';
import { join } from 'node:path';
import { getOpenClawDir, getOpenClawResolvedDir } from './paths';

const openClawDir = getOpenClawDir();
const openClawResolvedDir = getOpenClawResolvedDir();
const openClawSdkRequire = createRequire(join(openClawResolvedDir, 'package.json'));
const projectSdkRequire = createRequire(join(openClawDir, 'package.json'));

function requireOpenClawSdk(subpath: string): Record<string, unknown> {
  try {
    return openClawSdkRequire(subpath);
  } catch {
    return projectSdkRequire(subpath);
  }
}

const discordSdk = requireOpenClawSdk('openclaw/plugin-sdk/discord') as {
  listDiscordDirectoryGroupsFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  listDiscordDirectoryPeersFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  normalizeDiscordMessagingTarget: (target: string) => string | undefined;
};

const telegramSdk = requireOpenClawSdk('openclaw/plugin-sdk/telegram') as {
  listTelegramDirectoryGroupsFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  listTelegramDirectoryPeersFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  normalizeTelegramMessagingTarget: (target: string) => string | undefined;
};

const slackSdk = requireOpenClawSdk('openclaw/plugin-sdk/slack') as {
  listSlackDirectoryGroupsFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  listSlackDirectoryPeersFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  normalizeSlackMessagingTarget: (target: string) => string | undefined;
};

const whatsappSdk = requireOpenClawSdk('openclaw/plugin-sdk/whatsapp-shared') as {
  normalizeWhatsAppMessagingTarget: (target: string) => string | undefined;
};

export const {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  normalizeDiscordMessagingTarget,
} = discordSdk;

export const {
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  normalizeTelegramMessagingTarget,
} = telegramSdk;

export const {
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  normalizeSlackMessagingTarget,
} = slackSdk;

export const { normalizeWhatsAppMessagingTarget } = whatsappSdk;
