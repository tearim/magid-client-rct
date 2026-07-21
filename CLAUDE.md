# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Web-ready React client for the Magid server — a declarative storytelling engine driven by
XML/Markdown-authored stories. The server exposes an HTTP API (`GET {baseUrl}?cmd=...`) and
returns a JSON payload per response describing what to render (narration, menus/choices, visual
transitions, CSS theming, background music). This client is the web counterpart to an existing
JavaFX desktop client and follows the same server contract — do not change the wire protocol
unilaterally.

The actual code (`magid-app/src`) has evolved past the original plan in `REACT_BLUEPRINT.md`
(sessions/auth, detached elements, stats dashboard, toasts, etc. were added later) — treat the
blueprint as historical background/protocol reference, not a source of truth for current
structure. Prefer reading the code in `magid-app/src` directly.

## Commands

All commands run from `magid-app/` (the actual app lives there, not the repo root):

```powershell
cd magid-app
npm install         # install deps
npm run dev          # dev server w/ HMR, default http://localhost:5173
npm run build        # tsc -b && vite build (type-checks as part of build)
npm run lint         # eslint .
npm run test         # vitest run (single run)
npm run test:watch   # vitest watch mode
```

Run a single test file: `npx vitest run src/lib/elementFactory.test.ts`
Run tests matching a name: `npx vitest run -t "parses a menu response"`

Default dev target server (Magid backend) is `http://localhost:8090`; the client's own dev
server defaults to `http://localhost:5173`.

## Architecture

### Response parsing is key-driven, not type-driven

The server sends one JSON object per response; a single object can carry multiple recognized
keys at once (e.g. both `narration` and `menu`), and some element types have multiple valid key
aliases (`menu`/`menu-name`, `text`/`narration`, `command`/`command-name`/`command-text`, etc.).
`src/lib/elementFactory.ts` holds `ELEMENT_PARSERS`, the single lookup table mapping every known
JSON key to a parser producing a `ParsedElement`. This is intentionally the *one* place that
knows about element types — add new protocol keys/aliases only there, then extend the
`ParsedElement` union in the same file and `src/types/protocol.ts`. `responses` arrays recurse
through `parseResponse` and collapse into a single `{ type: 'responses' }` node.

`resolveAnchors`/`resolveStringsInObject` rewrite every `magid://` string anchor to the active
`baseUrl` at parse time, recursively, before any component sees the data.

### Store (`src/store/magidStore.ts`) owns protocol-level logic, not just state

Zustand's `useMagidStore` is more than a state container — `loadResponse` implements most of the
client-side protocol behavior:
- **Config elements** (`css-files`/`css-files-react` + arbitrary vars) are applied immediately
  and stripped from what gets rendered.
- **Session elements** carry `session-id`/`file-request-token`/available XMLs/server metadata;
  applied in a pre-pass so the token is available before same-batch CSS loads. Session id is
  sent as a `Bearer` auth header on every request via `apiSendCommand`.
- **Detached elements** (`type: 'detached'`) never render standalone. They describe markup that
  must be spliced into whichever `menu` shares the same response batch — either `prepend`,
  `append`, or `by-anchor` (matched against a `text-anchor` inside the menu description text, via
  `renderTextWithAnchors`). `collectDetached` gathers them per-batch in `loadResponse`, and they
  get attached onto every `menu` element's `detached-elements` field before rendering.
- **Scene sync / freshness protocol**: the store tracks `currentScene` and a `freshness-key` var,
  sending both with every command. If the server replies with a `status: 'error'` payload
  (`parseServerError`), `sendCommand` distinguishes: a stale/rejected session (re-establishes a
  fresh session and retries), a scene mismatch (discards the action, re-fetches the current menu,
  shows a toast), or a freshness-key mismatch (retries the same command once with the corrected
  key). This retry/recovery logic lives entirely in `sendCommand` — don't duplicate it in
  components.

### Component/UI flow

`App.tsx` decides which top-level screen to show based on store state, not routing (no router
in this app): `WelcomePage` (no server session yet) → `ServerLobbyPage` (session established, no
active scene) → `MagidRoot` (elements to render). `MagidRoot`/`MagidElement` dispatches
`ParsedElement`s to focused renderers (`MenuScene`, `NarrationText`, `CommandButton`,
`VisualFade`, `ResponsesContainer`, `DetachedElement`). `OptionsModal` holds runtime prefs
(server URL, XML selection, toggles, volume); `ServerStatsDashboard` is an admin/debug view over
`server-stats`. `ToastContainer` renders the store's `toasts` queue (used for out-of-sync/error
notices, not routine narration).

`DetachedElement` follows the same single-source-of-truth pattern as `elementFactory`:
`DETACHED_ELEMENT_RENDERERS` maps `element-type` → renderer (currently just `input` →
`InputElement`). Add new detached element types there.

### CSS handling

Two independent CSS mechanisms exist — don't confuse them:
- `src/lib/cssUtils.ts` (`injectStyleLink`/`clearInjectedStylesheets`) fetches server-hosted
  stylesheets (`config.css-files`) as `<link>` tags, using a blob URL when an auth token must be
  attached (since `<link href>` can't carry headers).
- `src/lib/magidCss.ts` (`parseMagidCss`) converts inline per-element `css`/`menu-css` strings
  (web CSS syntax, with custom `-mg-*` properties like `-mg-abs-x`/`-mg-window-width`) into a
  `CSSProperties` object for direct inline styling; JavaFX-only properties (`-fx-*`) are dropped.

### Typewriter animation

Any display text containing `DCSTP_{ms}@{text}` segments triggers progressive rendering.
`src/lib/textTimeline.ts` parses these into cumulative-offset segments; `useTypewriter` drives
the reveal over time. `MenuScene` gates detached "append" elements on `typingComplete` so they
don't appear mid-typing.

### Preferences

`src/prefs/prefHelper.ts` wraps `localStorage` (`prefs.get/set/getBoolean/getDouble`, keyed by
`PREF_KEYS`) plus a small MRU `urlHistory` list of previously used server addresses. This is the
only persistence mechanism in the app (besides in-memory Zustand state) — session id and file
request token are also persisted here so sessions survive a reload.

### Known intentional gaps

`menu-position` is accepted as a config var but only logged via `console.warn` and never acted
on — this mirrors the JFX reference client, where the handler is dead code (`if (true) return`).
Don't implement it without checking whether the JFX client's behavior has actually changed.

### Operator config vs. user options

`src/config/clientConfig.ts` is a compiled-in, non-user-editable flag set for the operator/story
owner (e.g. whether to show the Connect/Reset Server buttons) — distinct from `OptionsModal`,
which holds end-user-adjustable runtime preferences.
