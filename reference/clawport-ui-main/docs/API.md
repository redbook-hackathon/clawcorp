# ClawPort -- API Reference

All API routes are Next.js App Router route handlers under `app/api/`.
The base URL during development is `http://localhost:3000`.

## Prerequisites

| Dependency | Required By | Notes |
|---|---|---|
| OpenClaw gateway (`localhost:18789`) | `/api/chat/[id]`, `/api/tts`, `/api/transcribe`, `/api/kanban/chat/[id]` | Must be running for any AI-powered route |
| `WORKSPACE_PATH` env var | `/api/agents`, `/api/memory`, `/api/cron-runs`, `/api/kanban/chat-history/[ticketId]` | Filesystem path to `.openclaw/workspace` |
| `OPENCLAW_BIN` env var | `/api/crons`, `/api/chat/[id]` (vision path) | Path to the `openclaw` CLI binary |
| `OPENCLAW_GATEWAY_TOKEN` env var | All gateway-dependent routes | Auth token for the OpenClaw gateway |

## Error Format

All error responses share a consistent JSON shape:

```json
{ "error": "Human-readable error message" }
```

Returned with the appropriate HTTP status code and `Content-Type: application/json`.

---

## Routes

### GET `/api/agents`

Returns the full list of registered agents, each with their SOUL.md content loaded from the filesystem.

**Data source:** JSON registry file (bundled `lib/agents.json` or user override at `$WORKSPACE_PATH/clawport/agents.json`) + SOUL.md files from the workspace filesystem.

#### Request

No parameters.

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `Agent[]` |
| 500 | `application/json` | `{ "error": string }` |

**`Agent` schema:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Slug identifier (e.g. `"vera"`) |
| `name` | `string` | Display name (e.g. `"VERA"`) |
| `title` | `string` | Role title (e.g. `"Chief Strategy Officer"`) |
| `reportsTo` | `string \| null` | Parent agent ID, or `null` for the root |
| `directReports` | `string[]` | Child agent IDs |
| `soulPath` | `string \| null` | Path to the agent's SOUL.md file |
| `soul` | `string \| null` | Full SOUL.md content (loaded at request time), or `null` if file not found |
| `voiceId` | `string \| null` | ElevenLabs voice ID |
| `color` | `string` | Hex color for the org chart node |
| `emoji` | `string` | Emoji identifier |
| `tools` | `string[]` | Tools this agent has access to |
| `crons` | `CronJob[]` | Always `[]` from this endpoint (populated client-side) |
| `memoryPath` | `string \| null` | Path to the agent's memory file |
| `description` | `string` | One-liner description of the agent |

#### Example

```bash
curl http://localhost:3000/api/agents
```

```js
const res = await fetch('/api/agents')
const agents = await res.json()
// agents[0].id => "jarvis"
// agents[0].soul => "# JARVIS\n\nYou are the team's orchestrator..."
```

---

### POST `/api/chat/[id]`

Send a chat message to an agent and receive a streaming response. This route has **two pipelines** depending on whether the latest user message contains images.

**Requires:** OpenClaw gateway running at `localhost:18789`.

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Agent ID (must match a registered agent) |

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | `ApiMessage[]` | Yes | Conversation history |
| `operatorName` | `string` | No | Name shown to the agent as its operator. Defaults to `"Operator"` |

**`ApiMessage` schema:**

| Field | Type | Description |
|---|---|---|
| `role` | `"user" \| "assistant" \| "system"` | Message role |
| `content` | `string \| ContentPart[]` | Plain text or multimodal content array |

**`ContentPart` variants:**

```ts
{ type: "text", text: string }
{ type: "image_url", image_url: { url: string } }
```

Image URLs must be base64 data URLs (e.g. `data:image/jpeg;base64,...`). Client-side images should be resized to 1200px max before encoding to avoid exceeding macOS ARG_MAX.

#### Pipeline 1: Text Streaming

Used when the latest user message does **not** contain images.

The route creates a streaming chat completion via the OpenAI SDK pointed at the gateway (`localhost:18789/v1/chat/completions`) using model `claude-sonnet-4-6`.

**Response:** Server-Sent Events (`text/event-stream`).

Each SSE data line is a JSON object with a `content` field containing the next token:

```
data: {"content":"Hello"}

data: {"content":" there"}

data: [DONE]
```

#### Pipeline 2: Vision (send + poll)

Used when the latest user message **does** contain `image_url` content parts and `OPENCLAW_GATEWAY_TOKEN` is set.

