# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else: staleness check

Run this at the start of **every** session, before the first task:

```bash
bash .claude/scripts/staleness-check.sh          # doc drift + tests / type-check / lint baseline (~1 min)
bash .claude/scripts/staleness-check.sh --quick  # doc drift only
```

It lists the commits since this file last changed and every path, document or identifier named here that no longer
exists, and records the current test/type/lint baseline. Then:
1. Compare its output with `OPEN-ISSUES.md`.
2. Tell the owner in a few lines what changed or broke since last time.
3. Fix stale statements in this file (doc edits only) before starting the actual task. Nothing in it may stay wrong.

**The code is the source of truth.** This file, `README.md` and old commit messages may lag. Example: commit 28283ae says
`animation-reset-N`, but the code and stories use `animation-resets-N`.

## Working with the owner

- **Report problems; don't fix them unasked.** The owner likes to fix some things personally. When you find a bug, smell
  or doc/code mismatch outside the task, add it to `OPEN-ISSUES.md` (where, why it matters, suggested fix) and mention it
  in your reply. Remove entries once resolved. Fix only what the task covers.
- **Assess requests before implementing.** If a requested change looks like a bad idea, say why and don't implement it
  unless the owner insists after hearing the reasons.
- **Tests specify correct behavior; they never document the current state.**
  - Test names (`describe`/`it`), comments and assertion messages never say whether the test currently passes or fails:
    no "RED", "GREEN", "BUG", "known bug", "currently fails", "should turn red when fixed".
  - Assert what the code **should** do. Never write a test that passes *because* a bug exists, and never branch inside a
    test on the state under test so that it passes either way.
  - In code the owner writes (you're assisting): a failing test is the deliverable. It marks a bug for the owner to
    debug. Don't "fix" the code or weaken the test to make it pass; report it and log it in `OPEN-ISSUES.md`.
  - In code you write yourself: make the tests pass, still with neutral names.
  - Before trusting a failure, check the test itself (wrong fixture, wrong premise). A `// precondition` assertion helps
    separate test mistakes from real bugs.
- **Don't add lint noise.** New code must not add `eslint` / `tsc` problems; the baseline is in the staleness-check output.
- **Most of this code was written by Claude; the owner edits parts of it.** Treat the owner's recent changes (see
  `git log`) as intentional, even where they diverge from patterns elsewhere.

## Related repository

The server lives in `C:\developer\com.zarterstein` (Java, Maven). It is the source of truth for the wire protocol:
command handling is in `story-server/agnostic` (`MagidServerCoreActions`, `MagidServerRouter`), and the MagidML tag
reference is `MAGID-XML-DSL.md` there. Story content (for real `magid:///…` URLs, CSS classes, `implied-classes-of:` vars)
is in its `content/` directory. Read it when a protocol question comes up; don't change it from here.

## What this is

Web-ready React client for the Magid server — a declarative storytelling engine driven by
XML/Markdown-authored stories. The server exposes an HTTP API (`GET {baseUrl}?cmd=...`) and
returns a JSON payload per response describing what to render (narration, menus/choices, visual
transitions, CSS theming, background music). This client is the web counterpart to an existing
JavaFX desktop client and follows the same server contract — do not change the wire protocol
unilaterally.

The code grew from an original "React blueprint" document that is no longer in the repository
(sessions/auth, detached elements, stats dashboard, toasts, typing styles, etc. were added later). Read the code
directly.

### The client core: `@magiden/client-core` (separate repo)

Everything protocol-related lives in **`@magiden/client-core`**: GitHub `tearim/magid-client-core`, locally
`C:\developer\magid-client-core` (extracted from this repo with its history on 2026-10-23). It is framework-free (no
React, no DOM) and has its own `CLAUDE.md`, `OPEN-ISSUES.md` and tests; **protocol, parsing and presentation-semantics
changes are made there, never here.** This repo depends on the npm release (`magid-app/package.json`:
`"@magiden/client-core": "^X.Y.Z"`); `npm install` puts it in `node_modules/@magiden/client-core` (`dist/` + `src/` for
reading). To try an unreleased core change here, `npm link` it or temporarily depend on `file:../../magid-client-core`,
then go back to the published version.
**After changing the core version, restart the dev server with a fresh dependency cache** (`npx -w magid-app vite --force`,
or delete `magid-app/node_modules/.vite`): Vite pre-bundles the core and may keep serving the old one, so the new app code
runs against the old core (seen with 0.2.0 → 0.3.0: anchors showed as text).

