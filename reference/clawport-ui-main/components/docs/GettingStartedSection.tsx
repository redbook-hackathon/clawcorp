import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  NumberedList,
  Callout,
} from "./DocSection";

export function GettingStartedSection() {
  return (
    <>
      <Heading>Getting Started</Heading>
      <Paragraph>
        This guide walks you through getting ClawPort running against your own
        OpenClaw instance. ClawPort is a Next.js 16 dashboard for managing,
        monitoring, and talking directly to your OpenClaw AI agents.
      </Paragraph>

      <SubHeading>Prerequisites</SubHeading>
      <BulletList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>Node.js 22+</strong>{" "}
            -- verify with <InlineCode>node -v</InlineCode>
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>OpenClaw</strong>{" "}
            -- installed and working: <InlineCode>openclaw --version</InlineCode>
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              OpenClaw gateway running
            </strong>{" "}
            -- ClawPort talks to the gateway at{" "}
            <InlineCode>localhost:18789</InlineCode> by default (configurable via{" "}
            <InlineCode>OPENCLAW_GATEWAY_PORT</InlineCode>)
          </>,
        ]}
      />

      <SubHeading>Quick Start (npm)</SubHeading>
      <Callout type="note">
        The npm package is <InlineCode>clawport-ui</InlineCode>. The CLI command
        is <InlineCode>clawport</InlineCode>. Do not install the unrelated{" "}
        <InlineCode>clawport</InlineCode> package.
      </Callout>
      <CodeBlock title="terminal">
        {`# Install globally (package: clawport-ui, command: clawport)
npm install -g clawport-ui

# Run the setup wizard (auto-detects your OpenClaw config)
clawport setup

# Start the dev server
clawport dev`}
      </CodeBlock>
      <Callout type="warning">
        If you get <InlineCode>EACCES: permission denied</InlineCode> or{" "}
        <InlineCode>EEXIST</InlineCode> errors during install, your npm cache
        has broken permissions (usually from a previous{" "}
        <InlineCode>sudo npm install</InlineCode>). Fix it with:{" "}
        <InlineCode>sudo chown -R $(whoami) ~/.npm</InlineCode> then retry.
        See the Troubleshooting section for full details.
      </Callout>

      <SubHeading>Quick Start (from source)</SubHeading>
      <CodeBlock title="terminal">
        {`# Clone the repo
git clone https://github.com/JohnRiceML/clawport-ui.git
cd clawport-ui

# Install dependencies
npm install

# Auto-detect your OpenClaw config and write .env.local
npm run setup

# Start the dev server
npm run dev`}
      </CodeBlock>
      <Paragraph>
        Open <InlineCode>http://localhost:3000</InlineCode>. On first launch
        you'll see the onboarding wizard which walks you through naming your
        portal, choosing a theme, and personalizing agent avatars.
      </Paragraph>

      <SubHeading>Environment Variables</SubHeading>
      <Paragraph>
        The fastest way to configure is the auto-setup script:{" "}
        <InlineCode>npm run setup</InlineCode>. It auto-detects your{" "}
        <InlineCode>WORKSPACE_PATH</InlineCode>,{" "}
        <InlineCode>OPENCLAW_BIN</InlineCode>, and gateway token from your local
        OpenClaw installation.
      </Paragraph>
      <Paragraph>
        To configure manually, copy the template and edit:
      </Paragraph>
      <CodeBlock>{`cp .env.example .env.local`}</CodeBlock>

      <Table
        headers={["Variable", "Required", "Description"]}
        rows={[
          [
            <InlineCode key="ws">WORKSPACE_PATH</InlineCode>,
            "Yes",
            "Path to your OpenClaw workspace directory (default: ~/.openclaw/workspace)",
          ],
          [
            <InlineCode key="bin">OPENCLAW_BIN</InlineCode>,
            "Yes",
            "Absolute path to the openclaw CLI binary",
          ],
          [
            <InlineCode key="tok">OPENCLAW_GATEWAY_TOKEN</InlineCode>,
            "Yes",
            "Token that authenticates all API calls to the gateway",
          ],
          [
            <InlineCode key="el">ELEVENLABS_API_KEY</InlineCode>,
            "No",
            "ElevenLabs API key for voice/TTS indicators on agent profiles",
          ],
        ]}
      />

      <Callout type="tip">
        No separate AI API keys are needed. All AI calls (chat, vision, TTS,
        transcription) route through the OpenClaw gateway. One subscription, one
        token.
      </Callout>

      <SubHeading>Finding Your Values</SubHeading>
      <NumberedList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>WORKSPACE_PATH</strong>:{" "}
            Run <InlineCode>ls ~/.openclaw/workspace</InlineCode> to verify.
            You should see files like <InlineCode>SOUL.md</InlineCode>, an{" "}
            <InlineCode>agents/</InlineCode> directory, and a{" "}
            <InlineCode>memory/</InlineCode> directory.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>OPENCLAW_BIN</strong>:{" "}
            Run <InlineCode>which openclaw</InlineCode> and use the full path.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              OPENCLAW_GATEWAY_TOKEN
            </strong>
            : Run <InlineCode>openclaw gateway status</InlineCode> to view your
            gateway configuration including the token.
          </>,
        ]}
      />

      <SubHeading>Start the Gateway</SubHeading>
      <Paragraph>
        ClawPort expects the OpenClaw gateway running at{" "}
        <InlineCode>localhost:18789</InlineCode> (or your custom port). Start it in a separate terminal:
      </Paragraph>
      <CodeBlock>{`openclaw gateway run`}</CodeBlock>
      <Callout type="warning">
        The gateway's HTTP chat completions endpoint is disabled by default.
        Running <InlineCode>clawport setup</InlineCode> will detect this and
        offer to enable it automatically. If chat returns a 405 error, see the
        Troubleshooting section.
      </Callout>

      <SubHeading>First-Run Onboarding</SubHeading>
      <Paragraph>
        On your first visit, ClawPort launches the onboarding wizard (5 steps):
      </Paragraph>
      <NumberedList
        items={[
          "Naming your portal -- give your command centre a custom name and subtitle",
          "Choosing a theme -- pick from Dark, Glass, Color, Light, or System",
          "Setting an accent color -- personalize the UI highlight color",
          "Voice chat -- optional microphone permission test",
          "Overview -- feature summary of all pages",
        ]}
      />
      <Paragraph>
        All of these can be changed later in the Settings page.
      </Paragraph>

      <SubHeading>Production Build</SubHeading>
      <CodeBlock title="terminal">
        {`npx next build
npm start`}
      </CodeBlock>
      <Paragraph>
        The production server runs on port 3000 by default. The gateway still
        needs to be running.
      </Paragraph>
    </>
  );
}
