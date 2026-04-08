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
  InfoCard,
} from "./DocSection";

export function BestPracticesSection() {
  return (
    <>
      <Heading>Best Practices</Heading>
      <Paragraph>
        This guide covers the patterns and conventions behind a production agent
        team. Every example uses real agents from the bundled registry so you can
        see exactly how hierarchy, memory, tools, and crons come together.
      </Paragraph>

      {/* ─── Hierarchy ──────────────────────────────────────── */}

      <SubHeading>Hierarchy Design</SubHeading>
      <Paragraph>
        A well-structured agent team follows a clear chain of command. The
        pattern is: one orchestrator at the top, team leads in the middle, and
        specialist leaf agents at the bottom. Each level has a distinct
        responsibility.
      </Paragraph>

      <InfoCard title="The Three Tiers">
        <Table
          headers={["Tier", "Role", "Example"]}
          rows={[
            [
              "Orchestrator",
              "Top-level coordinator. Holds team memory, routes work, delivers briefings.",
              <><strong key="j">Jarvis</strong> -- the root node. reportsTo: null.</>,
            ],
            [
              "Team Lead",
              "Owns a domain. Manages a sub-team and runs pipelines end-to-end.",
              <>
                <strong key="v">VERA</strong> (Strategy),{" "}
                <strong key="l">LUMEN</strong> (SEO),{" "}
                <strong key="h">HERALD</strong> (LinkedIn)
              </>,
            ],
            [
              "Specialist",
              "Does one thing well. Reports up, never manages others.",
              <>
                <strong key="t">TRACE</strong> (Market Research),{" "}
                <strong key="q">QUILL</strong> (LinkedIn Writer),{" "}
                <strong key="s">SCOUT</strong> (Content Scout)
              </>,
            ],
          ]}
        />
      </InfoCard>

      <Paragraph>
        The bundled registry ships 22 agents organized into five teams:
      </Paragraph>

      <CodeBlock title="Team Structure">
        {`Jarvis (Orchestrator)
  |
  +-- VERA (Strategy)
  |     +-- Robin (Field Intel)
  |           +-- TRACE (Market Research)
  |           +-- PROOF (Validation Design)
  |
  +-- LUMEN (SEO)
  |     +-- SCOUT (Content Scout)
  |     +-- ANALYST (SEO Analyst)
  |     +-- STRATEGIST (Content Strategy)
  |     +-- WRITER (Content Writer)
  |     +-- AUDITOR (Quality Gate)
  |
  +-- HERALD (LinkedIn)
  |     +-- QUILL (LinkedIn Writer)
  |     +-- MAVEN (LinkedIn Strategist)
  |
  +-- Pulse (Trend Radar)      -- standalone
  +-- ECHO (Community Voice)   -- standalone
  +-- SAGE (ICP Expert)        -- standalone
  +-- KAZE (Flight Monitor)    -- standalone
  +-- SPARK (Tech Discovery)   -- standalone
  +-- SCRIBE (Memory Architect)-- standalone`}
      </CodeBlock>

      <Callout type="tip">
        Standalone agents (no direct reports) report directly to the
        orchestrator. Keep this list short -- if you have more than 8-10 direct
        reports on the root node, it's time to group them under a team lead.
      </Callout>

      <SubHeading>Hierarchy Rules</SubHeading>
      <NumberedList
        items={[
          <>
            <strong>One root.</strong> Exactly one agent has{" "}
            <InlineCode>{"\"reportsTo\": null"}</InlineCode>. This is your
            orchestrator (Jarvis).
          </>,
          <>
            <strong>Team leads own pipelines.</strong> LUMEN owns the full SEO
            pipeline (SCOUT to AUDITOR). HERALD owns the LinkedIn pipeline
            (QUILL + MAVEN). Each lead is responsible for end-to-end delivery.
          </>,
          <>
            <strong>Leaf agents are specialists.</strong> They do one thing and
            report up. TRACE does market research. QUILL writes posts. AUDITOR
            runs the quality gate. No scope creep.
          </>,
          <>
            <strong>Max depth of 3.</strong> Jarvis to Robin to TRACE is
            three levels. Going deeper adds latency and coordination overhead
            with little benefit.
          </>,
          <>
            <strong>Keep directReports consistent.</strong> If agent B has{" "}
            <InlineCode>{"\"reportsTo\": \"A\""}</InlineCode>, then agent A's
            directReports array must include B's id. The Org Map renders from
            these relationships.
          </>,
        ]}
      />

      {/* ─── SOUL.md ────────────────────────────────────────── */}

      <SubHeading>SOUL.md -- Agent Character Documents</SubHeading>
      <Paragraph>
        Every agent has a SOUL.md file that defines its personality, expertise,
        and operating constraints. This is not a system prompt -- it's a
        character document. The agent reads it to understand who it is.
      </Paragraph>

      <CodeBlock title="Recommended SOUL.md Structure">
        {`# AGENT_NAME -- Role Title

## Identity
Who the agent is. Personality traits. Communication style.
First-person voice: "I am VERA, the Chief Strategy Officer."

## Expertise
What domains this agent knows deeply.
What it should be consulted on vs. what it defers.

## Operating Rules
Hard constraints. What it must always/never do.
Output format requirements.

## Relationships
Who it reports to. Who reports to it.
How it collaborates with peer agents.

## Memory
What it remembers between sessions.
Where its persistent knowledge lives.`}
      </CodeBlock>

      <BulletList
        items={[
          <>
            <strong>Be specific about personality.</strong> HERALD is described
            as brash and direct. SAGE is contemplative and precise. Distinct
            voices prevent all agents from sounding the same.
          </>,
          <>
            <strong>Define what the agent does NOT do.</strong> SCRIBE (Memory
            Architect) is a "silent worker" -- it never initiates conversation.
            SAGE (ICP Expert) is read-only -- it never writes to external
            systems.
          </>,
          <>
            <strong>Include output format examples.</strong> If the agent
            produces Market Briefs, show the exact format. TRACE returns
            structured TAM/competitor/pricing data, not prose.
          </>,
          <>
            <strong>Keep it under 500 lines.</strong> Long SOUL files dilute
            the agent's focus. If you need more detail, link to reference docs.
          </>,
        ]}
      />

      <Callout type="note">
        SOUL.md files live in your OpenClaw workspace at the path defined by
        each agent's <InlineCode>soulPath</InlineCode> field. ClawPort reads
        and displays them on the agent detail page.
      </Callout>

      {/* ─── Naming ─────────────────────────────────────────── */}

      <SubHeading>Naming Conventions</SubHeading>
      <Paragraph>
        Agent naming follows a simple pattern that signals the agent's scope
        at a glance:
      </Paragraph>

      <Table
        headers={["Pattern", "When to Use", "Examples"]}
        rows={[
          [
            "UPPERCASE",
            "Agents that are part of a pipeline or team. Feels like a callsign.",
            "VERA, LUMEN, HERALD, SCOUT, QUILL, ECHO, SAGE",
          ],
          [
            "Title Case",
            "Standalone agents with more personality. The orchestrator or personal-feeling agents.",
            "Jarvis, Robin, Pulse",
          ],
        ]}
      />

      <Paragraph>
        Ids are always lowercase slugs:{" "}
        <InlineCode>vera</InlineCode>,{" "}
        <InlineCode>lumen</InlineCode>,{" "}
        <InlineCode>herald</InlineCode>. The display name in the{" "}
        <InlineCode>name</InlineCode> field is what users see in the UI.
      </Paragraph>

      {/* ─── Tools ──────────────────────────────────────────── */}

      <SubHeading>Tool Assignment</SubHeading>
      <Paragraph>
        Follow the principle of least privilege. Each agent gets only the tools
        it needs for its job -- nothing more.
      </Paragraph>

      <Table
        headers={["Tool", "Purpose", "Who Gets It"]}
        rows={[
          [
            <InlineCode key="r">read</InlineCode>,
            "Read files from workspace",
            "Almost everyone. The base capability.",
          ],
          [
            <InlineCode key="w">write</InlineCode>,
            "Write/create files",
            "Agents that produce artifacts (WRITER, ANALYST, STRATEGIST)",
          ],
          [
            <InlineCode key="e">exec</InlineCode>,
            "Run shell commands",
            "Orchestrator + leads who run pipelines (Jarvis, LUMEN, HERALD)",
          ],
          [
            <InlineCode key="ws">web_search</InlineCode>,
            "Search the web",
            "Research agents (TRACE, Robin, SCOUT, Pulse, SPARK)",
          ],
          [
            <InlineCode key="wf">web_fetch</InlineCode>,
            "Fetch a specific URL",
            "Agents that scrape or monitor (ECHO, KAZE, Robin)",
          ],
          [
            <InlineCode key="m">message</InlineCode>,
            "Send messages to other agents",
            "Agents that coordinate (Jarvis, Robin, Pulse, HERALD)",
          ],
          [
            <InlineCode key="ss">sessions_spawn</InlineCode>,
            "Spawn sub-agent sessions",
            "Only orchestrator + team leads (Jarvis, VERA)",
          ],
          [
            <InlineCode key="ms">memory_search</InlineCode>,
            "Search across team memory",
            "Orchestrator only (Jarvis)",
          ],
          [
            <InlineCode key="tt">tts</InlineCode>,
            "Text-to-speech",
            "Orchestrator only (Jarvis)",
          ],
        ]}
      />

      <Callout type="warning">
        Giving <InlineCode>exec</InlineCode> to a leaf agent is almost always
        a mistake. If a specialist needs to run a command, it should ask its
        team lead to do it. This keeps the blast radius small.
      </Callout>

      <InfoCard title="Tool Assignment Examples">
        <CodeBlock>
          {`// SAGE -- read-only knowledge agent
"tools": ["read"]

// SCOUT -- web researcher
"tools": ["web_search", "web_fetch", "read"]

// WRITER -- content producer
"tools": ["read", "write"]

// HERALD -- team lead running a pipeline
"tools": ["web_search", "web_fetch", "read", "write", "message", "exec"]

// Jarvis -- orchestrator with full access
"tools": ["exec", "read", "write", "edit", "web_search", "tts", "message", "sessions_spawn", "memory_search"]`}
        </CodeBlock>
      </InfoCard>

      {/* ─── Memory ─────────────────────────────────────────── */}

      <SubHeading>Memory Architecture</SubHeading>
      <Paragraph>
        Agent memory uses a three-tier system. Each tier serves a different
        purpose, and together they give agents both short-term recall and
        long-term knowledge.
      </Paragraph>

      <InfoCard title="The Three Memory Tiers">
        <Table
          headers={["Tier", "What", "Lifespan", "Who Manages"]}
          rows={[
            [
              "1. Daily Logs",
              "Raw output from each agent session. Unedited, timestamped.",
              "7-14 days (then compressed or archived)",
              "Each agent writes its own",
            ],
            [
              "2. MEMORY.md",
              "Curated, compressed knowledge. The agent's persistent brain.",
              "Indefinite (updated weekly)",
              <>
                <strong>SCRIBE</strong> runs weekly compression
              </>,
            ],
            [
              "3. Team Memory",
              "Shared knowledge across agents. Market data, ICP profiles, strategy docs.",
              "Indefinite",
              "Team leads + orchestrator",
            ],
          ]}
        />
      </InfoCard>

      <SubHeading>Tier 1: Daily Logs</SubHeading>
      <Paragraph>
        Every time an agent runs, it writes a log file. These are the raw
        session transcripts -- what the agent did, what it found, what it
        produced. Daily logs are high-volume and low-curation.
      </Paragraph>
      <CodeBlock title="Daily log path pattern">
        {`$WORKSPACE_PATH/agents/<agent-id>/logs/YYYY-MM-DD.md`}
      </CodeBlock>

      <SubHeading>Tier 2: MEMORY.md</SubHeading>
      <Paragraph>
        Each agent has a MEMORY.md file that persists its key knowledge between
        sessions. Unlike daily logs (which are raw), MEMORY.md is curated --
        only the important patterns, decisions, and facts survive.
      </Paragraph>
      <CodeBlock title="MEMORY.md structure">
        {`# Agent Name -- Memory

## Key Patterns
- Pattern 1 confirmed across 3+ sessions
- Pattern 2 from last week's research

## Active Context
- Current project status
- Open questions / blockers

## Learned Preferences
- User prefers X over Y
- Always include Z in output`}
      </CodeBlock>
      <Paragraph>
        <strong>SCRIBE</strong> (Memory Architect) runs weekly to compress daily
        logs into each agent's MEMORY.md. SCRIBE reads the raw logs, extracts
        durable insights, and updates the memory file -- discarding
        session-specific noise. This keeps MEMORY.md concise and high-signal.
      </Paragraph>

      <SubHeading>Tier 3: Team Memory (Shared)</SubHeading>
      <Paragraph>
        Some knowledge needs to be shared across agents. Market intelligence,
        ICP profiles, competitive analysis, and brand voice docs all live in a
        shared team-memory directory. Any agent with{" "}
        <InlineCode>read</InlineCode> access to the workspace can reference
        these files.
      </Paragraph>
      <CodeBlock title="Team memory path">
        {`$WORKSPACE_PATH/team-memory/
  market-brief.md       -- TRACE's latest research
  icp-profile.md        -- SAGE's ICP knowledge
  competitor-map.md     -- Robin's competitive intel
  brand-voice.md        -- Voice profile for content agents
  content-calendar.md   -- MAVEN's editorial calendar`}
      </CodeBlock>

      <Callout type="tip">
        Team memory files are the glue between agents. When STRATEGIST needs
        market context, it reads TRACE's market brief. When WRITER needs brand
        voice, it reads the voice profile. No agent-to-agent API calls needed
        -- just shared files.
      </Callout>

      {/* ─── Communication ──────────────────────────────────── */}

      <SubHeading>Agent Communication</SubHeading>
      <Paragraph>
        Agents communicate through files, not direct API calls. This is
        intentional -- file-based communication is debuggable, auditable, and
        doesn't create tight coupling.
      </Paragraph>

      <NumberedList
        items={[
          <>
            <strong>Upstream (reporting up):</strong> An agent writes its output
            to a file. The team lead or orchestrator reads it on the next run.
            Example: SCOUT writes topic suggestions, LUMEN reads them to
            brief STRATEGIST.
          </>,
          <>
            <strong>Downstream (delegating):</strong> A team lead writes a
            brief file that the specialist reads. Example: HERALD writes an
            angle brief, QUILL reads it and drafts the post.
          </>,
          <>
            <strong>Cross-team (shared context):</strong> Agents read from
            team-memory. Example: STRATEGIST reads SAGE's ICP profile and
            ECHO's community voice data to pick the right content angle.
          </>,
        ]}
      />

      <Callout type="note">
        The <InlineCode>message</InlineCode> tool exists for real-time
        coordination (e.g., Pulse alerting LUMEN about a trending topic), but
        the default communication channel is always files. Messages are for
        urgency; files are for substance.
      </Callout>

      {/* ─── Crons ──────────────────────────────────────────── */}

      <SubHeading>Cron Patterns</SubHeading>
      <Paragraph>
        Cron jobs are the heartbeat of an autonomous agent team. Each cron
        follows the same philosophy: one fetch, one decision, one output.
      </Paragraph>

      <BulletList
        items={[
          <>
            <strong>Assign crons to the right tier.</strong> Research crons go
            on leaf agents (SCOUT, TRACE, ECHO). Pipeline crons go on team
            leads (LUMEN, HERALD). Briefing crons go on the orchestrator
            (Jarvis).
          </>,
          <>
            <strong>Stagger schedules.</strong> Don't run all crons at the same
            time. Space them out so upstream agents finish before downstream
            agents read their output.
          </>,
          <>
            <strong>Keep crons focused.</strong> Each cron does one thing.
            "Scan subreddits" is a good cron. "Scan subreddits, analyze
            sentiment, write a blog post, and publish" is four crons pretending
            to be one.
          </>,
          <>
            <strong>Error isolation.</strong> If a cron fails, it should only
            affect its own output. Other agents reading stale data is better
            than a cascade failure.
          </>,
        ]}
      />

      <Table
        headers={["Cron", "Agent", "Schedule", "Pattern"]}
        rows={[
          [
            "Community scan",
            <strong key="e">ECHO</strong>,
            "Weekly",
            "Fetch subreddit posts, extract customer language, write to team-memory",
          ],
          [
            "Trend radar",
            <strong key="p">Pulse</strong>,
            "Every other day",
            "Scan trending signals, write hot topics file, message LUMEN if urgent",
          ],
          [
            "Flight monitor",
            <strong key="k">KAZE</strong>,
            "Daily",
            "Check flight prices, message Jarvis if deal found under threshold",
          ],
          [
            "Memory compression",
            <strong key="s">SCRIBE</strong>,
            "Weekly",
            "Read daily logs, compress into MEMORY.md, archive old logs",
          ],
          [
            "Content pipeline",
            <strong key="l">LUMEN</strong>,
            "Weekly",
            "Orchestrate SCOUT -> ANALYST -> STRATEGIST -> WRITER -> AUDITOR",
          ],
        ]}
      />

      {/* ─── Voice ──────────────────────────────────────────── */}

      <SubHeading>Voice System</SubHeading>
      <Paragraph>
        Agents that interact directly with the operator can have an ElevenLabs
        voice ID assigned. This enables text-to-speech on their responses in
        the chat interface. Not every agent needs a voice -- only those the
        operator talks to regularly.
      </Paragraph>

      <BulletList
        items={[
          <>
            <strong>Give voices to conversational agents.</strong> Jarvis
            (orchestrator), VERA (strategy advisor), Pulse (trend alerts) --
            agents you chat with benefit from voice.
          </>,
          <>
            <strong>Skip voices for pipeline workers.</strong> SCOUT, ANALYST,
            WRITER, AUDITOR run in pipelines and rarely need to speak. Don't
            waste voice slots on them.
          </>,
          <>
            Set <InlineCode>voiceId</InlineCode> to{" "}
            <InlineCode>null</InlineCode> for agents without voice. The UI
            hides the TTS button when voiceId is null.
          </>,
        ]}
      />

      {/* ─── Design Principles ──────────────────────────────── */}

      <SubHeading>Design Principles</SubHeading>

      <InfoCard title="1. Agents are characters, not functions">
        <Paragraph>
          Each agent has a name, a personality, and a role title. They're not
          interchangeable worker threads -- they're team members with distinct
          expertise. VERA thinks strategically. ECHO listens to communities.
          KAZE watches flights. This makes the team legible and memorable.
        </Paragraph>
      </InfoCard>

      <InfoCard title="2. Least privilege, always">
        <Paragraph>
          An agent should have exactly the tools it needs and nothing more. SAGE
          is read-only because it's a knowledge base, not an actor. SCRIBE has{" "}
          <InlineCode>exec</InlineCode> because it needs to run file operations
          during memory compression. If you're unsure whether an agent needs a
          tool, start without it. You can always add it later.
        </Paragraph>
      </InfoCard>

      <InfoCard title="3. Files over messages">
        <Paragraph>
          Prefer file-based communication over real-time messages. Files are
          inspectable, diffable, and persist across sessions. Messages are for
          urgent signals only (e.g., Pulse alerting about a breaking trend).
          Everything else goes through shared files in team-memory.
        </Paragraph>
      </InfoCard>

      <InfoCard title="4. One agent, one job">
        <Paragraph>
          Resist the urge to make Swiss Army knife agents. TRACE does market
          research -- it doesn't also write blog posts. QUILL writes LinkedIn
          posts -- it doesn't also analyze metrics. When an agent's description
          needs the word "and" more than once, split it into two agents.
        </Paragraph>
      </InfoCard>

      <InfoCard title="5. Depth of 3, max">
        <Paragraph>
          Jarvis to Robin to TRACE is three levels. Going deeper adds latency
          and makes the chain of command confusing. If you need more
          specialization, add lateral agents (more direct reports) instead of
          deeper nesting.
        </Paragraph>
      </InfoCard>

      <InfoCard title="6. Let SCRIBE handle memory">
        <Paragraph>
          Don't make every agent manage its own memory compression. SCRIBE
          exists specifically to read daily logs, extract patterns, and update
          MEMORY.md files. This single responsibility keeps memory consistent
          and prevents agents from spending cycles on housekeeping instead of
          their actual job.
        </Paragraph>
      </InfoCard>
    </>
  );
}
