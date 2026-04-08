# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.5.x   | Yes       |
| < 0.5   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in ClawPort, please report it responsibly.

- **Email:** security@clawport.dev
- **GitHub:** Use [GitHub Security Advisories](https://github.com/JohnRiceML/clawport-ui/security/advisories/new) to report vulnerabilities privately.

Please include steps to reproduce, affected versions, and potential impact. You should receive an acknowledgment within 72 hours. We will not pursue legal action against good-faith reporters.

## Security Model

ClawPort is a **local-first, single-operator tool**. It is designed to run on a developer's own machine or a trusted server. There is no user authentication system, no multi-tenant isolation, and no public-facing deployment expected.

The trust boundary is the local machine. If an attacker has access to the machine running ClawPort, the application is not the appropriate layer of defense.

## Token Handling

ClawPort authenticates with the OpenClaw gateway using `OPENCLAW_GATEWAY_TOKEN`, stored in `.env.local` (gitignored). This token is:

- Read server-side only via Next.js server actions and API routes.
- Never exposed to the browser or included in client-side bundles.
- Never logged or written to disk at runtime.

No direct API keys for AI providers (OpenAI, Anthropic, etc.) are used. All AI calls route through the local OpenClaw gateway.

## Data Storage

- **Conversations** are stored in the browser's `localStorage` as base64 data URLs. They are not encrypted and are cleared when the user clears browser data.
- **Settings** are also stored in `localStorage`.
- No data is sent to external servers. There is no database.

Users should be aware that anyone with access to their browser profile can read stored conversations and settings.

## Filesystem Access

ClawPort reads files from the path specified by `WORKSPACE_PATH` and executes the OpenClaw CLI binary specified by `OPENCLAW_BIN` via `child_process.execFile`.

- `execFile` is used instead of `exec` to avoid shell injection.
- Both `WORKSPACE_PATH` and `OPENCLAW_BIN` are configured via server-side environment variables, not user input.
- Access is bounded by the OS-level permissions of the process running ClawPort.

## Out of Scope

The following are not considered vulnerabilities in ClawPort:

- Denial of service against localhost services.
- Social engineering attacks.
- Physical access to the host machine.
- Vulnerabilities in OpenClaw, the gateway, or upstream AI providers (report those to their respective maintainers).
- Missing authentication or authorization (by design -- this is a single-operator tool).
- Data readable in `localStorage` by same-origin scripts (expected browser behavior).

## Dependencies

Dependencies are kept minimal. We run `npm audit` regularly and update vulnerable packages promptly. If you identify a dependency-level vulnerability that affects ClawPort specifically, please report it through the channels above.