The gateway's `/v1/chat/completions` endpoint strips image content, so vision messages go through the CLI agent pipeline instead:

1. Images are extracted and converted to `{ mimeType, content (base64) }` attachments.
2. `openclaw gateway call chat.send` is invoked via `execFile` to send the message asynchronously.
3. The route polls `openclaw gateway call chat.history` every 2 seconds (up to 60s timeout) until the assistant's response appears.
4. The complete response is returned as a single SSE frame followed by `[DONE]`.

**Response:** Same SSE format as Pipeline 1, but the entire response arrives in a single `data:` frame rather than streamed token-by-token.

#### Response Summary

| Status | Content-Type | Body |
|---|---|---|
| 200 | `text/event-stream` | SSE stream (both pipelines) |
| 400 | `application/json` | `{ "error": string }` -- invalid JSON or failed message validation |
| 404 | `application/json` | `{ "error": "Agent not found" }` |
| 500 | `application/json` | `{ "error": "Chat failed. Make sure OpenClaw gateway is running." }` |

#### Example

```js
// Text message
const res = await fetch('/api/chat/jarvis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operatorName: 'John',
    messages: [
      { role: 'user', content: 'What cron jobs are running today?' }
    ]
  })
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value)
  // Parse SSE lines: "data: {\"content\":\"...\"}\n\n"
}
```

```js
// Vision message (image)
const res = await fetch('/api/chat/vera', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What do you see in this screenshot?' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ...' } }
        ]
      }
    ]
  })
})
```

---

### GET `/api/crons`

Returns all cron jobs registered with OpenClaw, enriched with schedule descriptions, agent ownership, and delivery config.

**Data source:** Runs `openclaw cron list --json` via the CLI (`OPENCLAW_BIN` required).

#### Request

No parameters.

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `CronJob[]` |
| 500 | `application/json` | `{ "error": string }` |

**`CronJob` schema:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Job identifier |
| `name` | `string` | Job name (used to match owning agent by prefix) |
| `schedule` | `string` | Raw cron expression |
| `scheduleDescription` | `string` | Human-readable (e.g. `"Daily at 8 AM"`) |
| `timezone` | `string \| null` | Timezone from schedule object, if present |
| `status` | `"ok" \| "error" \| "idle"` | Last run outcome |
| `lastRun` | `string \| null` | ISO 8601 timestamp of last execution |
| `nextRun` | `string \| null` | ISO 8601 timestamp of next scheduled run |
| `lastError` | `string \| null` | Error message from last failed run |
| `agentId` | `string \| null` | Owning agent ID (matched by job name prefix) |
| `description` | `string \| null` | Job description |
| `enabled` | `boolean` | Whether the job is active |
| `delivery` | `CronDelivery \| null` | Delivery config (mode, channel, to) |
| `lastDurationMs` | `number \| null` | Duration of last run in milliseconds |
| `consecutiveErrors` | `number` | Count of consecutive failed runs |
| `lastDeliveryStatus` | `string \| null` | Delivery outcome of last run |

**`CronDelivery` schema:**

| Field | Type | Description |
|---|---|---|
| `mode` | `string` | Delivery mode |
| `channel` | `string` | Delivery channel |
| `to` | `string \| null` | Delivery recipient |

#### Example

```bash
curl http://localhost:3000/api/crons
```

---

### GET `/api/cron-runs`

Returns cron run history parsed from JSONL log files on the filesystem. Results are sorted newest-first.

**Data source:** Reads `.jsonl` files from `$WORKSPACE_PATH/../cron/runs/`.

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `jobId` | `string` | No | Filter to runs for a specific job. When provided, reads only `{jobId}.jsonl`. When omitted, reads all `.jsonl` files in the runs directory. |

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `CronRun[]` |
| 500 | `application/json` | `{ "error": string }` |

**`CronRun` schema:**

| Field | Type | Description |
|---|---|---|
| `ts` | `number` | Unix timestamp (milliseconds) of the run |
| `jobId` | `string` | Job identifier |
| `status` | `"ok" \| "error"` | Run outcome |
| `summary` | `string \| null` | Summary of what the run produced |
| `error` | `string \| null` | Error message if the run failed |
| `durationMs` | `number` | Duration in milliseconds |
| `deliveryStatus` | `string \| null` | Delivery outcome |

#### Example

```bash
# All runs
curl http://localhost:3000/api/cron-runs

# Runs for a specific job
curl "http://localhost:3000/api/cron-runs?jobId=pulse-daily-digest"
```

---

