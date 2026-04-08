import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  Callout,
  InfoCard,
} from "./DocSection";

export function ArchitectureSection() {
  return (
    <>
      <Heading>Architecture</Heading>
      <Paragraph>
        ClawPort is a Next.js 16 dashboard for managing OpenClaw AI agents. It
        provides an org chart (Org Map), direct agent chat with multimodal
        support, cron monitoring, kanban task board, and memory browsing. All AI
        calls route through the OpenClaw gateway -- no separate API keys needed.
      </Paragraph>

      <SubHeading>Tech Stack</SubHeading>
      <BulletList
        items={[
          "Next.js 16.1.6 (App Router, Turbopack)",
          "React 19.2.3, TypeScript 5",
          "Tailwind CSS 4 with CSS custom properties for theming",
          "Vitest 4 with jsdom environment (17 suites, 288 tests)",
          "OpenAI SDK (routed to Claude via OpenClaw gateway, default port 18789)",
          "React Flow (@xyflow/react) for org chart",
        ]}
      />

      <SubHeading>Agent Registry Resolution</SubHeading>
      <CodeBlock>
        {`loadRegistry() checks:
  1. $WORKSPACE_PATH/clawport/agents.json  (user override)
  2. Bundled lib/agents.json            (default)`}
      </CodeBlock>
      <Paragraph>
        <InlineCode>lib/agents-registry.ts</InlineCode> exports{" "}
        <InlineCode>loadRegistry()</InlineCode>.{" "}
        <InlineCode>lib/agents.ts</InlineCode> calls it to build the full agent
        list (merging in SOUL.md content from the workspace). Users customize
        their agent team by dropping an{" "}
        <InlineCode>agents.json</InlineCode> into their workspace -- no source
        edits needed.
      </Paragraph>

      <SubHeading>Chat Pipeline (Text)</SubHeading>
      <CodeBlock>
        {`Client -> POST /api/chat/[id] -> OpenAI SDK -> localhost:<port>/v1/chat/completions -> Claude
                                         (streaming SSE response, port defaults to 18789)`}
      </CodeBlock>

      <SubHeading>Chat Pipeline (Images/Vision)</SubHeading>
      <Paragraph>
        The gateway's HTTP endpoint strips image_url content. Vision uses the
        CLI agent pipeline:
      </Paragraph>
      <CodeBlock>
        {`Client resizes image to 1200px max (Canvas API)
  -> base64 data URL in message
  -> POST /api/chat/[id]
  -> Detects image in LATEST user message only (not history)
  -> execFile: openclaw gateway call chat.send --params <json> --token <token>
  -> Polls: openclaw gateway call chat.history every 2s
  -> Matches response by timestamp >= sendTs
  -> Returns assistant text via SSE`}
      </CodeBlock>

      <InfoCard title="Design Decisions">
        <BulletList
          items={[
            <>
              <strong style={{ color: "var(--text-primary)" }}>
                Why send-then-poll?
              </strong>{" "}
              chat.send is async -- it returns immediately. We poll chat.history
              until the assistant's response appears.
            </>,
            <>
              <strong style={{ color: "var(--text-primary)" }}>
                Why CLI and not WebSocket?
              </strong>{" "}
              The gateway WebSocket requires device keypair signing for
              operator.write scope. The CLI has the device keys; custom clients
              don't.
            </>,
            <>
              <strong style={{ color: "var(--text-primary)" }}>
                Why resize to 1200px?
              </strong>{" "}
              macOS ARG_MAX is 1MB. Unresized photos can produce multi-MB base64
              that exceeds CLI argument limits (E2BIG error).
            </>,
          ]}
        />
      </InfoCard>

      <SubHeading>Voice Message Pipeline</SubHeading>
      <CodeBlock>
        {`Browser MediaRecorder (webm/opus or mp4)
  -> AudioContext AnalyserNode captures waveform (40-60 samples)
  -> Stop -> audioBlob + waveform data
  -> POST /api/transcribe (Whisper via gateway)
  -> Transcription text sent as message content
  -> Audio data URL + waveform stored in message for playback`}
      </CodeBlock>

      <SubHeading>operatorName Flow</SubHeading>
      <CodeBlock>
        {`OnboardingWizard / Settings page
  -> ClawPortSettings.operatorName (localStorage)
  -> settings-provider.tsx (React context)
  -> NavLinks.tsx (dynamic initials + display name)
  -> ConversationView.tsx (sends operatorName in POST body)
  -> /api/chat/[id] route (injects into system prompt)`}
      </CodeBlock>
      <Callout type="note">
        No hardcoded operator names anywhere. Falls back to "Operator" / "??"
        when unset.
      </Callout>

      <SubHeading>Directory Structure</SubHeading>
      <CodeBlock>
        {`app/
  page.tsx              -- Org Map (React Flow org chart)
  chat/page.tsx         -- Multi-agent messenger
  agents/[id]/page.tsx  -- Agent detail profile
  kanban/page.tsx       -- Task board
  crons/page.tsx        -- Cron job monitor
  memory/page.tsx       -- Memory file browser
  settings/page.tsx     -- ClawPort personalization
  docs/page.tsx         -- Documentation browser
  api/
    agents/route.ts     -- GET agents from registry
    chat/[id]/route.ts  -- POST chat (text + vision)
    crons/route.ts      -- GET crons via CLI
    memory/route.ts     -- GET memory files
    tts/route.ts        -- POST text-to-speech
    transcribe/route.ts -- POST audio transcription

components/
  OrgMap.tsx          -- React Flow graph with auto-layout
  AgentNode.tsx         -- Custom node for the org chart
  Sidebar.tsx           -- Desktop navigation sidebar
  MobileSidebar.tsx     -- Mobile hamburger menu
  NavLinks.tsx          -- Sidebar nav links
  ThemeToggle.tsx       -- Theme switcher (5 themes)
  GlobalSearch.tsx      -- Cmd+K agent search
  chat/                 -- Chat components
  kanban/               -- Kanban components
  crons/                -- Cron components
  docs/                 -- Documentation components

lib/
  agents.ts             -- Agent registry + SOUL.md reader
  agents-registry.ts    -- Registry loader
  anthropic.ts          -- Vision pipeline (send + poll)
  conversations.ts      -- Conversation store (localStorage)
  settings.ts           -- ClawPortSettings type + persistence
  themes.ts             -- Theme definitions
  types.ts              -- Shared TypeScript types`}
      </CodeBlock>

      <SubHeading>Key Libraries</SubHeading>
      <Table
        headers={["File", "Purpose"]}
        rows={[
          [
            <InlineCode key="a">lib/agents.ts</InlineCode>,
            "Agent list builder -- calls loadRegistry(), merges SOUL.md",
          ],
          [
            <InlineCode key="ar">lib/agents-registry.ts</InlineCode>,
            "loadRegistry() -- workspace override -> bundled fallback",
          ],
          [
            <InlineCode key="an">lib/anthropic.ts</InlineCode>,
            "Vision pipeline: hasImageContent, sendViaOpenClaw (send + poll), execCli",
          ],
          [
            <InlineCode key="c">lib/conversations.ts</InlineCode>,
            "Conversation store with localStorage persistence",
          ],
          [
            <InlineCode key="e">lib/env.ts</InlineCode>,
            "requireEnv(name) -- safe env var access with clear errors",
          ],
          [
            <InlineCode key="m">lib/multimodal.ts</InlineCode>,
            "buildApiContent() -- converts Message+Media to OpenAI API format",
          ],
          [
            <InlineCode key="s">lib/settings.ts</InlineCode>,
            "ClawPortSettings type, loadSettings(), saveSettings() (localStorage)",
          ],
          [
            <InlineCode key="v">lib/validation.ts</InlineCode>,
            "validateChatMessages() -- validates text + multimodal content arrays",
          ],
        ]}
      />

      <SubHeading>Conventions</SubHeading>
      <BulletList
        items={[
          "No external charting/media libraries -- native Web APIs (Canvas, MediaRecorder, AudioContext)",
          "Base64 data URLs for all persisted media (not blob URLs)",
          "CSS custom properties for theming -- no Tailwind color classes directly",
          "Inline styles referencing CSS vars (e.g., style={{ color: 'var(--text-primary)' }})",
          "Tests colocated with source: lib/foo.ts + lib/foo.test.ts",
          "Call requireEnv() inside functions, not at module top level",
        ]}
      />
    </>
  );
}
