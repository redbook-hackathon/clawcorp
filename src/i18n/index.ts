import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
    resolveSupportedLanguage,
    type LanguageCode,
} from '../../shared/language';

// EN
import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enDashboard from './locales/en/dashboard.json';
import enChat from './locales/en/chat.json';
import enChannels from './locales/en/channels.json';
import enAgents from './locales/en/agents.json';
import enSkills from './locales/en/skills.json';
import enCron from './locales/en/cron.json';
import enSetup from './locales/en/setup.json';

// ZH
import zhCommon from './locales/zh/common.json';
import zhSettings from './locales/zh/settings.json';
import zhDashboard from './locales/zh/dashboard.json';
import zhChat from './locales/zh/chat.json';
import zhChannels from './locales/zh/channels.json';
import zhAgents from './locales/zh/agents.json';
import zhSkills from './locales/zh/skills.json';
import zhCron from './locales/zh/cron.json';
import zhSetup from './locales/zh/setup.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
] as const satisfies ReadonlyArray<{ code: LanguageCode; label: string }>;

const EXPOSED_LANGUAGE_CODES = ['zh', 'en'] as const;
type ExposedLanguageCode = (typeof EXPOSED_LANGUAGE_CODES)[number];

function resolveExposedLanguage(language: string | undefined): ExposedLanguageCode {
    const resolved = resolveSupportedLanguage(language);
    if (resolved === 'en') return 'en';
    return 'zh';
}

const resources = {
    en: {
        common: enCommon,
        settings: enSettings,
        dashboard: enDashboard,
        chat: enChat,
        channels: enChannels,
        agents: enAgents,
        skills: enSkills,
        cron: enCron,
        setup: enSetup,
    },
    zh: {
        common: zhCommon,
        settings: zhSettings,
        dashboard: zhDashboard,
        chat: zhChat,
        channels: zhChannels,
        agents: zhAgents,
        skills: zhSkills,
        cron: zhCron,
        setup: zhSetup,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: resolveExposedLanguage(typeof navigator !== 'undefined' ? navigator.language : undefined),
        fallbackLng: 'zh',
        supportedLngs: [...EXPOSED_LANGUAGE_CODES],
        defaultNS: 'common',
        ns: ['common', 'settings', 'dashboard', 'chat', 'channels', 'agents', 'skills', 'cron', 'setup'],
        interpolation: {
            escapeValue: false, // React already escapes
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
