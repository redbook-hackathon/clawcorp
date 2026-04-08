
<p align="center">
  <img src="src/assets/logo.svg" width="128" height="128" alt="ClawCorp Logo" />
</p>

<h1 align="center">ClawCorp</h1>

<p align="center">
  <strong>The Desktop Interface for OpenClaw AI Agents</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#why-clawcorp">Why ClawCorp</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-MacOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-40+-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" />
  <a href="https://discord.com/invite/84Kex3GGAh" target="_blank">
  <img src="https://img.shields.io/discord/1399603591471435907?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb" alt="chat on Discord" />
  </a>
  <img src="https://img.shields.io/github/downloads/ValueCell-ai/ClawCorp/total?color=%23027DEB" alt="Downloads" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

---

## Overview

**ClawCorp** bridges the gap between powerful AI agents and everyday users. Built on top of [OpenClaw](https://github.com/OpenClaw), it transforms command-line AI orchestration into an accessible, beautiful desktop experience—no terminal required.

Whether you're automating workflows, managing AI-powered channels, or scheduling intelligent tasks, ClawCorp provides the interface you need to harness AI agents effectively.

ClawCorp comes pre-configured with best-practice model providers and natively supports Windows as well as multi-language settings. Of course, you can also fine-tune advanced configurations via **Settings → Advanced → Developer Mode**.

---
## Screenshot

<p align="center">
  <img src="resources/screenshot/en/chat.png" style="width: 100%; height: auto;">
</p>

<p align="center">
  <img src="resources/screenshot/en/cron.png" style="width: 100%; height: auto;">
</p>

<p align="center">
  <img src="resources/screenshot/en/skills.png" style="width: 100%; height: auto;">
</p>

<p align="center">
  <img src="resources/screenshot/en/channels.png" style="width: 100%; height: auto;">
</p>

<p align="center">
  <img src="resources/screenshot/en/models.png" style="width: 100%; height: auto;">
</p>

<p align="center">
  <img src="resources/screenshot/en/settings.png" style="width: 100%; height: auto;">
</p>

---

## Why ClawCorp

Building AI agents shouldn't require mastering the command line. ClawCorp was designed with a simple philosophy: **powerful technology deserves an interface that respects your time.**

| Challenge | ClawCorp Solution |
|-----------|----------------|
| Complex CLI setup | One-click installation with guided setup wizard |
| Configuration files | Visual settings with real-time validation |
| Process management | Automatic gateway lifecycle management |
| Multiple AI providers | Unified provider configuration panel |
| Skill/plugin installation | Built-in skill marketplace and management |

### OpenClaw Inside

ClawCorp is built directly upon the official **OpenClaw** core. Instead of requiring a separate installation, we embed the runtime within the application to provide a seamless "battery-included" experience.

We are committed to maintaining strict alignment with the upstream OpenClaw project, ensuring that you always have access to the latest capabilities, stability improvements, and ecosystem compatibility provided by the official releases.

---

## Features

### 🎯 Zero Configuration Barrier
Complete the entire setup—from installation to your first AI interaction—through an intuitive graphical interface. No terminal commands, no YAML files, no environment variable hunting.

### 💬 Intelligent Chat Interface
Communicate with AI agents through a modern chat experience. Support for multiple conversation contexts, message history, rich content rendering with Markdown, and direct `@agent` routing in the main composer for multi-agent setups.
When you target another agent with `@agent`, ClawCorp switches into that agent's own conversation context directly instead of relaying through the default agent. Agent workspaces stay separate by default, and stronger isolation depends on OpenClaw sandbox settings.
The chat composer also includes slash commands such as `/new`, `/stop`, `/agent`, `/cwd`, `/memory`, `/cron`, `/settings`, and `/export` for fast local actions without leaving the keyboard.
Sidebar global search is available with `Ctrl/Cmd+K`, and now searches sessions, agents, pages, and cached chat-history text. Sessions can be pinned in the Sidebar, and exports remain available via `/export` and the Chat page's `Session` drawer. The Sidebar footer is now a single upload entry for quick file intake, and the Activity page upgrades raw logs into filterable structured event cards with raw-line expansion and live auto-refresh.

### 🧪 Rich Markdown Rendering
Chat markdown now covers standard math rendering and KaTeX `mhchem` chemistry formulas, alongside syntax highlighting, local file links, and copy-friendly code blocks.

### 📡 Multi-Channel Management
Configure and monitor multiple AI channels simultaneously. Each channel operates independently, allowing you to run specialized agents for different tasks.
Feishu onboarding now stays inside ClawCorp with one integrated wizard for plugin checks, robot create/link handoff, credential save, app-scope recovery, and QR-based user authorization.
The channel workbench also supports account-scoped management inside the current product shape: you can inspect multiple accounts per channel, switch the default account, maintain account bindings, and resolve delivery targets for channels such as Feishu, WeChat, WeCom, DingTalk, and QQ Bot through a shared backend path.
Channel-backed conversations are now isolated from the main local chat timeline, the Sidebar shows each configured account instance separately, channel-derived sessions are prefixed in the global session list, and synced conversation items can be renamed or removed from the workbench list without deleting the underlying channel account.

### ⏰ Cron-Based Automation
Schedule AI tasks to run automatically. Define triggers, set intervals, and let your AI agents work around the clock without manual intervention.
The Cron page also includes richer run-detail panels with delivery targets, recent error context, and recent run history.
Agent detail pages now expose backend-owned cron relations and deep-link directly into the relevant Cron pipeline entry.

### 👥 Team Control Plane (MVP)
ClawCorp now treats team pages as role-aware control surfaces instead of static member lists.
The `/agents` route now serves as an Employee Square: a hero-led card grid with lightweight filters, direct `Chat / Memory / Details` entry points, and a right-side create sheet for new agents.
In `Agent Detail`, each member can be configured with `teamRole` (`leader` or `worker`), `chatAccess` (`direct` or `leader_only`), and `responsibility`.
Agent dossiers now use `Overview / Memory / Skills / Activity` tabs so profile controls, shared memory access, read-only skills, and cron/activity context live in one route without turning the page back into a flat admin form.
`leader_only` is now enforced for normal direct-chat entry paths in the workbench: users are expected to route requests through the reporting leader instead of opening a direct worker chat.
Team pages also surface user-facing channel ownership and lightweight work visibility derived from the existing kanban/runtime model, so you can see who owns entry points and which members are blocked, waiting, or actively executing work.
`Team Overview` and `Team Map` now surface these semantics alongside runtime activity cues, so you can quickly identify who coordinates, who executes, and which members should be reached through leaders.
Phase 4 extends that control plane with a leader-first progress briefing in Team Overview, richer collaboration-aware Team Map nodes and drawers, and a lightweight Team Brief panel in private leader chat for quick navigation back into member detail and Kanban.
Phase 5 then refines those surfaces into a warmer leader command center: Team Overview prioritizes progress, active work, risks, and next-step guidance, while Team Map becomes a denser operations topology with a persistent task-focused rail.

### 🧩 Extensible Skill System
Extend your AI agents with pre-built skills. Browse, install, and manage skills through the integrated skill panel—no package managers required.
ClawCorp also pre-bundles full document-processing skills (`pdf`, `xlsx`, `docx`, `pptx`), deploys them automatically to the managed skills directory (default `~/.openclaw/skills`) on startup, and enables them by default on first install. Additional bundled skills (`find-skills`, `self-improving-agent`, `tavily-search`, `brave-web-search`, `bocha-skill`) are also enabled by default; if required API keys are missing, OpenClaw will surface configuration errors in runtime.  
The Skills page can display skills discovered from multiple OpenClaw sources (managed dir, workspace, and extra skill dirs), and now shows each skill's actual location so you can open the real folder directly.

Environment variables for bundled search skills:
- `BRAVE_SEARCH_API_KEY` for `brave-web-search`
- `TAVILY_API_KEY` for `tavily-search` (OAuth may also be supported by upstream skill runtime)
- `BOCHA_API_KEY` for `bocha-skill`
- `find-skills` and `self-improving-agent` do not require API keys

### 🔐 Secure Provider Integration
Connect to multiple AI providers (OpenAI, Anthropic, and more) with credentials stored securely in your system's native keychain. OpenAI supports both API key and browser OAuth (Codex subscription) sign-in.

### 🌙 Adaptive Theming
Light mode, dark mode, or system-synchronized themes. ClawCorp adapts to your preferences automatically.

### 🚀 Startup Launch Control
In **Settings → General**, you can enable **Launch at system startup** so ClawCorp starts automatically after login.

---

## Getting Started

### System Requirements

- **Operating System**: macOS 11+, Windows 10+, or Linux (Ubuntu 20.04+)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 1GB available disk space

### Installation

#### Pre-built Releases (Recommended)

Download the latest release for your platform from the [Releases](https://github.com/ValueCell-ai/ClawCorp/releases) page.

#### Build from Source

```bash
# Clone the repository
git clone https://github.com/ValueCell-ai/ClawCorp.git
cd ClawCorp

# Initialize the project
pnpm run init

# Start in development mode
pnpm dev
```
### First Launch

When you launch ClawCorp for the first time, the **Setup Wizard** will guide you through:

1. **Language & Region** – Configure your preferred locale
2. **AI Provider** – Add providers with API keys or OAuth (for providers that support browser/device login)
3. **Skill Bundles** – Select pre-configured skills for common use cases
4. **Verification** – Test your configuration before entering the main interface

The wizard preselects your system language when it is supported, and falls back to English otherwise.

> Note for Moonshot (Kimi): ClawCorp keeps Kimi web search enabled by default.  
> When Moonshot is configured, ClawCorp also syncs Kimi web search to the China endpoint (`https://api.moonshot.cn/v1`) in OpenClaw config.

### Proxy Settings

ClawCorp includes built-in proxy settings for environments where Electron, the OpenClaw Gateway, or channels such as Telegram need to reach the internet through a local proxy client.

Open **Settings → Gateway → Proxy** and configure:

- **Proxy Server**: the default proxy for all requests
- **Bypass Rules**: hosts that should connect directly, separated by semicolons, commas, or new lines
- In **Developer Mode**, you can optionally override:
  - **HTTP Proxy**
  - **HTTPS Proxy**
  - **ALL_PROXY / SOCKS**

Recommended local examples:

```text
Proxy Server: http://127.0.0.1:7890
```
Notes:

- A bare `host:port` value is treated as HTTP.
- If advanced proxy fields are left empty, ClawCorp falls back to `Proxy Server`.
- Saving proxy settings reapplies Electron networking immediately and restarts the Gateway automatically.
- ClawCorp also syncs the proxy to OpenClaw's Telegram channel config when Telegram is enabled.
- In **Settings → Advanced → Developer**, you can run **OpenClaw Doctor** to execute `openclaw doctor --json` and inspect the diagnostic output without leaving the app.

---

## Architecture

ClawCorp employs a **dual-process architecture** with a unified host API layer. The renderer talks to a single client abstraction, while Electron Main owns protocol selection and process lifecycle:

```┌─────────────────────────────────────────────────────────────────┐
│                        ClawCorp Desktop App                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Electron Main Process                          │  │
│  │  • Window & application lifecycle management               │  │
│  │  • Gateway process supervision                              │  │
│  │  • System integration (tray, notifications, keychain)       │  │
│  │  • Auto-update orchestration                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              │ IPC (authoritative control plane)  │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              React Renderer Process                         │  │
│  │  • Modern component-based UI (React 19)                     │  │
│  │  • State management with Zustand                            │  │
│  │  • Unified host-api/api-client calls                        │  │
│  │  • Rich Markdown rendering                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ Main-owned transport strategy
                               │ (WS first, HTTP then IPC fallback)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                Host API & Main Process Proxies                  │
│                                                                  │
│  • hostapi:fetch (Main proxy, avoids CORS in dev/prod)          │
│  • gateway:httpProxy (Renderer never calls Gateway HTTP direct)  │
│  • Unified error mapping & retry/backoff                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ WS / HTTP / IPC fallback
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                             │
│                                                                  │
│  • AI agent runtime and orchestration                           │
│  • Message channel management                                    │
│  • Skill/plugin execution environment                           │
│  • Provider abstraction layer                                    │
└─────────────────────────────────────────────────────────────────┘
```
### Design Principles

- **Process Isolation**: The AI runtime operates in a separate process, ensuring UI responsiveness even during heavy computation
- **Single Entry for Frontend Calls**: Renderer requests go through host-api/api-client; protocol details are hidden behind a stable interface
- **Main-Process Transport Ownership**: Electron Main controls WS/HTTP usage and fallback to IPC for reliability
- **Graceful Recovery**: Built-in reconnect, timeout, and backoff logic handles transient failures automatically
- **Secure Storage**: API keys and sensitive data leverage the operating system's native secure storage mechanisms
- **CORS-Safe by Design**: Local HTTP access is proxied by Main, preventing renderer-side CORS issues

---

## Use Cases

### 🤖 Personal AI Assistant
Configure a general-purpose AI agent that can answer questions, draft emails, summarize documents, and help with everyday tasks—all from a clean desktop interface.

### 📊 Automated Monitoring
Set up scheduled agents to monitor news feeds, track prices, or watch for specific events. Results are delivered to your preferred notification channel.

### 💻 Developer Productivity
Integrate AI into your development workflow. Use agents to review code, generate documentation, or automate repetitive coding tasks.

### 🔄 Workflow Automation
Chain multiple skills together to create sophisticated automation pipelines. Process data, transform content, and trigger actions—all orchestrated visually.

---

## Development

### Prerequisites

- **Node.js**: 22+ (LTS recommended)
- **Package Manager**: `pnpm@10.31.0` via Corepack (`corepack enable && corepack prepare pnpm@10.31.0 --activate`)

### Project Structure

```ClawCorp/
├── electron/                 # Electron Main Process
│   ├── api/                 # Main-side API router and handlers
│   │   └── routes/          # RPC/HTTP proxy route modules
│   ├── services/            # Provider, secrets and runtime services
│   │   ├── providers/       # Provider/account model sync logic
│   │   └── secrets/         # OS keychain and secret storage
│   ├── shared/              # Shared provider schemas/constants
│   │   └── providers/
│   ├── main/                # App entry, windows, IPC registration
│   ├── gateway/             # OpenClaw Gateway process manager
│   ├── preload/             # Secure IPC bridge
│   └── utils/               # Utilities (storage, auth, paths)
├── src/                      # React Renderer Process
│   ├── lib/                 # Unified frontend API + error model
│   ├── stores/              # Zustand stores (settings/chat/gateway)
│   ├── components/          # Reusable UI components
│   ├── pages/               # Setup/Dashboard/Chat/Channels/Skills/Cron/Settings
│   ├── i18n/                # Localization resources
│   └── types/               # TypeScript type definitions
├── tests/
│   └── unit/                # Vitest unit/integration-like tests
├── resources/                # Static assets (icons/images)
└── scripts/                  # Build and utility scripts
```
### Available Commands

```bash
# Development
pnpm run init             # Install dependencies + download uv
pnpm dev                  # Start with hot reload

# Quality
pnpm run lint             # Run ESLint checks
pnpm run lint:a11y        # Run focused accessibility lint gates
pnpm run lint:fix         # Run ESLint with auto-fix
pnpm typecheck            # TypeScript validation

# Testing
pnpm test                 # Run unit tests
pnpm run test:a11y        # Run focused accessibility regression tests
pnpm run test:e2e         # Run Playwright E2E tests
pnpm run test:e2e:headed  # Run Playwright E2E tests in headed mode
pnpm run smoke:linux      # Linux release + install smoke (non-destructive)
pnpm run comms:replay     # Compute communication replay metrics
pnpm run comms:baseline   # Refresh communication baseline snapshot
pnpm run comms:compare    # Compare replay metrics against baseline thresholds

# Build & Package
pnpm run build:vite       # Build frontend only
pnpm build                # Full production build (with packaging assets)
pnpm package              # Package for current platform
pnpm package:mac          # Package for macOS
pnpm package:win          # Package for Windows
pnpm package:linux        # Package for Linux
pnpm package:mac:ci       # CI package for macOS (no publish)
pnpm package:win:ci       # CI package for Windows (no publish)
pnpm package:linux:ci     # CI package for Linux (no publish)
pnpm run governance:check # Run knip + dependency-cruiser governance checks
```

### Communication Regression Checks

When a PR changes communication paths (gateway events, chat runtime send/receive flow, channel delivery, or transport fallback), run:

```bash
pnpm run comms:replay
pnpm run comms:compare
```

`comms-regression` in CI enforces required scenarios and threshold checks.

### Accessibility & Governance Gates

When a change touches shared UI, renderer accessibility, or module boundaries, run the focused gates before pushing:

```bash
pnpm run lint:a11y
pnpm run test:a11y
pnpm run governance:check
```

`lint:a11y` currently covers the Activity, Cron, Settings, and Workbench empty-state surfaces. `test:a11y` runs the matching `vitest-axe` regressions, and `governance:check` combines `knip` with `dependency-cruiser` boundary checks.

### Codex Ralph Loop

For long-running autonomous iteration with Codex, the repository now includes a Ralph-compatible loop under `scripts/ralph/`.

Required files:

- `scripts/ralph/ralph-codex.mjs`
- `scripts/ralph/ralph-codex.sh`
- `scripts/ralph/ralph-codex.ps1`
- `scripts/ralph/CODEX.md`
- `scripts/ralph/prd.json.example`
- repository-root `prd.json`

Example commands:

```bash
pnpm run ralph:codex -- 999
bash ./scripts/ralph/ralph-codex.sh 999
bash ./scripts/ralph/ralph-codex.sh --forever
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ralph\ralph-codex.ps1 999
```

The loop calls `codex exec --dangerously-bypass-approvals-and-sandbox` internally and stops early once the agent emits `<promise>COMPLETE</promise>`.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron 40+ |
| UI Framework | React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Build | Vite + electron-builder |
| Testing | Vitest + Playwright |
| Animation | Framer Motion |
| Icons | Lucide React |

---

## Contributing

We welcome contributions from the community! Whether it's bug fixes, new features, documentation improvements, or translations—every contribution helps make ClawCorp better.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes with clear messages
4. **Push** to your branch
5. **Open** a Pull Request

### Guidelines

- Follow the existing code style (ESLint + Prettier)
- Write tests for new functionality
- Update documentation as needed
- Keep commits atomic and descriptive

---

## Acknowledgments

ClawCorp is built on the shoulders of excellent open-source projects:

- [OpenClaw](https://github.com/OpenClaw) – The AI agent runtime
- [Electron](https://www.electronjs.org/) – Cross-platform desktop framework
- [React](https://react.dev/) – UI component library
- [shadcn/ui](https://ui.shadcn.com/) – Beautifully designed components
- [Zustand](https://github.com/pmndrs/zustand) – Lightweight state management

---

## Community

Join our community to connect with other users, get support, and share your experiences.

| Enterprise WeChat | Feishu Group | Discord |
| :---: | :---: | :---: |
| <img src="src/assets/community/wecom-qr.png" width="150" alt="WeChat QR Code" /> | <img src="src/assets/community/feishu-qr.png" width="150" alt="Feishu QR Code" /> | <img src="src/assets/community/20260212-185822.png" width="150" alt="Discord QR Code" /> |

### ClawCorp Partner Program 🚀

We're launching the ClawCorp Partner Program and looking for partners who can help introduce ClawCorp to more clients, especially those with custom AI agent or automation needs.

Partners help connect us with potential users and projects, while the ClawCorp team provides full technical support, customization, and integration.

If you work with clients interested in AI tools or automation, we'd love to collaborate.

DM us or email [public@valuecell.ai](mailto:public@valuecell.ai) to learn more.

---

## Star History

<p align="center">
  <img src="https://api.star-history.com/svg?repos=ValueCell-ai/ClawCorp&type=Date" alt="Star History Chart" />
</p>

---

## License

ClawCorp is released under the [MIT License](LICENSE). You're free to use, modify, and distribute this software.

---

<p align="center">
  <sub>Built with ❤️ by the ValueCell Team</sub>
</p>
