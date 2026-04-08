# ClawPort -- Component Reference

Every React component in the codebase, grouped by area. For each component: purpose, props, key state, parent usage, and implementation notes.

---

## Component Tree

```
RootLayout (app/layout.tsx)
  ThemeProvider (app/providers.tsx)
    SettingsProvider (app/settings-provider.tsx)
      DynamicFavicon (components/DynamicFavicon.tsx)
      OnboardingWizard (components/OnboardingWizard.tsx)
      LiveStreamWidget (components/LiveStreamWidget.tsx)
      Sidebar (components/Sidebar.tsx)
        NavLinks (components/NavLinks.tsx)
        ThemeToggle (components/ThemeToggle.tsx)
        MobileSidebar (components/MobileSidebar.tsx)
        GlobalSearch (components/GlobalSearch.tsx)
      <main> (page content)
        HomePage (app/page.tsx)
          OrgMap (components/OrgMap.tsx)
            AgentNode (components/AgentNode.tsx)
              AgentAvatar (components/AgentAvatar.tsx)
          GridView (components/GridView.tsx)
            AgentAvatar
          FeedView (components/FeedView.tsx)
        ChatPage (app/chat/page.tsx)
          AgentList (components/chat/AgentList.tsx)
            AgentAvatar
          AgentListMobile (components/chat/AgentList.tsx)
            AgentAvatar
          ConversationView (components/chat/ConversationView.tsx)
            VoiceMessage (components/chat/VoiceMessage.tsx)
            FileAttachment (components/chat/FileAttachment.tsx)
            MediaPreview (components/chat/MediaPreview.tsx)
        AgentDetailPage (app/agents/[id]/page.tsx)
          AgentAvatar
          Breadcrumbs (components/Breadcrumbs.tsx)
        KanbanPage (app/kanban/page.tsx)
          KanbanBoard (components/kanban/KanbanBoard.tsx)
            KanbanColumn (components/kanban/KanbanColumn.tsx)
              TicketCard (components/kanban/TicketCard.tsx)
                AgentAvatar
          TicketDetailPanel (components/kanban/TicketDetailPanel.tsx)
          CreateTicketModal (components/kanban/CreateTicketModal.tsx)
            AgentPicker (components/kanban/AgentPicker.tsx)
              AgentAvatar
        CronsPage (app/crons/page.tsx)
          WeeklySchedule (components/crons/WeeklySchedule.tsx)
          PipelineGraph (components/crons/PipelineGraph.tsx)
        CostsPage (app/costs/page.tsx)
          CostsPage (components/costs/CostsPage.tsx)
        ActivityPage (app/activity/page.tsx)
          LogBrowser (components/activity/LogBrowser.tsx)
        MemoryPage (app/memory/page.tsx)
        SettingsPage (app/settings/page.tsx)
          AgentAvatar
        ErrorState (components/ErrorState.tsx)
```

---

## Providers

### ThemeProvider

**File:** `app/providers.tsx`
**Purpose:** Manages the active theme and applies it to the document root via `data-theme` attribute.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| children | `React.ReactNode` | Yes | App content |

**Context value:**

```ts
{ theme: ThemeId; setTheme: (t: ThemeId) => void }
```

**Key state:**
- `theme` (useState) -- persisted to `localStorage('clawport-theme')`, defaults to `'dark'`

**Implementation:**
- On mount, reads `localStorage('clawport-theme')` and sets `data-theme` attribute on `<html>`
- `setTheme` updates state, localStorage, and the DOM attribute in one call
- Exports `useTheme()` hook for consumers

**Used by:** `app/layout.tsx` (wraps entire app)

---

### SettingsProvider

**File:** `app/settings-provider.tsx`
**Purpose:** Central state management for all user-configurable settings (branding, accent color, operator name, agent display overrides).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| children | `React.ReactNode` | Yes | App content |

**Context value:**

```ts
interface SettingsContextValue {
  settings: ClawPortSettings
  setAccentColor: (color: string | null) => void
  setPortalName: (name: string | null) => void
  setPortalSubtitle: (subtitle: string | null) => void
  setPortalEmoji: (emoji: string | null) => void
  setPortalIcon: (icon: string | null) => void
  setIconBgHidden: (hidden: boolean) => void
  setEmojiOnly: (emojiOnly: boolean) => void
  setOperatorName: (name: string | null) => void
  setAgentOverride: (agentId: string, override: AgentDisplayOverride | null) => void
  getAgentDisplay: (agent: Agent) => AgentDisplay
  resetAll: () => void
}
```

**Key state:**
- `settings` (useState) -- full `ClawPortSettings` object, persisted to localStorage via `saveSettings()`

**Implementation:**
- Applies CSS custom properties (`--accent`, `--accent-hover`, `--accent-glow`) directly to `document.documentElement.style` when accent color changes
- `getAgentDisplay(agent)` merges agent defaults with per-agent overrides (custom emoji, image, background)
- `resetAll()` clears localStorage and resets to defaults
- Each setter calls `saveSettings()` after updating state

**Used by:** `app/layout.tsx` (wraps entire app, inside ThemeProvider)

---

## Layout Components

### Sidebar

**File:** `components/Sidebar.tsx`
**Purpose:** Client wrapper that coordinates the desktop sidebar, mobile header/sidebar, and Cmd+K search palette.

**Props:** None

**Key state:**
- `searchOpen` (useState) -- controls GlobalSearch visibility

