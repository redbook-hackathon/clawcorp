import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  BulletList,
  NumberedList,
  Callout,
} from "./DocSection";

export function TroubleshootingSection() {
  return (
    <>
      <Heading>Troubleshooting</Heading>
      <Paragraph>
        Common issues and their solutions when running ClawPort.
      </Paragraph>

      {/* ── npm install permission errors ──────────────────────── */}
      <SubHeading>
        EACCES / EEXIST / permission denied during npm install -g
      </SubHeading>
      <Paragraph>
        If you see errors like <InlineCode>EACCES: permission denied</InlineCode>,{" "}
        <InlineCode>EEXIST</InlineCode>,{" "}
        <InlineCode>Invalid response body while trying to fetch</InlineCode>, or
        a failed rename in <InlineCode>~/.npm/_cacache</InlineCode> when
        running <InlineCode>npm install -g clawport-ui</InlineCode>, your npm
        cache is corrupted or has broken permissions. This usually happens if{" "}
        <InlineCode>npm install -g</InlineCode> was previously run with{" "}
        <InlineCode>sudo</InlineCode>.
      </Paragraph>
      <Paragraph>
        <strong style={{ color: "var(--text-primary)" }}>Quick fix</strong> --
        clear the cache and retry:
      </Paragraph>
      <CodeBlock title="terminal">
        {`sudo npm cache clean --force
npm install -g clawport-ui`}
      </CodeBlock>
      <Paragraph>
        If that still fails, fix the underlying permissions:
      </Paragraph>
      <CodeBlock title="terminal">
        {`# Fix npm cache ownership
sudo chown -R $(whoami) ~/.npm

# Fix global node_modules ownership (find your prefix first)
npm prefix -g
# Then fix permissions on that path, e.g.:
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin

# Retry without sudo
npm install -g clawport-ui`}
      </CodeBlock>
      <Paragraph>
        <strong style={{ color: "var(--text-primary)" }}>
          Alternative: avoid sudo entirely
        </strong>{" "}
        -- configure npm to install globals in your home directory:
      </Paragraph>
      <CodeBlock title="terminal">
        {`mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g clawport-ui`}
      </CodeBlock>
      <Callout type="warning">
        Never use <InlineCode>sudo npm install -g</InlineCode> -- it creates
        root-owned files in your user's npm cache and global directories, which
        causes permission errors on every future install. If your setup requires
        sudo for global installs, consider using{" "}
        <InlineCode>nvm</InlineCode> (Node Version Manager) or the{" "}
        <InlineCode>~/.npm-global</InlineCode> prefix approach above, which
        install Node and global packages in your home directory with no
        permission issues.
      </Callout>

      {/* ── Issue 1 ────────────────────────────────────────────── */}
      <SubHeading>
        "Missing required environment variable: WORKSPACE_PATH"
      </SubHeading>
      <Paragraph>
        Your <InlineCode>.env.local</InlineCode> is missing or the variable
        isn't set. Make sure you copied <InlineCode>.env.example</InlineCode>:
      </Paragraph>
      <CodeBlock>{`cp .env.example .env.local`}</CodeBlock>
      <Paragraph>
        Then fill in the values. Restart the dev server after changing{" "}
        <InlineCode>.env.local</InlineCode>.
      </Paragraph>

      {/* ── 405 Method Not Allowed ─────────────────────────────── */}
      <SubHeading>405 Method Not Allowed when chatting</SubHeading>
      <Paragraph>
        The gateway's HTTP chat completions endpoint is disabled by default.
        Enable it in <InlineCode>~/.openclaw/openclaw.json</InlineCode>:
      </Paragraph>
      <CodeBlock title="~/.openclaw/openclaw.json (merge into existing config)">
        {`"gateway": {
  "http": {
    "endpoints": {
      "chatCompletions": { "enabled": true }
    }
  }
}`}
      </CodeBlock>
      <Paragraph>
        Restart the gateway after changing the config. You can also re-run{" "}
        <InlineCode>clawport setup</InlineCode> which will detect and fix this
        automatically.
      </Paragraph>

      {/* ── Issue 2 ────────────────────────────────────────────── */}
      <SubHeading>Gateway connection refused / chat not working</SubHeading>
      <Paragraph>
        The OpenClaw gateway isn't running. Start it:
      </Paragraph>
      <CodeBlock>{`openclaw gateway run`}</CodeBlock>
      <Paragraph>Verify it's reachable:</Paragraph>
      <CodeBlock>{`curl http://localhost:18789/v1/models`}</CodeBlock>
      <Paragraph>
        You should get a JSON response. If you changed your gateway port, replace{" "}
        <InlineCode>18789</InlineCode> with your custom port. Set{" "}
        <InlineCode>OPENCLAW_GATEWAY_PORT</InlineCode> in your{" "}
        <InlineCode>.env.local</InlineCode> so ClawPort connects to the right port.
      </Paragraph>

      {/* ── Issue 3 ────────────────────────────────────────────── */}
      <SubHeading>No agents showing up</SubHeading>
      <NumberedList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              Check WORKSPACE_PATH
            </strong>{" "}
            -- make sure it points to a valid OpenClaw workspace directory.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              Check your agents.json
            </strong>{" "}
            -- if you placed a custom{" "}
            <InlineCode>agents.json</InlineCode> at{" "}
            <InlineCode>$WORKSPACE_PATH/clawport/agents.json</InlineCode>, make
            sure it's valid JSON. A syntax error will cause a silent fallback to
            the bundled registry.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              Check the server console
            </strong>{" "}
            -- ClawPort logs errors to the terminal where{" "}
            <InlineCode>npm run dev</InlineCode> is running.
          </>,
        ]}
      />
      <Callout type="tip">
        Test your agents.json with:{" "}
        <InlineCode>
          cat $WORKSPACE_PATH/clawport/agents.json | python3 -m json.tool
        </InlineCode>
      </Callout>

      {/* ── Issue 4 ────────────────────────────────────────────── */}
      <SubHeading>Agent SOUL.md not loading</SubHeading>
      <Paragraph>
        The <InlineCode>soulPath</InlineCode> in your agents.json is relative to{" "}
        <InlineCode>WORKSPACE_PATH</InlineCode>. If your workspace is at{" "}
        <InlineCode>/Users/you/.openclaw/workspace</InlineCode> and soulPath is{" "}
        <InlineCode>"agents/vera/SOUL.md"</InlineCode>, ClawPort will look for{" "}
        <InlineCode>
          /Users/you/.openclaw/workspace/agents/vera/SOUL.md
        </InlineCode>
        .
      </Paragraph>
      <Paragraph>Make sure the file exists at that path.</Paragraph>

      {/* ── Issue 5 ────────────────────────────────────────────── */}
      <SubHeading>Images not working in chat</SubHeading>
      <Paragraph>
        Image messages use the CLI pipeline. Common issues:
      </Paragraph>
      <NumberedList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              OPENCLAW_BIN path is wrong
            </strong>{" "}
            -- run <InlineCode>which openclaw</InlineCode> and update{" "}
            <InlineCode>.env.local</InlineCode>.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              Gateway token is wrong
            </strong>{" "}
            -- verify with{" "}
            <InlineCode>openclaw gateway status</InlineCode>.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              Image too large
            </strong>{" "}
            -- ClawPort resizes to 1200px max, but extremely large images may
            still hit limits. Try a smaller image.
          </>,
        ]}
      />
      <Paragraph>
        Check the server console for errors like{" "}
        <InlineCode>sendViaOpenClaw execFile error:</InlineCode> or{" "}
        <InlineCode>E2BIG</InlineCode>.
      </Paragraph>

      {/* ── Issue 6 ────────────────────────────────────────────── */}
      <SubHeading>Voice/TTS features not working</SubHeading>
      <Paragraph>
        Voice features require <InlineCode>ELEVENLABS_API_KEY</InlineCode> in
        your <InlineCode>.env.local</InlineCode>. Without it, voice indicators
        won't appear on agent profiles.
      </Paragraph>
      <Paragraph>
        Audio transcription (speech-to-text) uses Whisper through the OpenClaw
        gateway and does not require a separate key.
      </Paragraph>

      {/* ── Issue 7 ────────────────────────────────────────────── */}
      <SubHeading>Port 3000 already in use</SubHeading>
      <Paragraph>
        Another process is using port 3000. Either stop it or run on a different
        port:
      </Paragraph>
      <CodeBlock>{`npm run dev -- -p 3001`}</CodeBlock>

      {/* ── Debug Image Pipeline ──────────────────────────────── */}
      <SubHeading>Debug Image Pipeline</SubHeading>
      <Paragraph>
        Step-by-step debugging for the vision (image) chat pipeline:
      </Paragraph>
      <NumberedList
        items={[
          <>
            Check server console for{" "}
            <InlineCode>sendViaOpenClaw execFile error:</InlineCode> or{" "}
            <InlineCode>sendViaOpenClaw: timed out</InlineCode>
          </>,
          <>
            Test CLI directly:
          </>,
        ]}
      />
      <CodeBlock title="terminal">
        {`# Test chat.send
openclaw gateway call chat.send \\
  --params '{"sessionKey":"agent:main:clawport","idempotencyKey":"test","message":"describe","attachments":[]}' \\
  --token <token> --json

# Check history
openclaw gateway call chat.history \\
  --params '{"sessionKey":"agent:main:clawport"}' \\
  --token <token> --json

# Verify gateway health
openclaw gateway call health --token <token>`}
      </CodeBlock>

      <SubHeading>Running Tests</SubHeading>
      <CodeBlock title="terminal">
        {`npm test             # Run all tests via Vitest
npx tsc --noEmit     # Type-check (expect 0 errors)`}
      </CodeBlock>

      <Callout type="note">
        All tests are in the <InlineCode>lib/</InlineCode> directory, colocated
        with source files. Key test patterns include{" "}
        <InlineCode>vi.mock('child_process')</InlineCode> for CLI tests,{" "}
        <InlineCode>vi.useFakeTimers</InlineCode> for polling tests, and{" "}
        <InlineCode>vi.stubEnv()</InlineCode> for environment variable tests.
      </Callout>
    </>
  );
}