### GET `/api/memory`

Returns the contents of key memory files from the workspace: long-term memory, team memory, team intel, and the daily logs for today and yesterday.

**Data source:** Reads specific files from the `$WORKSPACE_PATH` filesystem directory.

Files checked (in order):
1. `$WORKSPACE_PATH/MEMORY.md` -- Long-Term Memory (Jarvis)
2. `$WORKSPACE_PATH/memory/team-memory.md` -- Team Memory
3. `$WORKSPACE_PATH/memory/team-intel.json` -- Team Intel (JSON)
4. `$WORKSPACE_PATH/memory/{YYYY-MM-DD}.md` -- Daily Log (Today)
5. `$WORKSPACE_PATH/memory/{YYYY-MM-DD}.md` -- Daily Log (Yesterday)

Only files that exist are included in the response.

#### Request

No parameters.

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `MemoryFile[]` |
| 500 | `application/json` | `{ "error": string }` |

**`MemoryFile` schema:**

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Human-readable label (e.g. `"Long-Term Memory (Jarvis)"`) |
| `path` | `string` | Absolute filesystem path to the file |
| `content` | `string` | Full file contents |
| `lastModified` | `string` | ISO 8601 timestamp of last modification |

#### Example

```bash
curl http://localhost:3000/api/memory
```

```js
const res = await fetch('/api/memory')
const files = await res.json()
// files[0].label => "Long-Term Memory (Jarvis)"
// files[0].content => "# Memory\n\n..."
```

---

### POST `/api/tts`

Converts text to speech audio using the OpenClaw gateway's TTS endpoint (OpenAI-compatible `audio.speech` API).

**Requires:** OpenClaw gateway running at `localhost:18789`.

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | Yes | The text to synthesize |
| `voice` | `string` | No | Voice identifier. Defaults to `"alloy"` |

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `audio/mpeg` | Raw MP3 audio bytes |
| 400 | `application/json` | `{ "error": "Missing or invalid \"text\" field" }` |
| 500 | `application/json` | `{ "error": "TTS failed. Make sure OpenClaw gateway is running." }` |

The `Content-Length` header is set on successful responses.

#### Example

```bash
curl -X POST http://localhost:3000/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello from Jarvis", "voice": "alloy"}' \
  --output speech.mp3
```

```js
const res = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello from Jarvis', voice: 'nova' })
})
const audioBlob = await res.blob()
const audioUrl = URL.createObjectURL(audioBlob)
```

---

### POST `/api/transcribe`

Transcribes audio to text using the OpenClaw gateway's Whisper endpoint (OpenAI-compatible `audio.transcriptions` API).

**Requires:** OpenClaw gateway running at `localhost:18789`.

#### Request Body

Multipart form data (`multipart/form-data`).

| Field | Type | Required | Description |
|---|---|---|---|
| `audio` | `File` | Yes | Audio file (webm, mp4, wav, etc.) |

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `{ "text": string }` |
| 400 | `application/json` | `{ "error": "Expected multipart form data" }` or `{ "error": "Missing audio file" }` |
| 500 | `application/json` | `{ "error": "Transcription failed. Check OpenClaw gateway." }` |

#### Example

```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F 'audio=@recording.webm'
```

```js
const formData = new FormData()
formData.append('audio', audioBlob, 'recording.webm')

const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
const { text } = await res.json()
// text => "Hello, what are the latest metrics?"
```

---

### POST `/api/kanban/chat/[id]`

Send a chat message to an agent in the context of a kanban ticket. Similar to the main chat route but includes ticket context in the system prompt. Text-only (no vision pipeline).

**Requires:** OpenClaw gateway running at `localhost:18789`.

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Agent ID (must match a registered agent) |

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | `KanbanMessage[]` | Yes | Conversation history |
| `ticket` | `Ticket` | No | Ticket context to include in the system prompt |

**`KanbanMessage` schema:**

| Field | Type | Description |
|---|---|---|
| `role` | `"user" \| "assistant"` | Message role |
| `content` | `string` | Message text |

**`Ticket` schema:**

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Ticket title |
| `description` | `string` | Ticket description |
| `status` | `string` | Current status |
| `priority` | `string` | Priority level |
| `assigneeRole` | `string \| null` | Role of the assigned agent |
| `workResult` | `string \| null` | Previous work output (included in prompt so the agent can reference it) |

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `text/event-stream` | SSE stream (same format as `/api/chat/[id]`) |
| 400 | `application/json` | `{ "error": string }` -- invalid JSON or messages not an array |
| 404 | `application/json` | `{ "error": "Agent not found" }` |
| 500 | `application/json` | `{ "error": "Chat failed. Make sure OpenClaw gateway is running." }` |

