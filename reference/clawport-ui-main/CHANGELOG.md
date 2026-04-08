# Changelog

All notable changes to [clawport-ui](https://www.npmjs.com/package/clawport-ui) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.2] - 2026-03-10

### Changed

- Memory Overview UX rework: replaced 4 equal stat cards with a single HealthHero component (prominent health score + compact stat pills). Moved Memory Advisor to position #2 (right after hero). Pushed timeline below health checks. Removed redundant StaleDailyLogsCard.

### Added

- `vector-search-disabled` health check -- flags when OpenClaw vector search is not enabled, with advisor guidance on setup and indexing.

## [0.8.1] - 2026-03-10

### Added

- Server-side chat persistence with JSONL-based conversation storage. Conversations sync across devices automatically.
- Cross-device onboarding flag, "Synced" indicator in chat header, "Clear Server Data" button in settings.
- 26 new tests for conversation store.

### Contributors

- [@raphfeuer](https://github.com/raphfeuer) (PR #8)

## [0.8.0] - 2026-03-09

### Changed

- Configurable gateway port (auto-detected from OpenClaw config).
- Agent Optimizer redesign with streamlined UI.
- Markdown code blocks in chat now render with syntax highlighting.

## [0.7.0] - 2026-03-08

### Added

- Sidebar usage widget showing token consumption at a glance.
- Cost Dashboard breakup into modular sub-components (OptimizationPanel, DailyCostChart, RunDetailTable, TokenDonut, TopCrons).
- Live logs overhaul with improved stream parsing and UI.
- Claude Code usage tracker.
- Memory v2: health checks, editing hints, reindex API, and AI Memory Advisor with inline chat.
- Pipeline health check with inline agent chat and self-heal actions.
- Cost optimization engine with AI analysis.

## [0.6.4] - 2026-03-07

### Fixed

- Workspace path detection now checks current OpenClaw layout (`~/.openclaw/agents/main/workspace`) before falling back to legacy (`~/.openclaw/workspace`). (#3)
- Cross-origin dev access: added `allowedDevOrigins: ["*"]` to `next.config.mjs` for Tailscale/LAN usage. (#4)

### Changed

- Updated docs (README, SETUP.md, CLAUDE.md) with workspace detection order, global install env fallback, and cross-origin info.

## [0.6.3] - 2026-03-07

### Added

- Slash commands in agent chat: `/clear`, `/help`, `/info`, `/soul`, `/tools`, `/crons`. Client-side only, never sent to gateway.
- Slash command autocomplete dropdown with keyboard navigation.
- 35 new tests for slash commands.

### Changed

- Updated CLAUDE.md with slash command docs and "Add a new slash command" guide.

## [0.6.2] - 2026-03-07

### Added

- ClawPort logo (optimized 256x256 PNG) on sidebar, mobile sidebar, npm page, and GitHub README.

### Changed

- README logo uses absolute GitHub raw URL for npm display.

## [0.6.1] - 2026-03-07

### Fixed

- `crypto.randomUUID()` runtime error in non-secure contexts (HTTP, older browsers). Added `generateId()` fallback utility in `lib/id.ts`, replaced all 10 usages across 5 files. (#1)

### Added

- Global install env fallback: `clawport setup` writes to `~/.config/clawport-ui/.env.local` when package directory is not writable. CLI loads from both locations. (PR #6)

## [0.6.0] - 2026-03-06

### Added

- Activity Console page with historical log browser and summary cards.
- Floating Live Stream widget -- global SSE-powered log viewer that persists across navigation. Three states: hidden, collapsed pill, expanded panel with play/pause, copy, and auto-scroll.
- Expandable log rows: click any row to see the raw JSON payload.
- Memory Guide tab: categorized best practices (Writing, Search, Maintenance) with DO/DON'T pills, responsive 2-column config visualizer grid.
- Cost Dashboard page with daily cost chart, per-job breakdown, model distribution, anomaly detection, week-over-week trends, and cache savings estimation.
- SSE parser library (`lib/sse.ts`) with `parseSSEBuffer()` and `parseSSELine()`.
- Cost analysis library (`lib/costs.ts`) with `computeCostSummary()`, model pricing table, anomaly detection.

### Fixed

- Memory browser file content not visible on desktop (sidebar missing `browser-sidebar` class, consumed full container width).

### Changed

- Activity page no longer has a Feed tab -- live streaming moved to global widget, page renders LogBrowser directly with an "Open Live Stream" button.
- Memory Guide tab now fills full container width (removed `maxWidth: 640` constraint).

## [0.5.5] - 2026-03-05

### Changed

- Documentation overhaul: comprehensive CLAUDE.md, API.md, COMPONENTS.md, THEMING.md.

## [0.5.4] - 2026-03-05

### Added

- Activity Console with live feed and log browser.

## [0.5.3] - 2026-03-05

### Changed

- Added clawport.dev link to README header.

## [0.5.2] - 2026-03-04

### Fixed

- Agent discovery now uses SOUL.md-driven scanning for subdirectory agents, replacing fragile directory-name matching.

## [0.5.1] - 2026-03-03

### Changed

- Rewrote CLI discovery to use real `openclaw agents list` output format.

## [0.5.0] - 2026-03-02

### Added

- CLI-based agent discovery via `openclaw agents list`.
- Dagre-powered org map with team-column layout.

### Fixed

- Deduplicated root agent when `agents/` directory name matches root ID.

## [0.4.6] - 2026-02-28

### Added

- Setup detection module with comprehensive setup scenario tests.

## [0.4.5] - 2026-02-27

### Fixed

- Handle `{ crons, pipelines }` response format in all consumers.

## [0.4.4] - 2026-02-26

### Fixed

- Split cron-pipelines module to avoid `fs` import in client bundle.

## [0.4.3] - 2026-02-25

### Added

- Rebuilt Memory page as 3-tab dashboard with live config viewer.

### Changed

- Documentation: added 405 troubleshooting, auto-discovery info, fixed clone URL.

### Fixed

- Detect and auto-enable gateway HTTP endpoint during setup.
- Rewrote agent auto-discovery to handle all OpenClaw heading formats.

## [0.4.2] - 2026-02-24

### Added

- Auto-discover agents from OpenClaw workspace.
- Kanban board hardening.

### Changed

- Default accent color to red; clarified package vs CLI naming.

## [0.4.1] - 2026-02-23

### Fixed

- Set `turbopack.root` to package directory for global installs.
- Moved Next.js build dependencies to `dependencies` for global installs.
- Converted `next.config.ts` to `next.config.mjs` for global installs.
- Use package-local `next` binary instead of `npx` in CLI.

## [0.2.0] - 2026-02-20

### Added

- CLI entry point (`bin/clawport.mjs`) with `clawport dev`, `clawport setup`, `clawport start`, `clawport status`, and `clawport help` commands.
- Published `clawport-ui` to npm with default lobster emoji.
- MIT LICENSE file and repository URLs for open-source readiness.
- Lucide icons on all action buttons with dynamic accent contrast.
- Onboarding wizard (5-step first-run setup: name, theme, accent, mic, overview).

### Changed

- Rebranded from Agent Claw / Manor UI to ClawPort throughout the codebase.
- Renamed ManorMap component and stripped voice IDs.

## [0.1.3] - 2026-02-17

### Added

- Kanban board with agent automation (V2).

### Changed

- Comprehensive README, CLAUDE.md, and `.env.example` update.

### Removed

- Voice recording and audio playback from chat.

### Fixed

- `sendViaOpenClaw` uses send-then-poll pattern for `chat.send`.
- Image pipeline: resize client-side, use CLI `execFile`, check only latest message.

## [0.1.2] - 2026-02-14

### Added

- Route image messages through OpenClaw `chat.send` pipeline.
- TDD coverage for multimodal, validation, and audio-recorder modules.
- Multimodal chat with vision and file support, plus TTS listen button.
- Voice messages, file attachments, and enhanced media input.

### Fixed

- Use WebSocket for image messages instead of CLI (fixes E2BIG).
- Return plain string for audio-only messages in `buildApiContent`.

## [0.1.1] - 2026-02-11

### Added

- Complete Apple-quality UI/UX remake.
- Security hardening and test infrastructure.
- Messenger-style chat with avatars, name labels, and markdown formatting.
- Full Messenger rebuild with persistent threads, all agents, and media support.
- 5-theme system (Dark, Glass, Color, Light, System) with visible map connectors.

### Fixed

- Removed hardcoded OpenClaw gateway token.
- Chat via OpenClaw gateway using `claude-sonnet-4-6` (no separate API key required).

### Changed

- Apple dark mode full pass: glass chat, line numbers, gold gradients, animated states.

## [0.1.0] - 2026-02-07

### Added

- Initial release.
- Agent org map with React Flow.
- Call box for direct agent chat.
- Cron monitor dashboard.
- Memory browser.
- Next.js 16 App Router with Turbopack.

[0.8.2]: https://github.com/JohnRiceML/clawport-ui/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/JohnRiceML/clawport-ui/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/JohnRiceML/clawport-ui/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/JohnRiceML/clawport-ui/compare/v0.6.4...v0.7.0
[0.6.4]: https://github.com/JohnRiceML/clawport-ui/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/JohnRiceML/clawport-ui/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/JohnRiceML/clawport-ui/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/JohnRiceML/clawport-ui/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.5...v0.6.0
[0.5.5]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/JohnRiceML/clawport-ui/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.6...v0.5.0
[0.4.6]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/JohnRiceML/clawport-ui/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/JohnRiceML/clawport-ui/compare/v0.2.0...v0.4.1
[0.2.0]: https://github.com/JohnRiceML/clawport-ui/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/JohnRiceML/clawport-ui/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JohnRiceML/clawport-ui/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JohnRiceML/clawport-ui/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JohnRiceML/clawport-ui/releases/tag/v0.1.0
