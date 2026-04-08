import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  Callout,
} from "./DocSection";

export function CronSystemSection() {
  return (
    <>
      <Heading>Cron System</Heading>
      <Paragraph>
        ClawPort provides a full cron monitoring dashboard with three views:
        overview (health donut, attention cards, error banners), weekly schedule
        (7-day calendar grid), and pipeline graph (React Flow dependency
        visualization). Data is fetched from the OpenClaw CLI and auto-refreshes
        every 60 seconds.
      </Paragraph>

      <SubHeading>CronJob Schema</SubHeading>
      <Table
        headers={["Field", "Type", "Description"]}
        rows={[
          [<InlineCode key="id">id</InlineCode>, "string", "Job identifier"],
          [
            <InlineCode key="n">name</InlineCode>,
            "string",
            "Job name (used to match owning agent by prefix)",
          ],
          [
            <InlineCode key="s">schedule</InlineCode>,
            "string",
            "Raw cron expression",
          ],
          [
            <InlineCode key="sd">scheduleDescription</InlineCode>,
            "string",
            'Human-readable (e.g., "Daily at 8 AM")',
          ],
          [
            <InlineCode key="tz">timezone</InlineCode>,
            "string | null",
            "Timezone from schedule object, if present",
          ],
          [
            <InlineCode key="st">status</InlineCode>,
            '"ok" | "error" | "idle"',
            "Last run outcome",
          ],
          [
            <InlineCode key="lr">lastRun</InlineCode>,
            "string | null",
            "ISO 8601 timestamp of last execution",
          ],
          [
            <InlineCode key="nr">nextRun</InlineCode>,
            "string | null",
            "ISO 8601 timestamp of next scheduled run",
          ],
          [
            <InlineCode key="le">lastError</InlineCode>,
            "string | null",
            "Error message from last failed run",
          ],
          [
            <InlineCode key="ai">agentId</InlineCode>,
            "string | null",
            "Owning agent ID (matched by job name prefix)",
          ],
          [
            <InlineCode key="en">enabled</InlineCode>,
            "boolean",
            "Whether the job is active",
          ],
          [
            <InlineCode key="dl">delivery</InlineCode>,
            "CronDelivery | null",
            "Delivery config (mode, channel, to)",
          ],
          [
            <InlineCode key="ld">lastDurationMs</InlineCode>,
            "number | null",
            "Duration of last run in milliseconds",
          ],
          [
            <InlineCode key="ce">consecutiveErrors</InlineCode>,
            "number",
            "Count of consecutive failed runs",
          ],
        ]}
      />

      <SubHeading>CronRun Schema</SubHeading>
      <Paragraph>
        Run history is parsed from JSONL log files at{" "}
        <InlineCode>$WORKSPACE_PATH/../cron/runs/</InlineCode>. Each line in the
        JSONL file represents one run.
      </Paragraph>
      <Table
        headers={["Field", "Type", "Description"]}
        rows={[
          [
            <InlineCode key="ts">ts</InlineCode>,
            "number",
            "Unix timestamp (milliseconds) of the run",
          ],
          [
            <InlineCode key="j">jobId</InlineCode>,
            "string",
            "Job identifier",
          ],
          [
            <InlineCode key="s">status</InlineCode>,
            '"ok" | "error"',
            "Run outcome",
          ],
          [
            <InlineCode key="su">summary</InlineCode>,
            "string | null",
            "Summary of what the run produced",
          ],
          [
            <InlineCode key="e">error</InlineCode>,
            "string | null",
            "Error message if the run failed",
          ],
          [
            <InlineCode key="d">durationMs</InlineCode>,
            "number",
            "Duration in milliseconds",
          ],
          [
            <InlineCode key="ds">deliveryStatus</InlineCode>,
            "string | null",
            "Delivery outcome",
          ],
        ]}
      />

      <SubHeading>Agent Ownership</SubHeading>
      <Paragraph>
        Cron jobs are matched to agents by job name prefix. When the API fetches
        crons via <InlineCode>openclaw cron list --json</InlineCode>, it
        enriches each job with an <InlineCode>agentId</InlineCode> field by
        checking whether the job name starts with an agent's id. This enables
        the UI to show agent avatars next to cron entries and filter crons by
        agent.
      </Paragraph>

      <SubHeading>Delivery Configuration</SubHeading>
      <Table
        headers={["Field", "Type", "Description"]}
        rows={[
          [
            <InlineCode key="m">mode</InlineCode>,
            "string",
            "Delivery mode",
          ],
          [
            <InlineCode key="c">channel</InlineCode>,
            "string",
            "Delivery channel",
          ],
          [
            <InlineCode key="t">to</InlineCode>,
            "string | null",
            "Delivery recipient",
          ],
        ]}
      />

      <SubHeading>Status Types</SubHeading>
      <BulletList
        items={[
          <>
            <strong style={{ color: "var(--system-green)" }}>ok</strong> -- Last
            run completed successfully
          </>,
          <>
            <strong style={{ color: "var(--system-red)" }}>error</strong> -- Last
            run failed (error details in lastError)
          </>,
          <>
            <strong style={{ color: "var(--text-tertiary)" }}>idle</strong> --
            Job has never run or has no recent activity
          </>,
        ]}
      />

      <SubHeading>Monitoring Views</SubHeading>
      <BulletList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>Overview</strong>{" "}
            -- Health donut chart (SVG), attention-needed cards for errored
            crons, delivery stats, error banners with expandable details, recent
            runs list
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>Schedule</strong>{" "}
            -- Seven-day calendar grid showing when cron jobs are scheduled to
            run. Current time indicator as a red horizontal line.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>Pipelines</strong>{" "}
            -- React Flow visualization of cron job pipelines showing
            dependencies between stages
          </>,
        ]}
      />

      <Callout type="note">
        The cron page auto-refreshes every 60 seconds. The sidebar also fetches
        cron error counts on mount and displays a red pulsing dot badge when
        errors are present.
      </Callout>

      <SubHeading>API Endpoint</SubHeading>
      <CodeBlock title="terminal">
        {`# Fetch all crons
curl http://localhost:3000/api/crons

# Fetch run history for a specific job
curl "http://localhost:3000/api/cron-runs?jobId=pulse-daily-digest"

# Fetch all run history
curl http://localhost:3000/api/cron-runs`}
      </CodeBlock>
    </>
  );
}
