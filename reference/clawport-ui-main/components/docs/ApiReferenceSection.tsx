import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  Callout,
  InfoCard,
} from "./DocSection";

export function ApiReferenceSection() {
  return (
    <>
      <Heading>API Reference</Heading>
      <Paragraph>
        All API routes are Next.js App Router route handlers under{" "}
        <InlineCode>app/api/</InlineCode>. The base URL during development is{" "}
        <InlineCode>http://localhost:3000</InlineCode>.
      </Paragraph>

      <InfoCard title="Error Format">
        <Paragraph>
          All error responses share a consistent JSON shape:
        </Paragraph>
        <CodeBlock>{`{ "error": "Human-readable error message" }`}</CodeBlock>
      </InfoCard>

      <SubHeading>Route Summary</SubHeading>
      <Table
        headers={["Method", "Endpoint", "Gateway", "Content-Type"]}
        rows={[
          [
            "GET",
            <InlineCode key="1">/api/agents</InlineCode>,
            "No",
            "application/json",
          ],
          [
            "POST",
            <InlineCode key="2">/api/chat/[id]</InlineCode>,
            "Yes",
            "text/event-stream",
          ],
          [
            "GET",
            <InlineCode key="3">/api/crons</InlineCode>,
            "No",
            "application/json",
          ],
          [
            "GET",
            <InlineCode key="4">/api/cron-runs</InlineCode>,
            "No",
            "application/json",
          ],
          [
            "GET",
            <InlineCode key="5">/api/memory</InlineCode>,
            "No",
            "application/json",
          ],
          [
            "POST",
            <InlineCode key="6">/api/tts</InlineCode>,
            "Yes",
            "audio/mpeg",
          ],
          [
            "POST",
            <InlineCode key="7">/api/transcribe</InlineCode>,
            "Yes",
            "application/json",
          ],
          [
            "POST",
            <InlineCode key="8">/api/kanban/chat/[id]</InlineCode>,
            "Yes",
            "text/event-stream",
          ],
          [
            "GET",
            <InlineCode key="9">/api/kanban/chat-history/[ticketId]</InlineCode>,
            "No",
            "application/json",
          ],
          [
            "POST",
            <InlineCode key="10">/api/kanban/chat-history/[ticketId]</InlineCode>,
            "No",
            "application/json",
          ],
        ]}
      />

      {/* ── GET /api/agents ────────────────────────────────────── */}
      <SubHeading>GET /api/agents</SubHeading>
      <Paragraph>
        Returns the full list of registered agents, each with their SOUL.md
        content loaded from the filesystem. No parameters required.
      </Paragraph>
      <Table
        headers={["Field", "Type", "Description"]}
        rows={[
          [<InlineCode key="id">id</InlineCode>, "string", "Slug identifier"],
          [<InlineCode key="n">name</InlineCode>, "string", "Display name"],
          [<InlineCode key="t">title</InlineCode>, "string", "Role title"],
          [
            <InlineCode key="s">soul</InlineCode>,
            "string | null",
            "Full SOUL.md content, or null if file not found",
          ],
          [
            <InlineCode key="c">crons</InlineCode>,
            "CronJob[]",
            "Always [] from this endpoint (populated client-side)",
          ],
        ]}
      />

      {/* ── POST /api/chat/[id] ────────────────────────────────── */}
      <SubHeading>POST /api/chat/[id]</SubHeading>
      <Paragraph>
        Send a chat message to an agent and receive a streaming response. Has
        two pipelines depending on whether the latest user message contains
        images.
      </Paragraph>
      <Table
        headers={["Field", "Type", "Required", "Description"]}
        rows={[
          [
            <InlineCode key="m">messages</InlineCode>,
            "ApiMessage[]",
            "Yes",
            "Conversation history",
          ],
          [
            <InlineCode key="o">operatorName</InlineCode>,
            "string",
            "No",
            'Name shown to the agent. Defaults to "Operator"',
          ],
        ]}
      />
      <Paragraph>
        <strong style={{ color: "var(--text-primary)" }}>Pipeline 1 (Text):</strong>{" "}
        Streaming chat completion via the gateway. Response is SSE with{" "}
        <InlineCode>{"data: {\"content\":\"token\"}"}</InlineCode> frames.
      </Paragraph>
      <Paragraph>
        <strong style={{ color: "var(--text-primary)" }}>Pipeline 2 (Vision):</strong>{" "}
        When the latest message contains image_url content. Uses CLI chat.send +
        chat.history polling. Complete response arrives in a single SSE frame.
      </Paragraph>

      {/* ── GET /api/crons ─────────────────────────────────────── */}
      <SubHeading>GET /api/crons</SubHeading>
      <Paragraph>
        Returns all cron jobs registered with OpenClaw, enriched with schedule
        descriptions, agent ownership, and delivery config. Runs{" "}
        <InlineCode>openclaw cron list --json</InlineCode> via the CLI.
      </Paragraph>

      {/* ── GET /api/cron-runs ─────────────────────────────────── */}
      <SubHeading>GET /api/cron-runs</SubHeading>
      <Paragraph>
        Returns cron run history parsed from JSONL log files on the filesystem.
        Results sorted newest-first. Optional{" "}
        <InlineCode>jobId</InlineCode> query parameter filters to a specific
        job.
      </Paragraph>

      {/* ── GET /api/memory ────────────────────────────────────── */}
      <SubHeading>GET /api/memory</SubHeading>
      <Paragraph>
        Returns the contents of key memory files from the workspace: long-term
        memory, team memory, team intel, and the daily logs for today and
        yesterday. Only files that exist are included in the response.
      </Paragraph>

      {/* ── POST /api/tts ──────────────────────────────────────── */}
      <SubHeading>POST /api/tts</SubHeading>
      <Paragraph>
        Converts text to speech audio using the OpenClaw gateway's TTS endpoint.
      </Paragraph>
      <Table
        headers={["Field", "Type", "Required", "Description"]}
        rows={[
          [
            <InlineCode key="t">text</InlineCode>,
            "string",
            "Yes",
            "The text to synthesize",
          ],
          [
            <InlineCode key="v">voice</InlineCode>,
            "string",
            "No",
            'Voice identifier. Defaults to "alloy"',
          ],
        ]}
      />

      {/* ── POST /api/transcribe ───────────────────────────────── */}
      <SubHeading>POST /api/transcribe</SubHeading>
      <Paragraph>
        Transcribes audio to text using the Whisper endpoint. Request body is
        multipart form data with an <InlineCode>audio</InlineCode> file field.
      </Paragraph>

      {/* ── SSE Protocol ───────────────────────────────────────── */}
      <SubHeading>SSE Stream Protocol</SubHeading>
      <Paragraph>
        All streaming chat endpoints use the same Server-Sent Events protocol:
      </Paragraph>
      <CodeBlock>
        {`data: {"content":"Hello"}

data: {"content":" there"}

data: [DONE]`}
      </CodeBlock>
      <Callout type="note">
        Content-Type is <InlineCode>text/event-stream</InlineCode> with{" "}
        <InlineCode>Cache-Control: no-cache</InlineCode>. If a stream error
        occurs mid-response, the server sends [DONE] and closes the connection.
      </Callout>

      <SubHeading>Client-Side Consumption</SubHeading>
      <CodeBlock title="example">
        {`const reader = response.body.getReader()
const decoder = new TextDecoder()
let fullText = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })
  const lines = chunk.split('\\n')

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const payload = line.slice(6)
      if (payload === '[DONE]') return fullText
      try {
        const { content } = JSON.parse(payload)
        fullText += content
      } catch { /* skip malformed frames */ }
    }
  }
}`}
      </CodeBlock>
    </>
  );
}
