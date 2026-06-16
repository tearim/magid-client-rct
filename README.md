# Magid React Client

Web-ready React client for the Magid server.

This project mirrors an earlier JavaFX desktop client and is designed to make Magid easier to deploy, access, and evolve without requiring a desktop app installation.

> Status: this client is currently a prototype.
>
> The Magid server is not yet publicly available, so production deployment/running is not a primary focus yet.

## What this repository contains

- **`magid-app/`** — the actual React + TypeScript application (Vite-based)
- **`REACT_BLUEPRINT.md`** — implementation blueprint and protocol/design reference used during development

> Note: this client was initially generated with Claude under close human supervision, with parts hand-crafted and refined.

## What is Magid?

Magid is a declarative storytelling engine centered on XML/Markdown-authored stories.

At runtime, the server exposes an HTTP API and returns JSON responses that describe what the client should render:

- narration/text blocks
- interactive menu choices and standalone commands
- visual transitions
- dynamic theming/CSS configuration
- background music references

This React client is the web counterpart of the JavaFX client and follows the same server contract.

## Magid protocol (quick overview)

- Requests are sent to a base URL using `?cmd=...` (for example `server-status`, `list-xmls`, `reload-xml`, `set-xml`, or story commands).
- Responses are JSON objects containing protocol keys such as `menu`, `narration`/`text`, `command`, `visual`, `config`, or a `responses` array.
- `magid://` anchors in response strings are resolved to the configured base server URL.
- Text can include `DCSTP_` timeline markers to trigger typewriter-style progressive rendering.

For deeper protocol and architecture details, see `REACT_BLUEPRINT.md`.

## Requirements

- **Node.js** `20.19+` or `22.12+` (Node 22 LTS recommended)
- **npm** `10+`

## Installation

### 1) Install/upgrade Node.js

#### Windows

```powershell
winget install OpenJS.NodeJS.LTS
```

#### macOS (Homebrew)

```bash
brew install node@22
```

If needed, link it:

```bash
brew link --overwrite --force node@22
```

#### Linux

Use your distro package manager, or install via NVM (recommended for consistent Node versions).

NVM (Ubuntu/Debian/Fedora/Arch and others):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22
nvm use 22
```

Then reopen your terminal so PATH updates are applied.

Verify:

```powershell
node --version   # should be v22.x.x or v20.19+
npm --version
```

### 2) PowerShell execution policy (Windows only, if needed)

If you get `running scripts is disabled on this system` while running npm scripts:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3) Install dependencies

```powershell
cd magid-app
npm install
```

## Run in development

```powershell
cd magid-app
npm run dev
```

Default local URL: `http://localhost:5173`

## Build for production

```powershell
cd magid-app
npm run build
```

Build output is generated in `magid-app/dist/`.

## Available scripts (inside `magid-app`)

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Troubleshooting

### `Cannot find native binding` / rolldown error

This usually means `node_modules` was installed on a different machine or Node version.

From `magid-app/`, reinstall cleanly:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```