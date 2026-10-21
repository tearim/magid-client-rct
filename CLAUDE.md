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

### Two packages (npm workspaces)

- **`magid-core/`** — `@magid/client-core`: the framework-free client. No React, no DOM: its `tsconfig.json` has no `DOM`
  lib and its tests run in Node, so a stray `window`/`document` fails the type-check or the tests. Consumed as TS source
  (`exports` → `src/index.ts`); everything public is re-exported from `index.ts`.
- **`magid-app/`** — the React app; imports protocol types and pure helpers from `@magid/client-core`.

A migration is in progress (owner decisions, 2026-10-21). Done: pure helpers, the transport (`transport.ts`: injectable
`fetch`, `clientType` announced as `client-type`) and the engine `MagidClient` (`client.ts`, tests in `client.test.ts`):
`send`/`selectStory`/`resetStory`, **one command at a time** (queue), session/scene/freshness recovery, `notice` and
`viewport` events instead of toasts/fullscreen, `stylesheets` as state, `can(capability)` (server capabilities will
come in config; until then everything is allowed except the operator's `disabledCapabilities`; disabled commands are
refused locally). The React store is now a thin adapter over it. Next: a `@magid/client-core/dom` entry (stylesheets, fullscreen, audio)
in the same package — one library, not several — and a vanilla example.
Keep the core free of anything a non-React renderer couldn't use.

## Commands

Install once from the **repo root** (one `package-lock.json` and `node_modules` there); root scripts fan out:

```powershell
npm install          # all workspaces
npm run dev          # app dev server w/ HMR, default http://localhost:5173
npm run build        # app: tsc -b && vite build
npm run test         # vitest run in every workspace
npm run lint         # eslint in every workspace
npm run typecheck    # core: tsc --noEmit (no DOM); app: tsc -b
```

Inside a package (`cd magid-core` or `cd magid-app`) the usual `npm run test|lint|test:watch` work too.
Run a single test file: `cd magid-core; npx vitest run src/elementFactory.test.ts`
Run tests matching a name: `npx vitest run -t "parses a menu response"`

Default dev target server (Magid backend) is `http://localhost:8090`; the client's own dev
server defaults to `http://localhost:5173`.

## Architecture

### Response parsing is key-driven, not type-driven

The server sends one JSON object per response; a single object can carry multiple recognized
keys at once (e.g. both `narration` and `menu`), and some element types have multiple valid key
aliases (`menu`/`menu-name`, `text`/`narration`, `command`/`command-name`/`command-text`, etc.).
`magid-core/src/elementFactory.ts` holds `ELEMENT_PARSERS`, the single lookup table mapping every known
JSON key to a parser producing a `ParsedElement`. This is intentionally the *one* place that
knows about element types — add new protocol keys/aliases only there, then extend the
`ParsedElement` union in the same file and `magid-core/src/protocol.ts`. `responses` arrays recurse
through `parseResponse` and collapse into a single `{ type: 'responses' }` node.

`resolveAnchors` (`magid-core/src/anchors.ts`) and `resolveStringsInObject` rewrite every `magid://` string anchor to the active
`baseUrl` at parse time, recursively, before any component sees the data. This is a plain prefix replacement, exactly like
the server's `XmlBundleLoader`, so the valid form is `magid:///path` (three slashes: the third one starts the path).

### Protocol engine: `MagidClient` (`magid-core/src/client.ts`); the store is only an adapter

`MagidClient` implements the client-side protocol; renderers never re-implement it:
- **Config elements** (`css-files` / `css-files-{clientType}` + arbitrary vars) are applied immediately and stripped from
  what gets rendered. Stylesheet URLs become `state.stylesheets`; vars go to `state.envVars`.
- **Session elements** carry `session-id`/`file-request-token`/available XMLs/server metadata; applied in a pre-pass so
  the token is there before same-batch CSS loads. The session id goes out as a `Bearer` header and is persisted through
  the injected `KeyValueStorage` (`STORAGE_KEYS`).