SSE format is identical to the main chat route's text pipeline:

```
data: {"content":"I see this ticket is about..."}

data: {"content":" the daily digest."}

data: [DONE]
```

#### Example

```js
const res = await fetch('/api/kanban/chat/pulse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What is the status of this ticket?' }
    ],
    ticket: {
      title: 'Fix daily digest formatting',
      description: 'The email digest has broken HTML in the header.',
      status: 'in-progress',
      priority: 'high',
      assigneeRole: 'pulse',
      workResult: null
    }
  })
})
```

---

### GET `/api/kanban/chat-history/[ticketId]`

Retrieve the persisted chat history for a kanban ticket.

**Data source:** Reads from `$WORKSPACE_PATH/../kanban/chats/{ticketId}.jsonl` on the filesystem.

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `ticketId` | `string` | Ticket identifier |

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `StoredChatMessage[]` (sorted oldest-first) |
| 500 | `application/json` | `{ "error": string }` |

Returns an empty array `[]` if no chat history file exists for the ticket.

**`StoredChatMessage` schema:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique message identifier |
| `role` | `"user" \| "assistant"` | Message role |
| `content` | `string` | Message text |
| `timestamp` | `number` | Unix timestamp (milliseconds) |

#### Example

```bash
curl http://localhost:3000/api/kanban/chat-history/ticket-abc-123
```

---

### POST `/api/kanban/chat-history/[ticketId]`

Append chat messages to the persisted history for a kanban ticket. Creates the chats directory and JSONL file if they do not exist.

**Data source:** Appends to `$WORKSPACE_PATH/../kanban/chats/{ticketId}.jsonl` on the filesystem.

#### Path Parameters

| Param | Type | Description |
|---|---|---|
| `ticketId` | `string` | Ticket identifier |

#### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | `StoredChatMessage[]` | Yes | Messages to append (must be a non-empty array) |

See `StoredChatMessage` schema in the GET endpoint above.

#### Response

| Status | Content-Type | Body |
|---|---|---|
| 200 | `application/json` | `{ "ok": true }` |
| 400 | `application/json` | `{ "error": "messages array required" }` |
| 500 | `application/json` | `{ "error": string }` |

#### Example

```js
await fetch('/api/kanban/chat-history/ticket-abc-123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { id: 'msg-1', role: 'user', content: 'Can you look into this?', timestamp: 1709400000000 },
      { id: 'msg-2', role: 'assistant', content: 'On it.', timestamp: 1709400005000 }
    ]
  })
})
```

---

## Route Summary

| Method | Endpoint | Gateway Required | Data Source | Content-Type |
|---|---|---|---|---|
| GET | `/api/agents` | No | Filesystem (JSON + SOUL.md) | `application/json` |
| POST | `/api/chat/[id]` | Yes | Gateway (streaming) or CLI (vision) | `text/event-stream` |
| GET | `/api/crons` | No | CLI (`openclaw cron list`) | `application/json` |
| GET | `/api/cron-runs` | No | Filesystem (JSONL) | `application/json` |
| GET | `/api/memory` | No | Filesystem (Markdown/JSON) | `application/json` |
| POST | `/api/tts` | Yes | Gateway (`audio.speech`) | `audio/mpeg` |
| POST | `/api/transcribe` | Yes | Gateway (`audio.transcriptions`) | `application/json` |
| POST | `/api/kanban/chat/[id]` | Yes | Gateway (streaming) | `text/event-stream` |
| GET | `/api/kanban/chat-history/[ticketId]` | No | Filesystem (JSONL) | `application/json` |
| POST | `/api/kanban/chat-history/[ticketId]` | No | Filesystem (JSONL) | `application/json` |

## SSE Stream Protocol

All streaming chat endpoints (`/api/chat/[id]` and `/api/kanban/chat/[id]`) use the same Server-Sent Events protocol:

1. Each data frame is a JSON object: `data: {"content":"token text"}\n\n`
2. The stream terminates with: `data: [DONE]\n\n`
3. Content-Type is `text/event-stream` with `Cache-Control: no-cache` and `Connection: keep-alive`.
4. If a stream error occurs mid-response, the server sends `[DONE]` and closes the connection (no error frame is sent).

### Client-side consumption pattern

```js
async function readStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

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
  }

  return fullText
}
```