**Implementation:**
- Renders `NavLinks` and `ThemeToggle` inside a fixed-width desktop sidebar (`w-[220px]`, hidden on mobile)
- Renders `MobileSidebar` for mobile viewports
- Renders `GlobalSearch` (always mounted, visibility controlled by `searchOpen`)
- Listens for custom event `clawport:open-search` to toggle search open
- Dispatches search-open from MobileSidebar's search trigger

**Used by:** `app/layout.tsx`

---

### NavLinks

**File:** `components/NavLinks.tsx`
**Purpose:** Sidebar navigation links with icons, badges, and operator identity footer.

**Props:** None

**Key state:**
- `agentCount` (useState) -- fetched from `/api/agents` on mount
- `cronErrorCount` (useState) -- fetched from `/api/crons` on mount

**Implementation:**
- Six navigation items: Map, Kanban, Messages, Crons, Memory, Settings
- Each uses a Lucide icon (`Map`, `Columns3`, `MessageCircle`, `Clock`, `Brain`, `Settings`)
- Badge system: agent count on Map, cron error count on Crons (red dot)
- Footer shows operator initials (computed from `operatorName` via `useSettings()`) and display name
- Falls back to "Operator" / "??" when `operatorName` is unset
- Uses `usePathname()` for active link highlighting

**Used by:** `components/Sidebar.tsx`

---

### MobileSidebar

**File:** `components/MobileSidebar.tsx`
**Purpose:** Fixed mobile header bar with hamburger menu and slide-out sidebar panel.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| onOpenSearch | `() => void` | No | Callback to open global search |

**Key state:**
- `isOpen` (useState) -- sidebar panel visibility

**Implementation:**
- Fixed header bar (48px) with portal emoji/name, search icon, and hamburger button
- Slide-out panel renders NavLinks and ThemeToggle
- Closes on: route change (`usePathname` effect), ESC key, click outside panel
- Prevents body scroll when open via `overflow: hidden` on body
- Only visible on mobile (`md:hidden`)

**Used by:** `components/Sidebar.tsx`

---

### GlobalSearch

**File:** `components/GlobalSearch.tsx`
**Purpose:** Cmd+K search palette with fuzzy search across agents, pages, and crons.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| open | `boolean` | Yes | Whether the search modal is visible |
| onClose | `() => void` | Yes | Callback to close the modal |

**Exports:** `GlobalSearch` (main modal) and `SearchTrigger` (button that dispatches `clawport:open-search`)

**Key state:**
- `query` (useState) -- search input text
- `results` (useState) -- filtered search results
- `selectedIndex` (useState) -- keyboard navigation position
- `agents` / `crons` (useState) -- fetched on open

**Implementation:**
- Fetches agents and crons from API when modal opens
- Fuzzy matching: checks if query characters appear in order within result label (case-insensitive)
- Results grouped by type: agents, pages (hardcoded list), crons
- Keyboard navigation: ArrowUp/ArrowDown to move, Enter to select, Escape to close
- Navigates via `router.push()` on selection
- Global keyboard listener for Cmd+K / Ctrl+K to open

**Used by:** `components/Sidebar.tsx`

---

### DynamicFavicon

**File:** `components/DynamicFavicon.tsx`
**Purpose:** Generates and applies a dynamic favicon from the portal emoji or uploaded icon image.

**Props:** None (renders `null`)

**Key state:** None (effect-only component)

**Implementation:**
- Uses Canvas API to draw favicon onto a 64x64 canvas
- If `portalIcon` (uploaded image): draws the image scaled to fill the canvas
- If `portalEmoji`: draws a colored circle background (using accent color) and renders the emoji as centered text
- If `iconBgHidden`: skips the circle background for emoji mode
- Converts canvas to PNG data URL and sets it on a `<link rel="icon">` element
- Re-runs when `portalEmoji`, `portalIcon`, `accentColor`, `iconBgHidden`, or `emojiOnly` change

**Used by:** `app/layout.tsx`

---

### ThemeToggle

**File:** `components/ThemeToggle.tsx`
**Purpose:** Theme selector rendered as a row of emoji buttons with radiogroup semantics.

**Props:** None

**Key state:** None (reads from `useTheme()`)

**Implementation:**
- Renders one button per theme with emoji indicators
- Uses `role="radiogroup"` and `aria-checked` for accessibility
- Arrow key navigation (left/right) cycles through themes
- Highlights active theme with accent-colored border
- Themes: dark, glass, color, light, system

**Used by:** `components/Sidebar.tsx`, `components/MobileSidebar.tsx`

---

### Breadcrumbs

**File:** `components/Breadcrumbs.tsx`
**Purpose:** Breadcrumb navigation bar with Lucide ChevronRight separators.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| items | `BreadcrumbItem[]` | Yes | Breadcrumb segments |

```ts
interface BreadcrumbItem {
  label: string
  href?: string   // If present, renders as Link; otherwise plain text
  icon?: LucideIcon
}
```

**Implementation:**
- Last item rendered as plain text (current page), all others as Next.js `Link`
- Optional Lucide icon rendered before each label
- Styled with `--text-secondary` and `--text-primary` CSS vars

**Used by:** `app/agents/[id]/page.tsx`

---

### ErrorState

**File:** `components/ErrorState.tsx`
**Purpose:** Full-screen error display with optional retry button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| message | `string` | Yes | Error message to display |
| onRetry | `() => void` | No | If provided, shows a retry button |

**Implementation:**
- Centered layout with warning icon, message text, and optional retry button
- Uses CSS vars for theming

**Used by:** `app/page.tsx`, `app/chat/page.tsx`, `app/crons/page.tsx`

---

### AgentAvatar