- **Detached elements** (`type: 'detached'`) never render standalone. They are attached to every `menu` of the same
  response batch (`detached-elements`) — `prepend`, `append`, or `by-anchor` (matched against a `text-anchor` in the
  menu description via `renderTextWithAnchors`). A new menu resets `userInputs` to the batch's `input-value`s.
- **Scene sync / freshness protocol**: `currentScene` and the `freshness-key` var go out with every command. On a
  `status: 'error'` payload the client distinguishes a stale session (drops it and opens a fresh one; the action is not
  retried), a blocking `E01*` error (`connectivityBlockedError`), a scene mismatch (action dismissed, current menu
  re-fetched, `notice`), or a freshness-key mismatch (same command retried once with the corrected key).
- **Story loading** (`selectStory` = `set-xml`, `resetStory` = `reload-xml`) first drops stylesheets, vars, scene and
  inputs. Commands run **one at a time** (queue); `can(capability)` gates guarded commands.

`magid-app/src/store/magidStore.ts` creates the app's `magidClient` (`clientType` `react`, `localStorage` via `prefs`,
`disabledCapabilities` from `clientConfig`), mirrors `getState()` into zustand, and handles what is UI-only: `notice` →
toasts, `viewport` → fullscreen (unless the user pref says no), `stylesheets` → `syncStylesheets`. Components keep
using `useMagidStore`; protocol changes belong in the core, never in the store or components.

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
- `magid-app/src/lib/cssUtils.ts` (`syncStylesheets` → `injectStyleLink`/`clearInjectedStylesheets`) fetches server-hosted
  stylesheets (`config.css-files`) as `<link>` tags, using a blob URL when an auth token must be
  attached (since `<link href>` can't carry headers).
- `magid-core/src/magidCss.ts` (`parseMagidCss`) converts inline per-element `css`/`menu-css` strings
  (web CSS syntax) into a `MagidStyle` (plain camelCased record: a React `style` prop or `Object.assign(el.style, …)`).
  Bare `left`/`top`/… numbers get `px` and imply `position: absolute`. Custom `-mg-*` properties (e.g.
  `-mg-abs-x`/`-mg-window-width`) and JavaFX-only `-fx-*` properties are currently dropped.

### Typewriter animation

Any display text containing `DCSTP_{ms}@{text}` segments triggers progressive rendering.
`magid-core/src/textTimeline.ts` parses these into cumulative-offset segments; `useTypewriter` drives
the reveal over time. `MenuScene` gates detached "append" elements on `typingComplete` so they
don't appear mid-typing.

Per-element typing styles come from CSS class names on narration elements, parsed by
`getConsequentalTypingConfig` (`magid-core/src/typingConfig.ts`):
- `type-by-letter-{ms|slow|normal|fast|rapid}` / `type-by-word-{…}`: letter- or word-wise reveal
  (named speeds: slow 30, normal 20, fast 10, rapid 5 ms).
- `animation-resets-{ms}`: restart the animation every N ms (plural "resets").

`renderWithBreaks` (`magid-app/src/lib/renderText.tsx`) renders the text with `TypingStyle` (`byLetter`, `byWord`, and
`…Isolating` variants) and keeps module-level reset bookkeeping, because it is a plain function and must not use hooks.

**Implied classes:** server vars prefixed `implied-classes-of:` (e.g.
`<client-var name="implied-classes-of: hermit-talking*, seer-talking" value="type-by-word-50 …"/>`) add classes to
elements whose class string matches. Patterns are comma-separated and match the **whole** class string: `x` equals,
`x*` starts with, `*x` ends with, `*x*` contains. No chaining (implied classes don't imply further ones), no duplicates.
The pure logic is `applyImpliedClasses` (`magid-core/src/impliedClasses.ts`); components use the `useImpliedClasses` hook, which
re-derives on `envVars` changes and never mutates `data`. Applied to narration, menu (`menu-class`, also on `<main>`),
command buttons (`command-class`) and input elements. `sendCommand` clears all `envVars` before `reload-xml`/`set-xml`,
since the new story's config (incl. `freshness-key`) arrives with the following response.

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
