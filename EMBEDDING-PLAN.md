# Plan: Magid as a full app or inside an element of any page

Status: proposal (2026-11-08), nothing implemented yet.

## Goal

The same client runs in two ways:

1. **Full app** (today): Magid owns the page. Nothing changes for this mode, and it stays the default build.
2. **Embedded**: a host page that isn't Magid gives Magid one element (`<div id="magid-app">`, a `<section>`, …), and
   Magid lives only inside it. Text, CSS, sizing, overlays, keys, fullscreen and storage stay inside that element, and
   the host page's CSS doesn't leak into Magid.

```html
<section id="story"></section>
<script type="module">
  import { mountMagid } from 'https://example.org/magid/magid-embed.js';
  const magid = mountMagid(document.getElementById('story'), {
    baseUrl: 'https://stories.example.org',
    story: 'oasis/oasis.xml',
  });
  // later: magid.unmount();
</script>
```

An `<iframe>` gets most of this with no code changes (only `allow="fullscreen"`), and the docs should keep offering
it as the zero-effort option. This plan covers hosts that don't want an iframe: the story should flow with the
page, size to the page's layout, and need no second document.

## What leaks out of the element today

| Where | What it does to the page |
|---|---|
| `lib/cssUtils.ts` `syncStylesheets` | Story CSS goes into `<head>` as `<link>`s and styles the whole page. Real stories use `:root { --vars }` (aliasworld, blutgruppen), `*` rules (12) and `body` / `100vw` / `100vh` (aliasworld `html-css`). |
| `index.css` | Global `body` margin/background/font/colour and `* { box-sizing }`. |
| `index.css`, `App.module.css` | `#root`, `.magid-outer-background`, `.app`: `min-height: 100vh`. |
| `MenuScene.tsx` | `-mg-window-width/-height` set `document.documentElement.style.width/height`, which resizes the host's `<html>`. |
| `store/magidStore.ts` | `viewport: maximized` → `document.documentElement.requestFullscreen()` fullscreens the whole page. |
| `VisualFade.tsx`, `ToastContainer`, `OptionsModal`, `ServerStatsDashboard` | `position: fixed`: a fade blacks out the whole viewport, and toasts sit in the window's corner. |
| `NarrationText.tsx`, `ServerStatsDashboard.tsx` | `keydown` on `window`: Escape anywhere on the page skips typing. |
| `prefs/prefHelper.ts`, core `STORAGE_KEYS` | Unprefixed `localStorage` keys (`server.address`, `music.volume`, session id). |
| `store/magidStore.ts`, `main.tsx` | One module-level `MagidClient`/zustand store, mounted into a hard-coded `#root`: one Magid per page. |

The other way round, the host's CSS reaches Magid. Inherited properties (font, colour, line-height) always do, and a
host's `button { … }` or `div { … }` rules restyle Magid's buttons and panes.

## Design

### 1. An entry point instead of `main.tsx`

- `mountMagid(element, options): { unmount() }` in a new `src/embed.tsx`. `main.tsx` becomes
  `mountMagid(document.getElementById('root')!, { mode: 'app' })`, so the full app uses the same path.
