export type SettingsGroupId = 'canonical';

export type SettingsSectionId =
  | 'costs-usage'
  | 'models-providers'
  | 'general'
  | 'skills-mcp'
  | 'tool-permissions'
  | 'memory-knowledge'
  | 'migration-backup'
  | 'app-updates'
  | 'about';

export type SettingsNavItem = {
  id: SettingsSectionId;
  labelKey: string;
  summaryKey?: string;
};

export type SettingsNavGroup = {
  id: SettingsGroupId;
  labelKey?: string;
  items: SettingsNavItem[];
};

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  'costs-usage',
  'models-providers',
  'general',
  'skills-mcp',
  'tool-permissions',
  'memory-knowledge',
  'migration-backup',
  'app-updates',
  'about',
];

const SETTINGS_SECTION_ID_SET = new Set<SettingsSectionId>(SETTINGS_SECTION_IDS);

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: 'canonical',
    items: SETTINGS_SECTION_IDS.map((id) => ({
      id,
      labelKey: `settings:settingsShell.items.${id}.label`,
    })),
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'costs-usage';

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
  return value != null && SETTINGS_SECTION_ID_SET.has(value as SettingsSectionId);
}

export function parseSettingsSection(value: string | null | undefined): SettingsSectionId {
  return isSettingsSectionId(value) ? value : DEFAULT_SETTINGS_SECTION;
}

export const SETTINGS_SECTION_META: Record<
  SettingsSectionId,
  { titleKey: string; subtitleKey: string; kickerKey: string }
> = {
  'costs-usage': {
    titleKey: 'settings:settingsShell.meta.costs-usage.title',
    subtitleKey: 'settings:settingsShell.meta.costs-usage.subtitle',
    kickerKey: 'settings:settingsShell.meta.costs-usage.kicker',
  },
  'models-providers': {
    titleKey: 'settings:settingsShell.meta.models-providers.title',
    subtitleKey: 'settings:settingsShell.meta.models-providers.subtitle',
    kickerKey: 'settings:settingsShell.meta.models-providers.kicker',
  },
  general: {
    titleKey: 'settings:settingsShell.meta.general.title',
    subtitleKey: 'settings:settingsShell.meta.general.subtitle',
    kickerKey: 'settings:settingsShell.meta.general.kicker',
  },
  'skills-mcp': {
    titleKey: 'settings:settingsShell.meta.skills-mcp.title',
    subtitleKey: 'settings:settingsShell.meta.skills-mcp.subtitle',
    kickerKey: 'settings:settingsShell.meta.skills-mcp.kicker',
  },
  'tool-permissions': {
    titleKey: 'settings:settingsShell.meta.tool-permissions.title',
    subtitleKey: 'settings:settingsShell.meta.tool-permissions.subtitle',
    kickerKey: 'settings:settingsShell.meta.tool-permissions.kicker',
  },
  'memory-knowledge': {
    titleKey: 'settings:settingsShell.meta.memory-knowledge.title',
    subtitleKey: 'settings:settingsShell.meta.memory-knowledge.subtitle',
    kickerKey: 'settings:settingsShell.meta.memory-knowledge.kicker',
  },
  'migration-backup': {
    titleKey: 'settings:settingsShell.meta.migration-backup.title',
    subtitleKey: 'settings:settingsShell.meta.migration-backup.subtitle',
    kickerKey: 'settings:settingsShell.meta.migration-backup.kicker',
  },
  'app-updates': {
    titleKey: 'settings:settingsShell.meta.app-updates.title',
    subtitleKey: 'settings:settingsShell.meta.app-updates.subtitle',
    kickerKey: 'settings:settingsShell.meta.app-updates.kicker',
  },
  about: {
    titleKey: 'settings:settingsShell.meta.about.title',
    subtitleKey: 'settings:settingsShell.meta.about.subtitle',
    kickerKey: 'settings:settingsShell.meta.about.kicker',
  },
};
