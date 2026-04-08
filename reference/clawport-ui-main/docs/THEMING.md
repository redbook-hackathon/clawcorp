# ClawPort -- Theming, Settings & Customization Guide

This document covers ClawPort's visual theming system, settings architecture, and step-by-step
instructions for extending both. Everything is driven by CSS custom properties and two React
context providers: `ThemeProvider` and `SettingsProvider`.

---

## Table of Contents

1. [Themes](#themes)
   - [Available Themes](#available-themes)
   - [How Themes Work](#how-themes-work)
   - [CSS Custom Property Tokens](#css-custom-property-tokens)
   - [System Theme Detection](#system-theme-detection)
   - [Theme-Specific Overrides](#theme-specific-overrides)
   - [How to Add a New Theme](#how-to-add-a-new-theme)
2. [Settings](#settings)
   - [ClawPortSettings Interface](#clawportsettings-interface)
   - [localStorage Persistence](#localstorage-persistence)
   - [SettingsProvider API](#settingsprovider-api)
   - [Accent Color CSS Variables](#accent-color-css-variables)
   - [Agent Override System](#agent-override-system)
   - [operatorName Flow](#operatorname-flow)
3. [Customization Guide](#customization-guide)
   - [Change the Default Accent Color](#change-the-default-accent-color)
   - [Add a New Setting Field](#add-a-new-setting-field)
   - [Add a New Theme](#add-a-new-theme-step-by-step)
   - [CSS Custom Property Naming Conventions](#css-custom-property-naming-conventions)

---

## Themes

### Available Themes

ClawPort ships with five themes. Each has an ID, a human-readable label, and an emoji used in the
onboarding wizard and theme picker.

| ID       | Label    | Emoji | Description                                |
|----------|----------|-------|--------------------------------------------|
| `dark`   | Dark     | `\ud83c\udf11`  | Apple Dark Mode. The default theme.        |
| `glass`  | Glass    | `\ud83e\ude9f`  | Frosted glass dark variant with translucent surfaces. |
| `color`  | Color    | `\ud83c\udfa8`  | Vibrant purple-indigo variant.             |
| `light`  | Light    | `\u2600\ufe0f`  | Apple Light Mode.                          |
| `system` | System   | `\u2699\ufe0f`  | Follows the OS `prefers-color-scheme` setting. |

These are defined in `lib/themes.ts`:

```ts
export type ThemeId = 'dark' | 'glass' | 'color' | 'light' | 'system';

export const THEMES: { id: ThemeId; label: string; emoji: string }[] = [
  { id: 'dark',   label: 'Dark',   emoji: '\ud83c\udf11' },
  { id: 'glass',  label: 'Glass',  emoji: '\ud83e\ude9f' },
  { id: 'color',  label: 'Color',  emoji: '\ud83c\udfa8' },
  { id: 'light',  label: 'Light',  emoji: '\u2600\ufe0f' },
  { id: 'system', label: 'System', emoji: '\u2699\ufe0f' },
];
```

### How Themes Work

The theme system uses three layers:

1. **`data-theme` attribute on `<html>`** -- Each theme defines a CSS rule block scoped to
   `[data-theme="<id>"]`. The `dark` theme also matches `:root` so it works without any
   attribute set.

2. **CSS custom properties** -- Every color, shadow, radius, and material is expressed as a
   CSS variable. Components consume these via inline styles (e.g., `style={{ color: 'var(--text-primary)' }}`)
   or utility classes. No Tailwind color classes are used directly.

3. **ThemeProvider** (`app/providers.tsx`) -- A React context that manages theme state. On mount
   it reads from `localStorage` key `clawport-theme`. When the user picks a theme, it:
   - Updates React state
   - Writes to `localStorage`
   - Removes the existing `data-theme` attribute
   - Sets the new `data-theme` attribute on `<html>`
   - For the `system` theme, evaluates `window.matchMedia('(prefers-color-scheme: dark)')` and
     resolves to either `dark` or `light`

```ts
// app/providers.tsx (simplified)
function apply(t: ThemeId) {
  setThemeState(t);
  localStorage.setItem('clawport-theme', t);
  const html = document.documentElement;
  html.removeAttribute('data-theme');
  if (t === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', t);
  }
}
```

Consumer hook:

```ts
import { useTheme } from '@/app/providers';

const { theme, setTheme } = useTheme();
// theme is the ThemeId ('dark', 'glass', etc.)
// setTheme('light') applies immediately
```

### CSS Custom Property Tokens

All tokens are defined in `app/globals.css`. Every theme block defines the same full set of
variables, so components can always rely on them being present.

#### Backgrounds

| Token                  | Purpose                                    | Dark example              |
|------------------------|--------------------------------------------|---------------------------|
| `--bg`                 | Primary page background                    | `#000000`                 |
| `--bg-secondary`       | Card / surface background                  | `rgba(28,28,30,1)`       |
| `--bg-tertiary`        | Nested surface / grouped background        | `rgba(44,44,46,1)`       |

#### Materials (Apple translucent surfaces)

| Token                   | Purpose                                   | Dark example              |
|-------------------------|-------------------------------------------|---------------------------|
| `--material-regular`    | Standard material (sidebar, overlays)     | `rgba(28,28,30,0.92)`    |
| `--material-thick`      | Dense material                            | `rgba(22,22,24,0.96)`    |
| `--material-thin`       | Light tint material                       | `rgba(255,255,255,0.06)` |
| `--material-ultra-thin` | Very subtle tint                          | `rgba(255,255,255,0.04)` |

#### Fills

| Token               | Purpose                                       | Dark example              |
|----------------------|-----------------------------------------------|---------------------------|
| `--fill-primary`     | Primary interactive fill (buttons, controls)  | `rgba(120,120,128,0.36)` |
| `--fill-secondary`   | Hover fill                                    | `rgba(120,120,128,0.32)` |
| `--fill-tertiary`    | Subtle fill (input backgrounds)               | `rgba(118,118,128,0.24)` |
| `--fill-quaternary`  | Most subtle fill                              | `rgba(118,118,128,0.18)` |

#### Separators & Borders

| Token                | Purpose                           | Dark example              |
|----------------------|-----------------------------------|---------------------------|
| `--separator`        | Translucent divider line          | `rgba(84,84,88,0.60)`    |
| `--separator-opaque` | Opaque divider (non-blur contexts)| `#38383A`                 |

#### Text

| Token               | Purpose                              | Dark example               |
|----------------------|--------------------------------------|----------------------------|
| `--text-primary`     | Headings, body text                  | `#FFFFFF`                  |
| `--text-secondary`   | Labels, supporting text              | `rgba(235,235,245,0.60)`  |
| `--text-tertiary`    | Placeholder, captions                | `rgba(235,235,245,0.30)`  |
| `--text-quaternary`  | Disabled / lowest-priority text      | `rgba(235,235,245,0.18)`  |

#### Accent & System Colors

| Token              | Purpose                                | Dark example  |
|--------------------|----------------------------------------|---------------|
| `--accent`         | Primary brand accent (buttons, active) | `#F5C518`     |
| `--accent-fill`    | Accent at 15% opacity (backgrounds)    | `rgba(245,197,24,0.15)` |
| `--system-blue`    | Links, focus rings                     | `#0A84FF`     |
| `--system-green`   | Success, active toggles                | `#30D158`     |
| `--system-red`     | Errors, destructive actions            | `#FF453A`     |
| `--system-orange`  | Warnings                               | `#FF9F0A`     |
| `--system-purple`  | Tags, highlights                       | `#BF5AF2`     |

Note: `--accent` and `--accent-fill` can be overridden at runtime by the SettingsProvider when
the user picks a custom accent color. See [Accent Color CSS Variables](#accent-color-css-variables).

#### Shadows & Effects

| Token              | Purpose                                 | Dark example (abbreviated)           |
|--------------------|-----------------------------------------|--------------------------------------|
| `--inset-shine`    | Top inner highlight on cards            | `inset 0 1px 0 rgba(255,255,255,0.08)` |
| `--shadow-subtle`  | Minimal elevation                       | `0 1px 2px rgba(0,0,0,0.20)`        |
| `--shadow-ambient` | Hairline border shadow                  | `0 0 0 0.5px rgba(0,0,0,0.20)`      |
| `--shadow-key`     | Primary directional shadow              | `0 4px 16px rgba(0,0,0,0.40)`       |
| `--shadow-card`    | Full card elevation (ambient + key + shine) | _(composite)_                    |
| `--shadow-overlay` | Modal / overlay elevation               | _(composite)_                        |

#### Code Blocks

| Token           | Purpose                  | Dark example              |
|-----------------|--------------------------|---------------------------|
| `--code-bg`     | Code block background    | `rgba(255,255,255,0.06)` |
| `--code-border` | Code block border        | `rgba(255,255,255,0.10)` |
| `--code-text`   | Code text color          | `#e5e5ea`                |

#### Sidebar

| Token               | Purpose                          | Dark example                       |
|----------------------|----------------------------------|------------------------------------|
| `--sidebar-bg`       | Sidebar background color         | `rgba(28,28,30,0.92)`             |
| `--sidebar-backdrop` | Sidebar backdrop-filter          | `blur(40px) saturate(180%)`       |

#### Border Radius

| Token          | Value   |
|----------------|---------|
| `--radius-sm`  | `6px`   |
| `--radius-md`  | `12px`  |
| `--radius-lg`  | `16px`  |
| `--radius-xl`  | `20px`  |
| `--radius-2xl` | `24px`  |

#### Easing Functions

| Token           | Value                               | Use case                    |
|-----------------|-------------------------------------|-----------------------------|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy interactions         |
| `--ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)`      | General transitions         |
| `--ease-snappy` | `cubic-bezier(0.2, 0, 0, 1)`        | Quick state changes         |

#### Typography Scale (Tailwind `@theme` tokens)

These are registered as Tailwind theme extensions so they work with utility classes (e.g.,
`text-caption1`). They follow the Apple Human Interface Guidelines type ramp.

| Token                  | Value  |
|------------------------|--------|
| `--text-caption2`      | `11px` |
| `--text-caption1`      | `12px` |
| `--text-footnote`      | `13px` |
| `--text-subheadline`   | `15px` |
| `--text-body`          | `17px` |
| `--text-title3`        | `20px` |
| `--text-title2`        | `22px` |
| `--text-title1`        | `28px` |
| `--text-large-title`   | `34px` |

#### Font Families

| Token         | Value                                                                    |
|---------------|--------------------------------------------------------------------------|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif` |
| `--font-mono` | `"SF Mono", Monaco, Menlo, "Courier New", monospace`                     |

#### Leading (Line Height)

| Token              | Value  |
|--------------------|--------|
| `--leading-tight`  | `1.15` |
| `--leading-snug`   | `1.3`  |
| `--leading-normal` | `1.47` |
| `--leading-relaxed`| `1.65` |

#### Tracking (Letter Spacing)

| Token              | Value     |
|--------------------|-----------|
| `--tracking-tight` | `-0.41px` |
| `--tracking-normal`| `-0.24px` |
| `--tracking-wide`  | `0.07em`  |

#### Font Weights

| Token              | Value |
|--------------------|-------|
| `--weight-regular` | `400` |
| `--weight-medium`  | `500` |
| `--weight-semibold`| `600` |
| `--weight-bold`    | `700` |

#### Spacing Scale (4px grid)

| Token       | Value  |
|-------------|--------|
| `--space-1` | `4px`  |
| `--space-2` | `8px`  |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10`| `40px` |
| `--space-12`| `48px` |
| `--space-16`| `64px` |

#### Animation Tokens (Tailwind `@theme`)

| Token                   | Value                                     |
|-------------------------|-------------------------------------------|
| `--animate-fade-in`     | `fadeIn 0.2s ease-out`                    |
| `--animate-slide-in`    | `slideIn 0.2s ease-out`                   |
| `--animate-pulse-red`   | `pulse-red 1.5s ease-in-out infinite`     |
| `--animate-blink`       | `blink-cursor 1s step-end infinite`       |
| `--animate-float-hint`  | `float-hint 2s ease-in-out infinite`      |

### System Theme Detection

The `system` theme has two layers:

1. **CSS-only fallback** -- A `@media (prefers-color-scheme: light)` block defines all custom
   properties for `[data-theme="system"]`. This ensures correct rendering before JavaScript
   hydrates (dark mode inherits from `:root` which is already dark).

2. **JavaScript resolution** -- When the ThemeProvider applies the `system` theme, it evaluates
   `window.matchMedia('(prefers-color-scheme: dark)')` and sets `data-theme` to either `dark`
   or `light`. This means the actual CSS properties used are identical to the corresponding
   explicit theme.

Note: There is currently no `matchMedia` listener for live OS theme changes. If the user
switches their OS theme while ClawPort is open, they need to re-select `system` or reload.

### Theme-Specific Overrides

Some themes have extra CSS rules beyond the custom property definitions:

**Glass** -- Applies a radial gradient body background and conditionally shows `.glass-orbs`
decorative elements:

```css
[data-theme="glass"] body {
  background: radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0d0d18 40%, #050510 100%);
}
[data-theme="glass"] .glass-orbs { display: block; }
```

**Color** -- Uses a linear gradient body background and applies gradient borders to React Flow
nodes:

```css
[data-theme="color"] body {
  background: linear-gradient(135deg, #0a0814 0%, #0f0b20 50%, #0a0814 100%);
}
[data-theme="color"] .react-flow__node > div {
  background: linear-gradient(#16112a, #16112a) padding-box,
              linear-gradient(135deg, rgba(139,92,246,0.5), rgba(245,197,24,0.3)) border-box !important;
  border: 1px solid transparent !important;
}
```

**Light** -- Overrides `.apple-card` to solid white, adjusts message bubble colors, and
modifies React Flow edge stroke:

```css
[data-theme="light"] .apple-card {
  background: #ffffff !important;
  border: 1px solid rgba(60,60,67,0.12) !important;
}
[data-theme="light"] .msg-user { background: var(--system-blue) !important; color: #ffffff !important; }
[data-theme="light"] .msg-assistant {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid rgba(60,60,67,0.12) !important;
}
```

### How to Add a New Theme

1. **Add the theme ID to `lib/themes.ts`:**

   ```ts
   export type ThemeId = 'dark' | 'glass' | 'color' | 'light' | 'system' | 'midnight';

   export const THEMES = [
     // ...existing themes
     { id: 'midnight', label: 'Midnight', emoji: '\ud83c\udf03' },
   ];
   ```

2. **Add a CSS custom property block in `app/globals.css`:**

   Add a `[data-theme="midnight"]` rule block that defines **every** token listed above.
   Copy the `dark` theme block as a starting point and adjust values.

   ```css
   [data-theme="midnight"] {
     --bg: #0a0a1a;
     --bg-secondary: rgba(15,15,35,1);
     /* ...all other tokens */
   }
   ```

3. **Optionally add theme-specific overrides** (body background gradients, component styles)
   as `[data-theme="midnight"] ...` rules at the bottom of `globals.css`.

4. The ThemeProvider, onboarding wizard, and settings page will automatically pick up the new
   theme from the `THEMES` array -- no additional wiring needed.

---

## Settings

### ClawPortSettings Interface

Defined in `lib/settings.ts`:

```ts
export interface AgentOverride {
  emoji?: string
  profileImage?: string // base64 data URL
}

export interface ClawPortSettings {
  accentColor: string | null
  portalName: string | null
  portalSubtitle: string | null
  portalEmoji: string | null
  portalIcon: string | null       // base64 data URL for custom icon image
  iconBgHidden: boolean          // hide colored background on sidebar logo
  emojiOnly: boolean             // show emoji avatars without colored background
  operatorName: string | null
  agentOverrides: Record<string, AgentOverride>
}
```

| Field            | Type                              | Default | Description |
|------------------|-----------------------------------|---------|-------------|
| `accentColor`    | `string \| null`                  | `null`  | Hex color string (e.g., `"#3B82F6"`). When `null`, the theme's built-in `--accent` is used. |
| `portalName`      | `string \| null`                  | `null`  | Custom name displayed in the sidebar header. Falls back to "ClawPort". |
| `portalSubtitle`  | `string \| null`                  | `null`  | Subtitle below the name. Falls back to "Command Centre". |
| `portalEmoji`     | `string \| null`                  | `null`  | Emoji displayed in the sidebar logo. Falls back to the castle emoji. |
| `portalIcon`      | `string \| null`                  | `null`  | Base64 JPEG data URL for a custom sidebar icon image. Overrides the emoji when set. |
| `iconBgHidden`   | `boolean`                         | `false` | When `true`, removes the colored gradient background behind the sidebar logo emoji. |
| `emojiOnly`      | `boolean`                         | `false` | When `true`, agent avatars show just the emoji without a colored circle background. |
| `operatorName`   | `string \| null`                  | `null`  | The human operator's name. Displayed in the sidebar and injected into the chat system prompt. |
| `agentOverrides` | `Record<string, AgentOverride>`   | `{}`    | Per-agent customizations keyed by agent ID. Each override can set a custom emoji and/or profile image. |

### localStorage Persistence

Settings are stored under the key `'clawport-settings'` as a JSON string.

```
localStorage key: 'clawport-settings'
Format: JSON-serialized ClawPortSettings object
```

Theme is stored separately under key `'clawport-theme'` (managed by ThemeProvider).

Onboarding completion is tracked under key `'clawport-onboarded'` (value `'1'`).

**Load behavior** (`loadSettings()`):

- Returns `DEFAULTS` on server (SSR guard: `typeof window === 'undefined'`)
- Returns `DEFAULTS` if the key is missing or JSON parsing fails
- Validates each field by type during parse -- unknown/malformed fields fall back to their default
- `agentOverrides` is checked with `typeof parsed.agentOverrides === 'object'`

**Save behavior** (`saveSettings()`):

- Silently no-ops on server
- Silently catches `localStorage` write errors (e.g., quota exceeded)

### SettingsProvider API

The `SettingsProvider` (`app/settings-provider.tsx`) wraps the app and exposes all setting
mutations via React context. Access it with the `useSettings()` hook.

```ts
import { useSettings } from '@/app/settings-provider';

const {
  settings,              // ClawPortSettings (read-only snapshot)
  setAccentColor,        // (color: string | null) => void
  setPortalName,          // (name: string | null) => void
  setPortalSubtitle,      // (subtitle: string | null) => void
  setPortalEmoji,         // (emoji: string | null) => void
  setPortalIcon,          // (icon: string | null) => void
  setIconBgHidden,       // (hidden: boolean) => void
  setEmojiOnly,          // (emojiOnly: boolean) => void
  setOperatorName,       // (name: string | null) => void
  setAgentOverride,      // (agentId: string, override: AgentOverride) => void
  clearAgentOverride,    // (agentId: string) => void
  getAgentDisplay,       // (agent: Agent) => AgentDisplay
  resetAll,              // () => void
} = useSettings();
```

**Setter details:**

| Function              | Signature                                        | Behavior |
|-----------------------|--------------------------------------------------|----------|
| `setAccentColor`      | `(color: string \| null) => void`                | Sets the accent color. Pass `null` to revert to the theme default. Triggers a `useEffect` that applies `--accent` and `--accent-fill` as inline styles on `<html>`. |
| `setPortalName`        | `(name: string \| null) => void`                 | Sets sidebar name. Empty string coerced to `null`. |
| `setPortalSubtitle`    | `(subtitle: string \| null) => void`             | Sets sidebar subtitle. Empty string coerced to `null`. |
| `setPortalEmoji`       | `(emoji: string \| null) => void`                | Sets sidebar logo emoji. Empty string coerced to `null`. |
| `setPortalIcon`        | `(icon: string \| null) => void`                 | Sets sidebar icon image (base64 data URL). Pass `null` to remove. |
| `setIconBgHidden`     | `(hidden: boolean) => void`                      | Toggles the colored background behind the sidebar logo emoji. |
| `setEmojiOnly`        | `(emojiOnly: boolean) => void`                   | Toggles emoji-only avatar mode across the entire app. |
| `setOperatorName`     | `(name: string \| null) => void`                 | Sets the operator's name. Empty string coerced to `null`. |
| `setAgentOverride`    | `(agentId: string, override: AgentOverride) => void` | Merges an override into the agent's existing overrides. Does not replace -- it shallow-merges. |
| `clearAgentOverride`  | `(agentId: string) => void`                      | Removes all overrides for a specific agent, reverting to defaults. |
| `getAgentDisplay`     | `(agent: Agent) => AgentDisplay`                 | Resolves the effective emoji, profile image, and emojiOnly flag for an agent, considering overrides. |
| `resetAll`            | `() => void`                                     | Resets all settings to `DEFAULTS` and persists immediately. |

**Hydration strategy:**

The provider initializes with `DEFAULTS` (not from `localStorage`) so that server and client
render the same HTML. A `useEffect` on mount calls `loadSettings()` to hydrate from
`localStorage`, causing a single re-render after first paint.

### Accent Color CSS Variables

When the user selects a custom accent color, the SettingsProvider applies it as inline styles
on `document.documentElement`:

```ts
// app/settings-provider.tsx
useEffect(() => {
  const el = document.documentElement.style;
  if (settings.accentColor) {
    el.setProperty('--accent', settings.accentColor);
    el.setProperty('--accent-fill', hexToAccentFill(settings.accentColor));
  } else {
    el.removeProperty('--accent');
    el.removeProperty('--accent-fill');
  }
}, [settings.accentColor]);
```

The `hexToAccentFill` helper converts a hex color to `rgba(r,g,b,0.15)`:

```ts
export function hexToAccentFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.15)`;
}
```

This means:
- When `accentColor` is `null`, `--accent` and `--accent-fill` come from the active theme's CSS.
- When `accentColor` is set, inline styles on `<html>` override the theme's values.
- Every component using `var(--accent)` or `var(--accent-fill)` picks up the change automatically.

**Accent color presets** available in both the settings page and onboarding wizard:

| Label   | Hex       |
|---------|-----------|
| Gold    | `#F5C518` |
| Blue    | `#3B82F6` |
| Green   | `#22C55E` |
| Red     | `#EF4444` |
| Orange  | `#F97316` |
| Purple  | `#A855F7` |
| Pink    | `#EC4899` |
| Teal    | `#14B8A6` |
| Cyan    | `#06B6D4` |
| Indigo  | `#6366F1` |
| Rose    | `#F43F5E` |
| Lime    | `#84CC16` |

A native `<input type="color">` picker is also provided for arbitrary colors.

### Agent Override System

Each agent can have a per-agent emoji and/or profile image override, stored in
`settings.agentOverrides` keyed by agent ID.

```ts
interface AgentOverride {
  emoji?: string         // Custom emoji to replace the agent's default
  profileImage?: string  // Base64 data URL (JPEG, max 200px dimension)
}
```

**How it works:**

1. The Settings page fetches all agents from `/api/agents`.
2. Each agent row is expandable. Inside, the user can:
   - Type a custom emoji
   - Upload a profile image (resized to 200px max via Canvas API, saved as JPEG at 0.85 quality)
3. Overrides are shallow-merged: setting a new emoji does not clear an existing profile image.
4. A gold dot indicator appears on agent rows that have active overrides.
5. `clearAgentOverride(agentId)` removes the entire entry, reverting to the agent's defaults.

**Resolution via `getAgentDisplay()`:**

```ts
const getAgentDisplay = (agent: Agent): AgentDisplay => {
  const override = settings.agentOverrides[agent.id];
  return {
    emoji: override?.emoji || agent.emoji,    // Fallback to agent default
    profileImage: override?.profileImage,     // undefined if no override
    emojiOnly: settings.emojiOnly,            // Global setting
  };
};
```

Components like `AgentAvatar` call `getAgentDisplay()` to resolve the effective visual for
each agent.

### operatorName Flow

The operator name flows through the system as follows:

1. **Settings** -- User enters their name in the onboarding wizard (step 0) or settings page.
   Stored as `settings.operatorName`.

2. **Onboarding wizard** -- Commits the name on wizard step 0 via `setOperatorName()`. The
   wizard shows a live preview with the user's initials rendered as a badge.

3. **Sidebar** -- Reads `settings.operatorName` to display the operator's initials in the
   sidebar.

4. **Chat POST** -- When a message is sent to `/api/chat/[id]`, the operator name is included
   in the request payload and injected into the system prompt so agents know who they are
   talking to.

---

## Customization Guide

### Change the Default Accent Color

The default accent color is defined per-theme in `app/globals.css`. To change it globally:

1. Edit every theme block's `--accent` and `--accent-fill` values:

   ```css
   :root, [data-theme="dark"] {
     --accent: #3B82F6;                    /* New default: Blue */
     --accent-fill: rgba(59,130,246,0.15); /* Same color at 15% opacity */
   }
   ```

2. Repeat for `[data-theme="glass"]`, `[data-theme="color"]`, and the `[data-theme="system"]`
   media query block.

3. The `light` theme has a different accent (`#B8860B`) for contrast reasons -- update it with
   a value that works on white backgrounds.

Note: This only changes the theme-level default. Users who have set a custom accent color in
settings will not be affected (their inline style override takes precedence).

### Add a New Setting Field

Follow this sequence to add a new boolean setting called `compactMode`:

**Step 1: Types** -- Add the field to `ClawPortSettings` in `lib/settings.ts`:

```ts
export interface ClawPortSettings {
  // ...existing fields
  compactMode: boolean
}
```

**Step 2: Defaults** -- Add the default value:

```ts
export const DEFAULTS: ClawPortSettings = {
  // ...existing defaults
  compactMode: false,
}
```

**Step 3: Parser** -- Add type-safe parsing in `loadSettings()`:

```ts
return {
  // ...existing fields
  compactMode: typeof parsed.compactMode === 'boolean' ? parsed.compactMode : false,
}
```

**Step 4: Provider** -- In `app/settings-provider.tsx`:

a. Add to the context interface:

```ts
interface SettingsContextValue {
  // ...existing
  setCompactMode: (compact: boolean) => void
}
```

b. Add to the context default:

```ts
const SettingsContext = createContext<SettingsContextValue>({
  // ...existing
  compactMode: false,  // in the settings object
  setCompactMode: () => {},
})
```

c. Add the setter callback:

```ts
const setCompactMode = useCallback(
  (compact: boolean) => {
    update({ ...settings, compactMode: compact })
  },
  [settings, update],
)
```

d. Include in the Provider's `value` prop:

```ts
value={{ ...existing, setCompactMode }}
```

e. Update `resetAll` to include the new field.

**Step 5: UI** -- Add a toggle in `app/settings/page.tsx` (follow the pattern of the existing
`emojiOnly` toggle -- an iOS-style switch button with `role="switch"` and `aria-checked`).

### Add a New Theme (Step by Step)

1. **Choose an ID** -- Short, lowercase, no spaces. Example: `midnight`.

2. **Update the type union** in `lib/themes.ts`:

   ```ts
   export type ThemeId = 'dark' | 'glass' | 'color' | 'light' | 'system' | 'midnight';
   ```

3. **Add to the THEMES array** in `lib/themes.ts`:

   ```ts
   { id: 'midnight', label: 'Midnight', emoji: '\ud83c\udf03' },
   ```

4. **Define all CSS custom properties** in `app/globals.css`. Copy the `[data-theme="dark"]`
   block as a template. You must define every token listed in
   [CSS Custom Property Tokens](#css-custom-property-tokens). Missing tokens will cause
   components to render with broken styles.

   ```css
   [data-theme="midnight"] {
     --bg: #0a0a1a;
     --bg-secondary: ...;
     /* Every single token from the list above */
   }
   ```

5. **Optionally add body background** and component-level overrides:

   ```css
   [data-theme="midnight"] body {
     background: linear-gradient(...);
   }
   ```

6. **Test** -- The theme will automatically appear in:
   - The onboarding wizard (step 1: "Choose a Theme")
   - The theme selector (wherever themes are listed from the `THEMES` array)

   No changes to `ThemeProvider`, settings page, or onboarding wizard code are needed.

### CSS Custom Property Naming Conventions

ClawPort follows a consistent naming pattern for all CSS variables:

| Prefix        | Category                       | Examples                           |
|---------------|--------------------------------|------------------------------------|
| `--bg-*`      | Background colors              | `--bg`, `--bg-secondary`, `--bg-tertiary` |
| `--material-*`| Apple translucent surfaces     | `--material-regular`, `--material-thick` |
| `--fill-*`    | Interactive fill states        | `--fill-primary` through `--fill-quaternary` |
| `--separator*`| Dividers and borders           | `--separator`, `--separator-opaque` |
| `--text-*`    | Text colors (as theme tokens)  | `--text-primary` through `--text-quaternary` |
| `--text-*`    | Font sizes (as Tailwind theme) | `--text-caption2` through `--text-large-title` |
| `--accent*`   | Brand accent                   | `--accent`, `--accent-fill` |
| `--system-*`  | Semantic system colors         | `--system-blue`, `--system-green`, etc. |
| `--shadow-*`  | Box shadows                    | `--shadow-subtle`, `--shadow-card`, etc. |
| `--code-*`    | Code block styling             | `--code-bg`, `--code-border`, `--code-text` |
| `--sidebar-*` | Sidebar-specific               | `--sidebar-bg`, `--sidebar-backdrop` |
| `--radius-*`  | Border radii                   | `--radius-sm` through `--radius-2xl` |
| `--ease-*`    | Easing curves                  | `--ease-spring`, `--ease-smooth`, `--ease-snappy` |
| `--space-*`   | Spacing scale (4px grid)       | `--space-1` through `--space-16` |
| `--weight-*`  | Font weights                   | `--weight-regular` through `--weight-bold` |
| `--leading-*` | Line heights                   | `--leading-tight` through `--leading-relaxed` |
| `--tracking-*`| Letter spacing                 | `--tracking-tight`, `--tracking-normal`, `--tracking-wide` |
| `--font-*`    | Font families                  | `--font-sans`, `--font-mono` |
| `--animate-*` | Tailwind animation tokens      | `--animate-fade-in`, `--animate-slide-in`, etc. |
| `--inset-*`   | Inner highlights               | `--inset-shine` |

**Rules:**
- Theme-varying tokens (colors, shadows, materials) are defined per `[data-theme]` block.
- Static tokens (spacing, typography, radii, easing) are defined once in the `@theme` block
  or the `:root` rule and shared across all themes.
- Components reference tokens via `var(--token-name)` in inline styles, not via Tailwind color
  utilities.
- The `--text-*` namespace is shared between font-size tokens (in `@theme`) and text-color
  tokens (in theme blocks). Context makes it unambiguous: `font-size: var(--text-body)` vs
  `color: var(--text-primary)`.

---

## Key Files Reference

| File                           | Purpose                                      |
|--------------------------------|----------------------------------------------|
| `app/globals.css`              | All CSS custom properties, theme definitions, keyframes, utility classes |
| `lib/themes.ts`                | Theme IDs, labels, emojis (`THEMES` array and `ThemeId` type) |
| `app/providers.tsx`            | `ThemeProvider` -- manages `data-theme` attribute and localStorage |
| `lib/settings.ts`              | `ClawPortSettings` interface, `DEFAULTS`, `loadSettings()`, `saveSettings()`, `hexToAccentFill()` |
| `app/settings-provider.tsx`    | `SettingsProvider` -- all setter callbacks, accent color CSS variable application |
| `app/settings/page.tsx`        | Settings UI -- accent color, branding, agent customization, reset |
| `components/OnboardingWizard.tsx` | First-run wizard -- applies theme, accent color, and branding settings |
