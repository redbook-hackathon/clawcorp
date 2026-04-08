import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  InfoCard,
} from "./DocSection";

export function ComponentsSection() {
  return (
    <>
      <Heading>Components</Heading>
      <Paragraph>
        ClawPort's component tree follows the standard Next.js App Router
        pattern: providers wrap the entire app, layout components handle the
        sidebar and navigation, and each route renders its own page component.
      </Paragraph>

      <SubHeading>Component Tree</SubHeading>
      <CodeBlock>
        {`RootLayout (app/layout.tsx)
  ThemeProvider (app/providers.tsx)
    SettingsProvider (app/settings-provider.tsx)
      DynamicFavicon
      OnboardingWizard
      Sidebar
        NavLinks
        ThemeToggle
        MobileSidebar
        GlobalSearch
      <main> (page content)
        HomePage ............. / (org chart, grid, feed)
          OrgMap (React Flow)
            AgentNode
              AgentAvatar
          GridView
          FeedView
        ChatPage .............. /chat
          AgentList
          ConversationView
            VoiceMessage
            FileAttachment
            MediaPreview
        AgentDetailPage ....... /agents/[id]
        KanbanPage ............ /kanban
          KanbanBoard
            KanbanColumn
              TicketCard
          TicketDetailPanel
          CreateTicketModal
            AgentPicker
        CronsPage ............. /crons
          WeeklySchedule
          PipelineGraph
        MemoryPage ............ /memory
        DocsPage .............. /docs
        SettingsPage .......... /settings`}
      </CodeBlock>

      <SubHeading>Providers</SubHeading>
      <InfoCard title="ThemeProvider">
        <BulletList
          items={[
            <>
              <strong style={{ color: "var(--text-primary)" }}>File:</strong>{" "}
              <InlineCode>app/providers.tsx</InlineCode>
            </>,
            "Manages the active theme and applies it via data-theme attribute on <html>",
            <>
              Consumer hook:{" "}
              <InlineCode>{"const { theme, setTheme } = useTheme()"}</InlineCode>
            </>,
            <>
              Persists to <InlineCode>localStorage('clawport-theme')</InlineCode>,
              defaults to 'dark'
            </>,
          ]}
        />
      </InfoCard>

      <InfoCard title="SettingsProvider">
        <BulletList
          items={[
            <>
              <strong style={{ color: "var(--text-primary)" }}>File:</strong>{" "}
              <InlineCode>app/settings-provider.tsx</InlineCode>
            </>,
            "Central state management for all user-configurable settings",
            <>
              Consumer hook:{" "}
              <InlineCode>{"const { settings, setAccentColor, ... } = useSettings()"}</InlineCode>
            </>,
            "Applies accent color CSS variables directly to document.documentElement",
            <>
              Persists to{" "}
              <InlineCode>localStorage('clawport-settings')</InlineCode>
            </>,
          ]}
        />
      </InfoCard>

      <SubHeading>Layout Components</SubHeading>
      <Table
        headers={["Component", "File", "Purpose"]}
        rows={[
          [
            "Sidebar",
            <InlineCode key="s">components/Sidebar.tsx</InlineCode>,
            "Desktop sidebar wrapper. Renders NavLinks, ThemeToggle, MobileSidebar, GlobalSearch.",
          ],
          [
            "NavLinks",
            <InlineCode key="n">components/NavLinks.tsx</InlineCode>,
            "Sidebar nav links with icons, badges, and operator identity footer.",
          ],
          [
            "MobileSidebar",
            <InlineCode key="m">components/MobileSidebar.tsx</InlineCode>,
            "Fixed mobile header bar with hamburger menu and slide-out sidebar panel.",
          ],
          [
            "GlobalSearch",
            <InlineCode key="g">components/GlobalSearch.tsx</InlineCode>,
            "Cmd+K search palette with fuzzy search across agents, pages, and crons.",
          ],
          [
            "ThemeToggle",
            <InlineCode key="t">components/ThemeToggle.tsx</InlineCode>,
            "Theme selector rendered as a row of emoji buttons with radiogroup semantics.",
          ],
        ]}
      />

      <SubHeading>Chat Components</SubHeading>
      <Table
        headers={["Component", "Purpose"]}
        rows={[
          [
            "ConversationView",
            "Main chat: messages, SSE streaming, file attachments, TTS playback, voice recording, markdown rendering.",
          ],
          [
            "AgentList",
            "Agent selection sidebar for chat. Desktop (300px fixed) and mobile (full-width) variants.",
          ],
          [
            "VoiceMessage",
            "Audio waveform playback with play/pause toggle and animated progress bars.",
          ],
          [
            "FileAttachment",
            "File attachment bubble with type-specific icon and download button.",
          ],
          [
            "MediaPreview",
            "Horizontal strip of staged attachment thumbnails before sending.",
          ],
        ]}
      />

      <SubHeading>Map Components</SubHeading>
      <Table
        headers={["Component", "Purpose"]}
        rows={[
          [
            "OrgMap",
            "React Flow org chart with BFS-based hierarchical layout, edge highlighting, and interactive zoom.",
          ],
          [
            "AgentNode",
            "Custom React Flow node: avatar, name, title, cron health indicator, selection state.",
          ],
          [
            "GridView",
            "Card-based grid with team grouping hierarchy. Responsive: 1/2/3 columns.",
          ],
          [
            "FeedView",
            "Activity feed focused on cron status with stat cards and filter pills.",
          ],
        ]}
      />

      <SubHeading>Kanban Components</SubHeading>
      <Table
        headers={["Component", "Purpose"]}
        rows={[
          [
            "KanbanBoard",
            "Four-column board (Backlog, In Progress, Review, Done) with agent filter.",
          ],
          [
            "KanbanColumn",
            "Single column with HTML5 drag-and-drop support and drop zone highlight.",
          ],
          [
            "TicketCard",
            "Draggable card: priority dot, title, agent avatar, work state indicator.",
          ],
          [
            "TicketDetailPanel",
            "Slide-in side panel for ticket details and inline agent chat.",
          ],
          [
            "CreateTicketModal",
            "Modal for creating tickets with title, description, priority, agent assignment.",
          ],
        ]}
      />

      <SubHeading>Other Key Components</SubHeading>
      <Table
        headers={["Component", "Purpose"]}
        rows={[
          [
            "OnboardingWizard",
            "5-step first-run setup wizard (name, theme, accent, voice, overview). Re-runnable from Settings.",
          ],
          [
            "AgentAvatar",
            "Agent avatar: profile image, emoji on colored background, or emoji-only mode.",
          ],
          [
            "DynamicFavicon",
            "Generates favicon from portal emoji/icon using Canvas API.",
          ],
          [
            "ErrorState",
            "Full-screen error display with optional retry button.",
          ],
          [
            "Breadcrumbs",
            "Breadcrumb navigation bar with Lucide ChevronRight separators.",
          ],
        ]}
      />

      <SubHeading>UI Primitives</SubHeading>
      <Paragraph>
        Radix-based primitive components in{" "}
        <InlineCode>components/ui/</InlineCode> (shadcn/ui-style wrappers):
      </Paragraph>
      <BulletList
        items={[
          "Badge, Button, Card, Dialog, ScrollArea, Separator, Skeleton, Tabs, Tooltip",
        ]}
      />
    </>
  );
}
