# magid-app

React + TypeScript client, built with Vite.

## Requirements

- **Node.js** 20.19+ or 22.12+ (v22 LTS recommended)
- **npm** 10+

## Installation

### 1. Install Node.js

If your Node version is below the required minimum, upgrade via winget (Windows):

```powershell
winget install OpenJS.NodeJS.LTS
```

Then close and reopen your terminal to apply the updated PATH.

Verify:

```powershell
node --version   # should be v22.x.x or v20.19+
npm --version
```

### 2. Fix PowerShell execution policy (Windows only)

If you see `running scripts is disabled on this system` when running npm, run this once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3. Install dependencies

The project lives in the `magid-app` subdirectory:

```powershell
cd magid-app
npm install
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Development

```powershell
npm run dev
```

The app will be available at `http://localhost:5173`.

## Build

```powershell
npm run build
```

Output is placed in the `dist/` directory.

## Troubleshooting

**`Cannot find native binding` / rolldown error**

This happens when `node_modules` was installed on a different machine or Node version. Delete and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```