- Options (all optional except where noted):
  - `baseUrl`;
  - `story`, the XML to start with;
  - `chrome: 'full' | 'story'` (`'story'` hides the welcome/lobby pages, header buttons, Options and Stats; the
    embedding operator picks the server and story);
  - `isolation: 'shadow' | 'none'`;
  - `storagePrefix`;
  - `fullscreen: 'element' | 'off'`;
  - `clientConfig` overrides (today's compiled-in `clientConfig.ts` becomes the default).
- Optional later: a custom element `<magid-story server="…" story="…">` that calls `mountMagid` on itself, so a
  host needs only HTML.

### 2. One client per mount

- The store module stops creating `magidClient` at import. `mountMagid` creates the `MagidClient` and a zustand store,
  and passes them down through a React context. `useMagidStore` keeps its signature, so components don't change.
- `unmount()` tears down React, the client's subscriptions, the audio, the injected stylesheets and the blob URLs.
- This also makes two Magids on one page possible. It isn't a goal, but the design shouldn't rule it out.

### 3. CSS isolation: a shadow root (default), scoping as a fallback

**Shadow root (`isolation: 'shadow'`):** `mountMagid` attaches a shadow root to the element and renders React into
it. React 17+ handles events in a shadow root.
- The app's own CSS (`index.css` and the CSS modules) is injected into the shadow root, not into `<head>`. With Vite
  that means `?inline` imports, or collecting the emitted CSS at build time. `body` rules become `:host`, and `:host`
  also gets `all: initial` plus the app's base font/colour, so the host's inherited styles stop at the border.
- Story stylesheets: `syncStylesheets` takes a target (`document.head` or the shadow root) instead of always using
  `document.head`. Inside a shadow root, `:root`, `html` and `body` selectors match nothing, so they're rewritten to
  `:host` before the sheet is injected. That's why the CSS is always fetched as text and attached as a
  `<style>`/blob (today that happens only when a session header is sent).
- `@font-face` doesn't work inside shadow roots in Chromium, so those rules are lifted into `<head>` (deduplicated)
  and the rest stays in the shadow root.
- `100vw`/`100vh` in story CSS keep meaning the window. Stories that should embed well use `%` or container units;
  this goes in the authoring docs, and the CSS isn't rewritten for it.

**Scoping (`isolation: 'none'`)**, for hosts that need to style Magid themselves or can't use shadow DOM: story and
app CSS go into `<head>`, with every selector prefixed by the mount's id (`#magid-app .x`), `:root`/`html`/`body` →
the mount element, and `*` → `#magid-app *`. This is leakier (the host's rules still reach in) but simple to reason
about.

Both need the same string transform (selector rewriting, `@font-face` extraction). It has no DOM and no React, and a
plain-page client needs it just as much, so it belongs in **the core**:
`scopeStylesheet(cssText, { scope: ':host' | '#id' }) → { css, fontFaces }`. Use a small CSS tokenizer, not regexes,
because of `@media`/`@supports` nesting, strings and comments.

### 4. Sizing: the container decides

- Embedded: the root fills the element (`height: 100%`, or the content's natural height when the host gives none).
  Every `100vh` in the app's CSS becomes the container's height, with `100vh` kept only for `mode: 'app'`.
- `-mg-window-width/-height`: in the full app they keep resizing the document (current behaviour). Embedded, they
  size the mount's root instead, or they're ignored by an option. The host's `<html>` is never touched.
- `MagidRoot` is already `position: relative`, so `-mg-abs-x/-y` stay relative to the Magid area in both modes.

### 5. Overlays, keys, fullscreen

- Fades and toasts: `position: absolute` inside the root (which becomes `position: relative; overflow: hidden`) when
  embedded. Options/Stats modals can stay `fixed`, but render inside the shadow root or mount (portal target from
  context), never into `document.body`. A transformed host ancestor makes `fixed` relative to that ancestor; that's
  acceptable.
- Keys: listeners move from `window` to the root element, which gets `tabIndex=0` and takes focus on first click.
  Escape skips typing only when Magid has focus.
- Fullscreen: `viewport: maximized` calls `requestFullscreen()` on the mount element (`fullscreen: 'element'`).
  Embedded, the default is `'off'`, because fullscreening on a server's say-so is rude inside someone else's page;
  the host can opt in. The `VIEWPORT_IGNORE_MAXIMIZE` pref still applies.

### 6. Storage, audio, URLs

- `prefs` and the core's `KeyValueStorage` adapter get `storagePrefix` (default `''` in app mode, `magid.` when
  embedded), so keys can't collide with the host's.
- Background music: one `useAudio` per mount, stopped on `unmount()`. Autoplay rules are the same as in the app.
- Asset URLs: the embed bundle loads its chunks relative to its own URL (`import.meta.url` / Vite `base: './'`),
  not the host page's.

### 7. Build

- The app build stays `vite build` → `dist/` (full app).
- A second Vite library build → `dist-embed/magid-embed.js` (ES module, React bundled in, CSS inlined) plus
  `magid-embed.d.ts`. React as a peer dependency (for hosts that already use React) can come later.
- Example host page `examples/embed.html`: page text above and below, a `<section>` with Magid, host CSS with
  aggressive `button`/`div` rules, so leaks show up in both directions.

### 8. Server side (not changed from here)

- CORS: an embedding host page is a new origin. `magid.server.allowed-cors-origins` (now
  `localhost,127.0.0.1`) must list it. The app's API calls and the CSS fetches (`resolve-magid-protocol`) both need
  it. Document this in the embedding docs. `Magid-Session` is already in the server's allowed CORS headers.

## Steps

Each step leaves both modes working. Steps 1 and 2 change nothing visible.

1. **Core: `scopeStylesheet`** with tests: `:root`/`html`/`body` → scope, `*`, selector lists, `@media`/`@supports`,
   `@font-face` extraction, `@import` (resolve or leave), comments/strings. Minor version bump.
2. **rct: per-mount client and store** (`mountMagid`, context, `unmount`); `main.tsx` uses it. Storage prefix.
3. **rct: targets instead of globals**: stylesheet target, portal target, key-listener target, fullscreen target and
   sizing all come from the mount context. App mode passes `document`-level targets, so behaviour is unchanged.
4. **rct: shadow-root isolation**: the app's CSS into the shadow root, story CSS through `scopeStylesheet`,
   `:host` reset.
5. **rct: embedded defaults**: `chrome: 'story'`, contained overlays, `fullscreen: 'off'`, container sizing, scoping
   fallback.
6. **Embed build and example page**; check oasis, aliasworld (`:root` vars, `*`, `body`) and blutgruppen in the
   example page in both isolation modes, and the full app unchanged.
7. **Docs**: README "Embedding" (iframe vs `mountMagid`, options, CORS), CLAUDE.md architecture, authoring notes
   for story CSS that embeds well (no `100vh`, no reliance on `body`).

## Decisions for the owner

- **Default isolation:** shadow root (recommended: real isolation both ways) or scoping (host can style Magid)?
- **Chrome when embedded:** story only (recommended), or keep the header/Options for embedders who want them?
- **Fullscreen when embedded:** off by default, with the host opting in (recommended)?
- **`-mg-window-width/-height` when embedded:** size the Magid area (recommended), or ignore them?
- **React for hosts:** bundled only at first (recommended), or also a peer-dependency build right away?
- **`scopeStylesheet` in the core:** yes (recommended, the `-pure` client needs it too)?

## Risks

- Story CSS written for a full page (`100vh`, `position: fixed`, `body` backgrounds) will look different in a
  container. It's correct but surprising, so the authoring notes need examples.
- Fonts: the `@font-face` lifting must deduplicate and must not rename font families.
- Host pages with a strict CSP may block blob/`<style>` injection; the docs should list the CSP needs (`style-src`
  with blob:/nonce, `connect-src` for the server).