**File:** `components/AgentAvatar.tsx`
**Purpose:** Renders an agent's avatar as a profile image, emoji on colored background, or emoji-only (transparent background).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agent | `Agent` | Yes | Agent data object |
| size | `number` | Yes | Avatar dimensions in pixels |
| borderRadius | `number` | No | Border radius (default: 12) |
| style | `CSSProperties` | No | Additional inline styles |

**Key state:** None

**Implementation:**
- Uses `useSettings().getAgentDisplay(agent)` to resolve display overrides (custom emoji/image per agent)
- Three render modes:
  1. **Profile image** (agent has `profileImage` or override image): renders `<img>` with object-fit cover
  2. **Emoji on background**: renders emoji text centered on a colored circle (agent's `color` or override)
  3. **Emoji only** (`emojiOnly` setting): renders emoji with transparent background
- Background color comes from agent definition or per-agent override

**Used by:** `components/AgentNode.tsx`, `components/GridView.tsx`, `components/chat/AgentList.tsx`, `components/kanban/TicketCard.tsx`, `components/kanban/AgentPicker.tsx`, `app/agents/[id]/page.tsx`, `app/settings/page.tsx`, `app/page.tsx`

---

## Onboarding

### OnboardingWizard

**File:** `components/OnboardingWizard.tsx`
**Purpose:** Five-step first-run setup wizard for configuring portal name, theme, accent color, voice chat, and feature overview.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| forceOpen | `boolean` | No | If true, opens regardless of onboarding state; pre-populates from current settings |
| onClose | `() => void` | No | Callback when wizard closes (used with forceOpen from settings page) |

**Key state:**
- `step` (useState) -- current wizard step (0-4)
- `show` (useState) -- visibility flag
- `name` / `subtitle` / `emoji` / `operatorName` (useState) -- form fields for step 0
- `selectedTheme` (useState) -- theme choice for step 1
- `selectedAccent` (useState) -- accent color for step 2
- `micStatus` (useState) -- microphone permission state for step 3 (`'idle' | 'requesting' | 'granted' | 'denied' | 'error'`)
- `micLevel` (useState) -- real-time audio level for mic test visualization

**Steps:**
1. **Welcome** (step 0) -- Portal name, subtitle, emoji picker, operator name. Live sidebar preview showing how NavLinks will look.
2. **Theme** (step 1) -- Theme grid with preview cards. Applies theme live via `setTheme()`.
3. **Accent Color** (step 2) -- Color preset grid (12 colors). Applies live via `setAccentColor()`.
4. **Voice Chat** (step 3) -- Microphone permission test. Uses Web Audio API (`AudioContext` + `AnalyserNode`) to capture real-time audio levels and display a pulsing circle visualization.
5. **Overview** (step 4) -- Feature summary cards (Agent Map, Chat, Kanban, Crons, Memory).

**Implementation:**
- First-run detection: checks `localStorage('clawport-onboarded')`
- When `forceOpen` is true: pre-populates all fields from current settings, does NOT set `clawport-onboarded` on completion
- Normal completion: sets `clawport-onboarded` in localStorage and saves all settings
- Modal overlay with backdrop blur, step indicator dots, back/next/finish navigation
- Mic test cleans up audio stream and context on unmount or step change

**Used by:** `app/layout.tsx` (always mounted, self-hides), `app/settings/page.tsx` (via forceOpen)

---

## Map / Home Page Components

### OrgMap

**File:** `components/OrgMap.tsx`
**Purpose:** React Flow org chart visualization of the agent hierarchy with interactive node selection.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agents | `Agent[]` | Yes | All agents to render |
| crons | `CronJob[]` | Yes | Cron jobs (for status indicators) |
| selectedId | `string \| null` | Yes | Currently selected agent ID |
| onNodeClick | `(agent: Agent) => void` | Yes | Callback when a node is clicked |

**Key state:**
- `nodes` / `edges` (useState) -- React Flow node and edge arrays
- `highlightedEdges` (derived) -- edges connected to selected node

**Implementation:**
- BFS-based hierarchical layout: starts from root agent (`reportsTo` is null/undefined), assigns x/y positions by level
- Horizontal spacing: 280px, vertical spacing: 160px
- Each node rendered as custom `AgentNode` component (registered via `nodeTypes`)
- Edge highlighting: when an agent is selected, its connected edges get accent color + increased width
- Non-highlighted edges fade to 20% opacity
- Uses `ReactFlow` with `fitView`, `panOnScroll`, and zoom controls
- Dynamically imported in `app/page.tsx` with `{ ssr: false }` to avoid SSR issues with React Flow

**Used by:** `app/page.tsx` (HomePage, map view)

---

### AgentNode

**File:** `components/AgentNode.tsx`
**Purpose:** Custom React Flow node component displaying agent avatar, name, title, and status.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| data | `AgentNodeData` | Yes | Node data (passed by React Flow) |

```ts
interface AgentNodeData {
  agent: Agent
  selected: boolean
  cronHealth?: 'ok' | 'error' | 'idle'
}
```

**Implementation:**
- Renders AgentAvatar (48px) with name, title, and optional description truncated to 2 lines
- Selected state: accent-colored border and subtle glow effect
- Cron health indicator: colored dot (green/red/gray) in top-right corner
- Uses React Flow `Handle` components for source (bottom) and target (top) connections
- Exports `nodeTypes = { agentNode: AgentNode }` for React Flow registration

**Used by:** `components/OrgMap.tsx`

---

### GridView

**File:** `components/GridView.tsx`
**Purpose:** Card-based grid layout with team grouping hierarchy.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agents | `Agent[]` | Yes | All agents |
| crons | `CronJob[]` | Yes | Cron jobs for status |
| selectedId | `string \| null` | Yes | Currently selected agent |
| onSelect | `(agent: Agent) => void` | Yes | Selection callback |

**Implementation:**
- Builds team hierarchy: identifies "hero" agent (root with no `reportsTo`), groups agents by their `reportsTo` manager, separates solo operators (no reports and not reporting to anyone besides hero)
- Contains inline `AgentCard` component: renders avatar, name, title, description, cron health dot, and status badge
- Contains inline `TeamSection` component: collapsible team group with manager header
- Selected card gets accent border highlight
- Responsive grid: 1 col mobile, 2 cols md, 3 cols lg

**Used by:** `app/page.tsx` (HomePage, grid view)

---

### FeedView

**File:** `components/FeedView.tsx`
**Purpose:** Activity feed focused on cron job status with stat cards and filter pills.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agents | `Agent[]` | Yes | All agents |
| crons | `CronJob[]` | Yes | Cron jobs to display |
| selectedId | `string \| null` | Yes | Currently selected agent |
| onSelect | `(agent: Agent) => void` | Yes | Selection callback |

**Key state:**
- `filter` (useState) -- `'all' | 'ok' | 'error' | 'idle'`

**Implementation:**
- Top stat cards: total crons, healthy count, errors count, idle count
- Filter pills toggle which crons are shown
- Crons sorted by status priority (errors first) then by `lastRun` descending
- Each cron row shows: agent avatar, cron name, schedule, status badge, last run time
- Contains inline `StatusBadge` and `StatCard` helper components
- Clicking a cron row selects its associated agent

**Used by:** `app/page.tsx` (HomePage, feed view)

---

## Chat Components

### ConversationView

**File:** `components/chat/ConversationView.tsx`
**Purpose:** Main chat interface with message rendering, SSE streaming, file attachments, TTS playback, and markdown formatting.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agent | `Agent` | Yes | The agent being chatted with |
| conversation | `Conversation` | Yes | Current conversation data |
| onUpdate | `(conv: Conversation) => void` | Yes | Callback when conversation changes |
| onBack | `() => void` | No | Mobile back button callback |

**Key state:**
- `input` (useState) -- text input value
- `isStreaming` (useState) -- whether an SSE response is in progress
- `streamingText` (useState) -- accumulated streaming response text
- `attachments` (useState) -- staged `MediaAttachment[]` before send
- `isRecording` (useState) -- voice recording active
- `ttsPlaying` (useState) -- message ID currently playing TTS
- `ttsLoading` (useState) -- message ID currently loading TTS

**Implementation:**
- **SSE streaming:** POST to `/api/chat/[id]` with `ReadableStream` reader. Parses `data:` lines, accumulates text, calls `onUpdate` with final message.
- **Markdown rendering:** Inline `renderMarkdown()` function handles bold, italic, inline code, code blocks with language labels and copy buttons, links, and bullet lists.
- **TTS playback:** Sends message text to `/api/tts`, receives audio blob, plays via `Audio` object. Toggle play/stop per message.
- **File attachments:** Three input methods -- paste (Cmd+V), drag-and-drop, and file picker button. Images resized to 1200px max via Canvas API (`resizeImage` helper). Files converted to base64 data URLs for persistence.
- **Voice recording:** Uses `createAudioRecorder()` from `lib/audio-recorder.ts`. Records audio, captures waveform, transcribes via `/api/transcribe`, sends transcription as message. Stores audio data URL + waveform for playback.
- **Auto-scroll:** `useEffect` scrolls to bottom on new messages or streaming updates.
- **operatorName:** Sends `operatorName` from settings context in POST body for system prompt injection.

**Used by:** `app/chat/page.tsx` (ChatPage)

---

### AgentList / AgentListMobile

**File:** `components/chat/AgentList.tsx`
**Purpose:** Agent selection sidebar for chat. Two exports: `AgentList` (desktop, 300px fixed sidebar) and `AgentListMobile` (full-width, shown on mobile when no agent is selected).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agents | `Agent[]` | Yes | Available agents |
| conversations | `Map<string, Conversation>` | Yes | All conversations (for previews/timestamps) |
| activeId | `string \| null` | Yes | Currently selected agent ID |
| onSelect | `(agent: Agent) => void` | Yes | Selection callback |
| loading | `boolean` | No | Show skeleton loading state |

**Key state:**
- `search` (useState) -- filter text for agent search

**Implementation:**
- Agents sorted by last activity (most recent conversation first), then alphabetically
- Each row shows: AgentAvatar, agent name, title, last message preview (truncated), relative timestamp
- Unread badge: green dot when conversation has unread messages
- Online status dot: always green (placeholder for future live status)
- Search filters by agent name or title (case-insensitive)
- Desktop variant: fixed 300px sidebar with border-right separator
- Mobile variant: full-width list, hidden when an agent is selected

**Used by:** `app/chat/page.tsx` (ChatPage)

---

### VoiceMessage

**File:** `components/chat/VoiceMessage.tsx`
**Purpose:** Audio waveform playback component with play/pause toggle and animated progress visualization.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| src | `string` | Yes | Audio source URL (base64 data URL) |
| duration | `number` | Yes | Duration in seconds |
| waveform | `number[]` | Yes | Amplitude samples (40-60 values, 0-1 range) |
| isUser | `boolean` | Yes | Whether this is the user's message (affects color) |

**Key state:**
- `isPlaying` (useState) -- playback state
- `progress` (useState) -- playback progress (0-1)
- `audioRef` (useRef) -- HTMLAudioElement reference

**Implementation:**
- Renders amplitude bars as vertical `<div>` elements with heights proportional to waveform values
- Progress tracking: bars before the playback position get accent color, bars after get muted color
- Uses `timeupdate` event on `<audio>` element to update progress
- Play/pause toggle with Lucide Play/Pause icons
- Duration display formatted as `m:ss`

**Used by:** `components/chat/ConversationView.tsx`

---

### FileAttachment

**File:** `components/chat/FileAttachment.tsx`
**Purpose:** File attachment bubble with type-specific icon and download button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | File name |
| size | `number` | No | File size in bytes |
| mimeType | `string` | No | MIME type for icon selection |
| url | `string` | Yes | Download URL (base64 data URL) |
| isUser | `boolean` | Yes | Whether this is the user's message (affects color) |

**Implementation:**
- Type-specific SVG icons: PDF (red), document (blue), text (gray), archive (yellow), generic (gray)
- Icon selected by MIME type matching
- File size formatted as human-readable (B, KB, MB)
- Download button creates a temporary `<a>` element with `download` attribute
- Styled differently for user vs assistant messages

**Used by:** `components/chat/ConversationView.tsx`

---

### MediaPreview

**File:** `components/chat/MediaPreview.tsx`
**Purpose:** Horizontal strip of staged attachment thumbnails shown below the chat input before sending.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| attachments | `MediaAttachment[]` | Yes | Staged attachments to preview |
| onRemove | `(index: number) => void` | Yes | Callback to remove an attachment by index |

**Implementation:**
- Horizontal scroll container with gap between items
- Images: renders thumbnail preview with object-fit cover
- Non-images: renders file icon with name and size
- Each item has an X button overlay for removal
- Thumbnails sized at 80x80px with rounded corners

**Used by:** `components/chat/ConversationView.tsx`

---

## Kanban Components

### KanbanBoard

**File:** `components/kanban/KanbanBoard.tsx`
**Purpose:** Renders the kanban board as a row of columns with ticket cards.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| tickets | `KanbanTicket[]` | Yes | All tickets |
| agents | `Agent[]` | Yes | All agents (for avatar rendering) |
| onTicketClick | `(ticket: KanbanTicket) => void` | Yes | Ticket selection callback |
| onMoveTicket | `(ticketId: string, status: string) => void` | Yes | Ticket move callback |
| onCreateTicket | `(status: string) => void` | Yes | Create ticket callback |
| isWorking | `(ticketId: string) => boolean` | No | Whether a ticket has active agent work |
| filterAgentId | `string \| null` | No | Filter tickets to a specific agent |

**Implementation:**
- Four columns: Backlog, In Progress, Review, Done
- Filters tickets by `filterAgentId` if set
- Groups tickets into columns by `status` field
- Each column rendered as `KanbanColumn` with `TicketCard` children
- Horizontal scroll on mobile with `overflow-x-auto`

**Used by:** `app/kanban/page.tsx`

---

### KanbanColumn

**File:** `components/kanban/KanbanColumn.tsx`
**Purpose:** Single kanban column with drag-and-drop support.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| column | `{ id: string; title: string }` | Yes | Column metadata |
| tickets | `KanbanTicket[]` | Yes | Tickets in this column |
| agents | `Agent[]` | Yes | All agents |
| onTicketClick | `(ticket: KanbanTicket) => void` | Yes | Ticket click callback |
| onDrop | `(ticketId: string) => void` | Yes | Drop callback (ticket moved to this column) |
| onCreateTicket | `() => void` | No | Create ticket callback (shown in backlog column) |
| renderTicket | `(ticket: KanbanTicket) => ReactNode` | Yes | Ticket render function |

**Key state:**
- `dragOver` (useState) -- whether a ticket is being dragged over this column

**Implementation:**
- Column header with title, ticket count badge, and optional + button (backlog only)
- HTML5 drag-and-drop: `onDragOver` sets visual feedback, `onDrop` extracts ticket ID from `dataTransfer`
- Drop zone highlight: accent-colored border when dragging over
- Scrollable ticket list with vertical overflow

**Used by:** `components/kanban/KanbanBoard.tsx`

---

### TicketCard

**File:** `components/kanban/TicketCard.tsx`
**Purpose:** Draggable ticket card displaying ticket metadata and agent assignment.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| ticket | `KanbanTicket` | Yes | Ticket data |
| agent | `Agent \| undefined` | Yes | Assigned agent (if any) |
| onClick | `() => void` | Yes | Click callback |
| isWorking | `boolean` | No | Whether agent work is in progress |

**Implementation:**
- HTML5 draggable: sets `ticketId` in `dataTransfer` on drag start
- Visual elements: priority dot (color-coded: red=urgent, orange=high, blue=medium, gray=low), title, description preview (truncated), assigned agent avatar + name, role badge, relative timestamp
- Work state indicator: pulsing dot and "Working..." label when `isWorking` is true
- Opacity reduction during drag

**Used by:** `components/kanban/KanbanBoard.tsx` (via `KanbanColumn`)

---

### TicketDetailPanel

**File:** `components/kanban/TicketDetailPanel.tsx`
**Purpose:** Slide-in side panel for viewing ticket details and chatting with the assigned agent about the ticket.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| ticket | `KanbanTicket` | Yes | Ticket to display |
| agent | `Agent \| undefined` | Yes | Assigned agent |
| onClose | `() => void` | Yes | Close callback |
| onStatusChange | `(status: string) => void` | Yes | Status change callback |
| onDelete | `() => void` | Yes | Delete callback |
| onRetryWork | `() => void` | No | Retry agent work callback |

**Key state:**
- `chatMessages` (useState) -- inline chat message history
- `chatInput` (useState) -- chat input text
- `isStreaming` (useState) -- SSE response in progress
- `streamingText` (useState) -- accumulated response text
- `expanded` (useState) -- panel width toggle (narrow/wide)

**Implementation:**
- Slide-in panel from right side (400px default, 600px expanded)
- Header: ticket title, priority badge, expand/collapse toggle, close button
- Ticket details: description, status selector (dropdown), assigned agent, role, timestamps
- Work result section: shows agent work output if available, with retry button
- Inline chat: SSE streaming to `/api/chat/[id]`, markdown rendering (bold, italic, code, code blocks, links, lists)
- Status selector: dropdown with all column statuses
- Delete button with confirmation (red styling)

**Used by:** `app/kanban/page.tsx`

---

### CreateTicketModal

**File:** `components/kanban/CreateTicketModal.tsx`
**Purpose:** Modal dialog for creating new kanban tickets with title, description, priority, agent assignment, and role.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| open | `boolean` | Yes | Whether the modal is visible |
| onOpenChange | `(open: boolean) => void` | Yes | Visibility change callback |
| agents | `Agent[]` | Yes | Available agents for assignment |
| onSubmit | `(data: CreateTicketData) => void` | Yes | Form submission callback |

**Key state:**
- `title` / `description` (useState) -- form fields
- `priority` (useState) -- `'low' | 'medium' | 'high' | 'urgent'`
- `agentId` (useState) -- assigned agent ID
- `role` (useState) -- `'executor' | 'reviewer' | 'consultant'`

**Implementation:**
- Uses Radix Dialog (`components/ui/dialog`) for modal behavior
- Priority selector: four buttons with color-coded dots
- Agent assignment: uses `AgentPicker` component
- Role selector: three buttons (Executor, Reviewer, Consultant)
- Form resets on close
- Submit disabled when title is empty

**Used by:** `app/kanban/page.tsx`

---

### AgentPicker

**File:** `components/kanban/AgentPicker.tsx`
**Purpose:** Custom dropdown selector for choosing an agent, with search and keyboard navigation.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| agents | `Agent[]` | Yes | Available agents |
| value | `string \| null` | Yes | Selected agent ID |
| onChange | `(agentId: string \| null) => void` | Yes | Selection callback |

**Key state:**
- `open` (useState) -- dropdown visibility
- `search` (useState) -- filter text
- `highlightIndex` (useState) -- keyboard navigation position

**Implementation:**
- Trigger button shows selected agent's avatar + name, or "Unassigned"
- Dropdown with search input at top
- Keyboard navigation: ArrowUp/ArrowDown to move, Enter to select, Escape to close
- "Unassigned" option always shown first
- Filtered list shows agent avatar, name, and title
- Checkmark icon on selected agent
- Closes on selection or outside click

**Used by:** `components/kanban/CreateTicketModal.tsx`

---

## Cron Components

### WeeklySchedule

**File:** `components/crons/WeeklySchedule.tsx`
**Purpose:** Seven-day calendar grid showing when cron jobs are scheduled to run.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| crons | `CronJob[]` | Yes | Cron jobs to display |

**Key state:**
- `hoveredCron` (useState) -- cron ID for tooltip display
- `now` (useState) -- current time, updated every 60s for the time indicator

**Implementation:**
- 7-column grid (Mon-Sun) with hour rows for active schedule range
- Parses cron schedule expressions to determine which hours/days each cron runs
- Cron pills: colored bars positioned in the appropriate day/hour cells, using the assigned agent's color
- Status dots on pills: green (ok), red (error), gray (idle)
- Tooltip on hover: shows cron name, schedule expression, last run time, status
- Current time indicator: red horizontal line at the current hour position
- Hour labels on the left axis

**Used by:** `app/crons/page.tsx` (schedule tab)

---

### PipelineGraph

**File:** `components/crons/PipelineGraph.tsx`
**Purpose:** React Flow visualization of cron job pipelines showing dependencies between stages.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| crons | `CronJob[]` | Yes | Cron jobs to visualize |

**Implementation:**
- Groups crons into pipelines (crons with `pipeline` field) and standalone crons
- Topological layout: arranges pipeline stages left-to-right based on dependency order
- Contains inline `CronPipelineNode` custom React Flow node: shows cron name, schedule, agent, status badge
- Contains inline `StandaloneCrons` component: grid of non-pipeline crons
- Edges connect pipeline stages with animated flow indicators
- Node colors based on status: green (ok), red (error), gray (idle)
- Uses `ReactFlow` with `fitView` and pan/zoom controls

**Used by:** `app/crons/page.tsx` (pipelines tab)

---

## Cost Components

### CostsPage

**File:** `components/costs/CostsPage.tsx`
**Purpose:** Full cost dashboard with token usage analysis, daily cost chart, per-job breakdown, model distribution, anomaly detection, and week-over-week trends.

**Key state:**
- `summary` (useState) -- `CostSummary` fetched from `/api/costs`
- `crons` (useState) -- `CronJob[]` for job name resolution
- `hover` (useState) -- chart hover state for daily cost bars

**Implementation:**
- Fetches cost data from `/api/costs` (computed from cron run token usage)
- Summary cards: total cost, top spender, week-over-week change (with trend arrows), cache savings
- Daily cost bar chart (SVG) with hover tooltips
- Per-job cost table sorted by total cost descending
- Model breakdown showing token distribution percentages
- Anomaly alerts for runs exceeding 5x median token usage
- All cost computation in `lib/costs.ts` (pricing lookup, job aggregation, daily rollup, anomaly detection)

**Used by:** `app/costs/page.tsx`

---

## Activity Components

### ActivityPage

**File:** `app/activity/page.tsx`
**Purpose:** Activity Console with summary cards (total events, errors, sources) and log browser. Header includes an "Open Live Stream" button that dispatches `clawport:open-stream-widget` to open the global floating widget.

**Key state:**
- `entries` (useState) -- log entries fetched from `/api/logs`
- `summary` (useState) -- computed log summary (counts, sources, time range)
- `filter` (useState) -- log level filter (`all`, `error`, `config`, `cron`)

**Implementation:**
- Fetches historical logs from `/api/logs` on mount, polls every 60 seconds
- Summary cards show total events, error count (with pulse animation), and source breakdown
- "Open Live Stream" button dispatches `CustomEvent('clawport:open-stream-widget')`

**Used by:** Route `/activity`

### LogBrowser

**File:** `components/activity/LogBrowser.tsx`
**Purpose:** Filterable, searchable table of historical log entries with level badges and expandable details.

**Used by:** `app/activity/page.tsx`

### LiveStreamWidget

**File:** `components/LiveStreamWidget.tsx`
**Purpose:** Global floating widget for live log streaming via SSE. Mounted in root layout, persists across navigation.

**Props:** None (self-contained, listens for `clawport:open-stream-widget` DOM event)

**Key state:**
- `state` (useState) -- `'hidden'` | `'collapsed'` | `'expanded'`
- `lines` (useState) -- `LiveLogLine[]` (max 500, ring buffer)
- `streaming` (useState) -- whether SSE connection is active
- `autoScroll` (useState) -- tracks manual scroll detection

**Implementation:**
- Three visual states: hidden (default, returns null), collapsed pill (bottom-right), expanded panel (440x400)
- SSE stream via `fetch('/api/logs/stream')` with `parseSSEBuffer()` from `lib/sse.ts`
- Each log row shows time, level pill (INF/WRN/ERR/DBG), truncated message
- Click any row to expand raw JSON payload (pretty-printed)
- Header: status dot, line count, copy all, minimize, close
- Footer: play/pause toggle, scroll-to-bottom button
- Copy formats lines as `[HH:MM:SS] [level] message`
- Collapsing does NOT stop the stream; close stops + hides
- z-index: 50 (below OnboardingWizard)

**Used by:** `app/layout.tsx` (global mount)

---

## Page Components

### HomePage (Home)

**File:** `app/page.tsx`
**Purpose:** Main dashboard with three view modes (map, grid, feed) and agent detail side panel.

**Key state:**
- `agents` (useState) -- fetched from `/api/agents`
- `crons` (useState) -- fetched from `/api/crons`
- `selectedAgent` (useState) -- agent for detail panel
- `view` (useState) -- `'map' | 'grid' | 'feed'`
- `loading` / `error` (useState)

**Implementation:**
- View mode toggle: three icon buttons in header (Map, Grid, Activity)
- Map view: dynamically imports `OrgMap` with `{ ssr: false }`
- Grid view: renders `GridView`
- Feed view: renders `FeedView`
- Agent detail panel: slide-in from right (400px) showing avatar, name, title, description, tools list, hierarchy links, cron health
- Contains inline `StatusDot` and `MapSkeleton` helper components

**Used by:** Route `/`

---

### ChatPage

**File:** `app/chat/page.tsx`
**Purpose:** Full messaging interface with agent selection and conversation management.

**Key state:**
- `agents` (useState) -- fetched from `/api/agents`
- `conversations` (useState) -- `Map<string, Conversation>` from localStorage
- `activeAgent` (useState) -- currently selected agent
- `loading` / `error` (useState)

**Implementation:**
- Wraps `MessengerApp` in `Suspense` boundary
- `MessengerApp` reads `agent` query param to pre-select an agent
- Desktop: two-panel layout (AgentList sidebar + ConversationView)
- Mobile: shows AgentListMobile when no agent selected, ConversationView when agent selected (with back button)
- Conversations persisted to localStorage, keyed by agent ID
- Contains inline `EmptyState` component (shown when no agent selected on desktop)

**Used by:** Route `/chat`

---

### ChatRedirect

**File:** `app/chat/[id]/page.tsx`
**Purpose:** Simple redirect from `/chat/[id]` to `/chat?agent=[id]`.

**Implementation:**
- Server component that uses `redirect()` from Next.js
- Enables direct agent chat links

**Used by:** Route `/chat/[id]`

---

### AgentDetailPage

**File:** `app/agents/[id]/page.tsx`
**Purpose:** Full agent profile page with hero section, about card, tools, hierarchy, SOUL.md viewer, crons, and voice config.

**Key state:**
- `agent` (useState) -- fetched from `/api/agents`
- `crons` (useState) -- agent's cron jobs
- `soulContent` (useState) -- SOUL.md file contents
- `showSoul` (useState) -- SOUL.md viewer toggle

**Implementation:**
- Hero section: large avatar, name, title, description, "Chat" button linking to `/chat?agent=[id]`
- About card: agent description and metadata
- Tools card: list of agent tools/capabilities
- Hierarchy card: "Reports to" and "Direct reports" links to other agent pages
- SOUL.md viewer: collapsible panel showing agent's SOUL.md content with syntax highlighting
- Crons card: list of agent's cron jobs with status badges
- Voice config card: voice settings display
- Contains inline `SoulViewer`, `CopyButton`, `Card`, `DetailSkeleton`, `StatusDot` helper components
- Uses `Breadcrumbs` component for navigation

**Used by:** Route `/agents/[id]`

---

### KanbanPage

**File:** `app/kanban/page.tsx`
**Purpose:** Kanban board for managing agent work tickets with drag-and-drop, CRUD, and agent work integration.

**Key state:**
- `tickets` (useState) -- from `KanbanStore` (localStorage)
- `agents` (useState) -- fetched from `/api/agents`
- `selectedTicket` (useState) -- ticket for detail panel
- `showCreate` (useState) -- create modal visibility
- `filterAgentId` (useState) -- agent filter
- `agentWork` -- from `useAgentWork()` hook

**Implementation:**
- Agent filter bar: horizontal scroll of agent avatar buttons to filter by assignee
- Renders `KanbanBoard` with all tickets and agents
- `TicketDetailPanel` opens on ticket click
- `CreateTicketModal` for new ticket creation
- Ticket CRUD: create, move (status change), delete via `KanbanStore` methods
- Agent work: `useAgentWork()` hook manages sending tickets to agents for execution, polling for results
- Retry work: re-sends ticket to agent if previous work failed

**Used by:** Route `/kanban`

---

### CronsPage

**File:** `app/crons/page.tsx`
**Purpose:** Cron monitoring dashboard with three tabs (overview, schedule, pipelines).

**Key state:**
- `crons` (useState) -- fetched from `/api/crons`, auto-refreshes every 60s
- `agents` (useState) -- fetched from `/api/agents`
- `tab` (useState) -- `'overview' | 'schedule' | 'pipelines'`
- `filter` (useState) -- `'all' | 'ok' | 'error' | 'idle'`
- `loading` / `error` (useState)

**Implementation:**
- **Overview tab:** Health donut chart (SVG), attention-needed cards for errored crons, delivery stats, error banners, recent runs list (lazy-loaded)
- **Schedule tab:** `WeeklySchedule` component
- **Pipelines tab:** `PipelineGraph` component
- Contains many inline helpers:
  - `HealthCard` -- SVG donut chart showing ok/error/idle proportions
  - `AttentionCard` -- clickable cards for crons needing attention
  - `DeliveryCard` -- delivery success rate stats
  - `DeliveryBadge` -- color-coded status badge
  - `ErrorsBanners` -- expandable error detail banners
  - `RecentRuns` -- lazy-loaded recent run history
- Auto-refresh: `setInterval` every 60s re-fetches cron data
- Filter pills in overview tab filter the cron list

**Used by:** Route `/crons`

---

### MemoryPage

**File:** `app/memory/page.tsx`
**Purpose:** Two-panel memory file browser with search, navigation, and content viewer.

**Key state:**
- `files` (useState) -- fetched from `/api/memory`
- `selectedFile` (useState) -- currently viewed file
- `fileContent` (useState) -- content of selected file
- `search` (useState) -- file search filter
- `loading` (useState)

**Implementation:**
- Left panel: file tree sidebar with search input, file list with icons, keyboard navigation (arrow keys, enter)
- Right panel: content viewer with copy and download buttons
- Markdown files: rendered with basic markdown formatting
- JSON files: syntax-highlighted with color-coded tokens
- Other files: rendered as plain preformatted text
- Contains inline `FileIcon`, `FolderIcon`, `BackArrow` helper components
- File icons vary by extension (JSON, MD, TXT, etc.)

**Used by:** Route `/memory`

---

### SettingsPage

**File:** `app/settings/page.tsx`
**Purpose:** Settings management page for accent color, branding, agent customization, and setup wizard access.

**Key state:**
- `agents` (useState) -- fetched from `/api/agents`
- `showWizard` (useState) -- re-run onboarding wizard toggle
- `expandedAgent` (useState) -- which agent's customization section is expanded
- `imageUploading` (useState) -- loading state during image upload

**Sections:**
1. **Accent Color** -- preset color grid (12 colors + reset to default)
2. **Branding** -- portal name, subtitle, emoji picker, icon upload (with Canvas API resize to 128px)
3. **Agent Customization** -- expandable per-agent sections to override emoji or profile image
4. **Danger Zone** -- reset all settings button, re-run setup wizard button

**Implementation:**
- Image uploads use Canvas API (`resizeImage` helper) to resize to 128px max and convert to base64 data URL
- Agent customization: each agent row expands to show emoji input and image upload
- Re-run wizard: renders `<OnboardingWizard forceOpen onClose={...} />` when triggered
- Reset all: calls `resetAll()` from settings context

**Used by:** Route `/settings`

---

## UI Primitives

**Directory:** `components/ui/`

Radix-based primitive components used throughout the app. These are standard shadcn/ui-style wrappers and are not individually documented in detail.

| Component | File | Radix Primitive | Purpose |
|-----------|------|-----------------|---------|
| Badge | `badge.tsx` | -- | Status/label badges with variant styling |
| Button | `button.tsx` | Slot | Button with variant and size props |
| Card | `card.tsx` | -- | Card container with header, content, footer |
| Dialog | `dialog.tsx` | Dialog | Modal dialog with overlay |
| ScrollArea | `scroll-area.tsx` | ScrollArea | Custom scrollbar container |
| Separator | `separator.tsx` | Separator | Horizontal/vertical divider |
| Skeleton | `skeleton.tsx` | -- | Loading placeholder animation |
| Tabs | `tabs.tsx` | Tabs | Tab navigation with content panels |
| Tooltip | `tooltip.tsx` | Tooltip | Hover tooltip with positioning |