What the app gets from it (details in the core's `CLAUDE.md`):
- `MagidClient`: transport (`clientType` `react`), session, scene/freshness recovery, config, detached elements, story
  loading, one command at a time, `can(command)` from the server's `allowed-commands`, `stylesheets`/`htmlPolicy` as state.
- Parsed response elements (`ParsedElement`, key-driven `ELEMENT_PARSERS`), `magid:///` anchors resolved to `baseUrl`.
- Presentation semantics: `parseMagidCss`, `getConsequentalTypingConfig`, `parseTextSegments`/`resolveCleanText`,
  `applyImpliedClasses`, `prepareDisplayText`/`truncateHtml` (sanitized HTML tree, `TAG_PROCESSORS`, image token).

Keep anything a non-React renderer would also need out of this repo; if the app needs something new of that kind, it
goes into the core first.

## Commands

Install once from the **repo root**; root scripts run in the `magid-app` workspace:

```powershell
npm install          # also installs @magiden/client-core from npm
npm run dev          # app dev server w/ HMR, default http://localhost:5173
npm run build        # app: tsc -b && vite build
npm run test         # vitest (the app has no tests of its own yet; the core's are in its repo)
npm run lint         # eslint
npm run typecheck    # app: tsc -b
```

Inside `magid-app` the usual `npm run test|lint|test:watch` work too.
Run tests matching a name: `npx vitest run -t "parses a menu response"`

Default dev target server (Magid backend) is `http://localhost:8090`; the client's own dev
server defaults to `http://localhost:5173`.

## Architecture

### The store is only an adapter

`magid-app/src/store/magidStore.ts` creates the app's `magidClient` (`clientType` `react`, `localStorage` via `prefs`,
`disabledCommands` from `clientConfig`), mirrors `getState()` into zustand, and handles what is UI-only: `notice` →
toasts, `viewport` → fullscreen (unless the user pref says no), `stylesheets` → `syncStylesheets`. Components keep
using `useMagidStore` (`can` via `useMagidStore((s) => s.can('set-xml'))` re-renders when the server's list changes);
protocol changes belong in the core, never in the store or components.

### Component/UI flow

`App.tsx` decides which top-level screen to show based on store state, not routing (no router
in this app): `WelcomePage` (no server session yet) → `ServerLobbyPage` (session established, no
active scene) → `MagidRoot` (elements to render). `MagidRoot`/`MagidElement` dispatches
`ParsedElement`s to focused renderers (`MenuScene`, `NarrationText`, `ImageElement`, `CommandButton`,
`VisualFade`, `ResponsesContainer`, `DetachedElement`). `ResponsesContainer` and `MagidRoot` reveal narrations one after
another (each waits for the previous one's `onComplete`, unless it has a `defer`); standalone images (`ImageElement`)
take their turn the same way. `OptionsModal` holds runtime prefs
(server URL, XML selection, toggles, volume); `ServerStatsDashboard` is an admin/debug view over
`server-stats`. `ToastContainer` renders the store's `toasts` queue (used for out-of-sync/error
notices, not routine narration). The Reset button, the XML picker and Server Stats are shown only when `can(…)` allows
`reload-xml`, `set-xml` and `server-stats`.

`DetachedElement` follows the same single-source-of-truth pattern as the core's `ELEMENT_PARSERS`:
`DETACHED_ELEMENT_RENDERERS` maps `element-type` → renderer (`input` → `InputElement`, `image` → `MagidImage`). Add new
detached element types there. The core hands each detached element to the narration whose text holds its anchor, else
to the menu; `by-anchor` elements are rendered at their anchor node (see below), `prepend`/`append` around the menu
description.

**Images** (`magid-app/src/components/MagidImage.tsx`): `MagidImage` draws an author's `<img>`, detached or standalone,
with the author's `class`/`css` on the image itself, `alt`, `width`/`height` (a bare number is pixels) and the
file-request-token for server files (added at render time; it can change). `ImageElement` wraps a standalone one.
`<show image="…">` is different: an image belonging to the narration, whose class and css stay on the narration.

### CSS handling

Two independent CSS mechanisms exist — don't confuse them:
- `magid-app/src/lib/cssUtils.ts` (`syncStylesheets` → `injectStyleLink`/`clearInjectedStylesheets`) fetches server-hosted
  stylesheets (the core's `state.stylesheets`) as `<link>` tags, using a blob URL when an auth token must be
  attached (since `<link href>` can't carry headers).
- The core's `parseMagidCss` turns inline per-element `css` strings into a `style` object (incl. `-mg-abs-x`/`-y`).
  `MenuScene` still applies `menu-css` raw via `style.cssText` and handles `-mg-window-width/height` itself.

### Display text: typewriter, typing styles, HTML

`useTypewriter` (`magid-app/src/hooks/useTypewriter.ts`) reveals text over time from the core's `DCSTP_` timeline and
typing config (classes `type-by-letter-…`, `type-by-word-…`, `animation-resets-…`). `MenuScene` gates detached "append"
elements on `typingComplete` so they don't appear mid-typing.

Narration and menu descriptions go through the core's
`prepareDisplayText(raw, htmlPolicy, { baseUrl, fileRequestToken, anchors })` (memoized; re-parsed when those change;
`anchors` are the `text-anchor`s of the element's detached elements). The typewriter animates only the visible text,
`truncateHtml` cuts the tree by visible characters (tags and anchors are never typed out; an anchor is one character),
and `magid-app/src/lib/renderHtml.tsx` builds React elements from the tree (never `innerHTML`; `class` → `className`,
`style` → `parseMagidCss`; anchor nodes via its `renderAnchor` callback → `DetachedElement`). The last-letters/words effects apply to the
last text node only, the isolating ones to every text node. The HTML rules themselves (what's prose, what's removed, the
`<title>`/`<img>` processors) are documented in the core.

`renderWithBreaks` (`magid-app/src/lib/renderText.tsx`) renders the text with `TypingStyle` (`byLetter`, `byWord`, and
`…Isolating` variants) and keeps module-level reset bookkeeping, because it is a plain function and must not use hooks.

**Implied classes:** components use the `useImpliedClasses` hook over the core's `applyImpliedClasses` (vars
`implied-classes-of: pattern, …`; whole-class-string patterns `x`, `x*`, `*x`, `*x*`; no chaining). The hook re-derives
on `envVars` changes and never mutates `data`. Applied to narration, menu (`menu-class`, also on `<main>`), command
buttons (`command-class`) and input elements.

### Preferences

`magid-app/src/prefs/prefHelper.ts` wraps `localStorage` (`prefs.get/set/getBoolean/getDouble`, keyed by
`PREF_KEYS`) plus a small MRU `urlHistory` list of previously used server addresses. This is the
only persistence mechanism in the app (besides in-memory Zustand state) — session id and file
request token are also persisted here so sessions survive a reload.

### Known intentional gaps

`menu-position` is accepted as a config var but only logged via `console.warn` and never acted
on — this mirrors the JFX reference client, where the handler is dead code (`if (true) return`).
Don't implement it without checking whether the JFX client's behavior has actually changed.

### Operator config vs. user options

`magid-app/src/config/clientConfig.ts` is a compiled-in, non-user-editable flag set for the operator/story
owner (e.g. whether to show the Connect/Reset Server buttons) — distinct from `OptionsModal`,
which holds end-user-adjustable runtime preferences.
