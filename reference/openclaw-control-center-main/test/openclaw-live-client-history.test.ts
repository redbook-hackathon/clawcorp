import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { OpenClawLiveClient } from "../src/clients/openclaw-live-client";

function attachSessionFile(client: OpenClawLiveClient, sessionKey: string, sessionFile: string): void {
  const internalClient = client as OpenClawLiveClient & {
    sessionCache: Map<string, { sessionFile?: string }>;
  };
  internalClient.sessionCache.set(sessionKey, { sessionFile });
}

async function installFakeOpenClawCli(tempDir: string, logPath: string, stdout: string): Promise<string> {
  const binDir = join(tempDir, "bin");
  await mkdir(binDir, { recursive: true });

  const runnerPath = join(binDir, "openclaw-runner.js");
  await writeFile(
    runnerPath,
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      `fs.appendFileSync(${JSON.stringify(logPath)}, process.argv.slice(2).join(' ') + '\\n');`,
      `process.stdout.write(${JSON.stringify(stdout)});`,
    ].join("\n"),
    "utf8",
  );
  await chmod(runnerPath, 0o755);

  const unixShimPath = join(binDir, "openclaw");
  await writeFile(unixShimPath, await readFile(runnerPath, "utf8"), "utf8");
  await chmod(unixShimPath, 0o755);

  const windowsShimPath = join(binDir, "openclaw.cmd");
  await writeFile(
    windowsShimPath,
    `@echo off\r\n"${process.execPath}" "${runnerPath}" %*\r\n`,
    "utf8",
  );

  return binDir;
}

test("sessionsHistory reads recent history from large cached session files", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "openclaw-history-"));
  try {
    const sessionKey = "agent:main:cron:demo:run:child";
    const sessionFile = join(tempDir, "session.jsonl");
    const payload = "x".repeat(2048);
    const lines = Array.from({ length: 120 }, (_, index) =>
      JSON.stringify({ seq: index + 1, message: `entry-${index + 1}`, payload }),
    );
    await writeFile(sessionFile, `${lines.join("\n")}\n`, "utf8");

    const client = new OpenClawLiveClient();
    attachSessionFile(client, sessionKey, sessionFile);

    const response = await client.sessionsHistory({ sessionKey, limit: 3 });
    const history = Array.isArray(response.json?.history) ? response.json.history : [];

    assert.deepEqual(
      history.map((item) => (typeof item === "string" ? item : item.seq)),
      [118, 119, 120],
    );
    assert.match(response.rawText, /"seq":118/);
    assert.match(response.rawText, /"seq":120/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("sessionsHistory keeps the last line when the history file has no trailing newline", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "openclaw-history-"));
  try {
    const sessionKey = "agent:coq:main";
    const sessionFile = join(tempDir, "session.jsonl");
    const lines = [
      JSON.stringify({ seq: 1, message: "first" }),
      JSON.stringify({ seq: 2, message: "second" }),
      JSON.stringify({ seq: 3, message: "third" }),
    ];
    await writeFile(sessionFile, lines.join("\n"), "utf8");

    const client = new OpenClawLiveClient();
    attachSessionFile(client, sessionKey, sessionFile);

    const response = await client.sessionsHistory({ sessionKey, limit: 2 });
    const history = Array.isArray(response.json?.history) ? response.json.history : [];

    assert.deepEqual(
      history.map((item) => (typeof item === "string" ? item : item.seq)),
      [2, 3],
    );
    assert.equal(response.rawText.trim().split("\n").length, 2);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("sessionsHistory uses bounded CLI recovery when a cached session file path is stale", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "openclaw-history-"));
  const originalPath = process.env.PATH;
  try {
    const sessionKey = "agent:main:demo";
    const cliLogPath = join(tempDir, "cli.log");
    const binDir = await installFakeOpenClawCli(
      tempDir,
      cliLogPath,
      JSON.stringify({
        history: [{ kind: "message", role: "assistant", content: "from-cli", timestamp: "2026-03-16T12:00:00.000Z" }],
      }),
    );
    process.env.PATH = `${binDir}${delimiter}${originalPath ?? ""}`;

    const client = new OpenClawLiveClient();
    attachSessionFile(client, sessionKey, join(tempDir, "missing-session.jsonl"));

    const response = await client.sessionsHistory({ sessionKey, limit: 2 });
    const history = Array.isArray(response.json?.history) ? response.json.history : [];

    assert.deepEqual(
      history.map((item) => (typeof item === "string" ? item : item.content)),
      ["from-cli"],
    );
    const cliLog = await readFile(cliLogPath, "utf8");
    assert.match(cliLog, new RegExp(`sessions history ${sessionKey}`));
  } finally {
    process.env.PATH = originalPath;
    await rm(tempDir, { recursive: true, force: true });
  }
});
