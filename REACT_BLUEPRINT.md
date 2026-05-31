# Magid React Client — Blueprint

This document is a self-contained kickstart for a new Claude session tasked with building
a React web client for the **Magid** interactive-fiction engine.

---

## What is Magid?

Magid is a server-side text-adventure / interactive-fiction engine (`com.zarterstein` project with an idea to enter enterprise at some point: onboarding, scenario-training etc.).
It exposes an HTTP API that returns JSON describing scenes. A client renders those scenes:
story text, choice buttons, visual transitions, background music, and dynamic CSS theming.

This React app replaces an existing JavaFX desktop client (`magid-jfx-client`).
The server API contract (JSON protocol) does not change — only the rendering layer changes.

---

## Server API

All requests are `GET` to the base URL with a `?cmd=` query parameter.

```
GET {baseUrl}?cmd={command}
GET {baseUrl}?cmd=set-xml&path={xmlPath}
GET {baseUrl}?cmd=server-status
GET {baseUrl}?cmd=list-xmls
GET {baseUrl}?cmd=reload-xml
```

The default dev server URL is `http://localhost:8090`.

Responses are JSON. The `magid://` anchor in any response string must be replaced
with the base URL (e.g. `magid://foo.css` → `http://localhost:8090/foo.css`).

---

## JSON Protocol — Complete Reference

The server sends a **single JSON object** per response. Keys determine element type.

### `menu` — A scene (description text + player choices)

```json
{
  "menu": "scene-identifier",
  "menu-description": "Text shown to the player.",
  "menu-options": [
    { "command-name": "go-north", "command-description": "Go north" },
    { "command-name": "look",     "command-description": "Look around", "command-class": "my-btn" }
  ],
  "menu-class": "css-class-name",
  "menu-css":   "color: red; font-size: 14px;",
  "menu-background-music": "magid://audio/theme.mp3"
}
```

### `narration` / `text` — Prose text (both keys are valid aliases)

```json
{ "narration": "You hear footsteps.", "class": "scene-text", "css": "color: white;", "defer": "500" }
{ "text":      "The door opens.",     "class": "scene-text" }
```

`defer` is milliseconds (as a string) to wait before rendering this element.

### `command` — A standalone player action button

```json
{ "command-name": "attack", "command-description": "Attack!", "command-class": "btn-red", "command-defer": "200" }
```

### `config` — Client configuration (processed first, not rendered)

```json
{
  "config": {
    "css-files": "magid://styles/main.css;magid://styles/theme.css",
    "view-port": "maximized",
    "menu-position": "center"
  }
}
```

`css-files` is semicolon-separated. All other keys are arbitrary client variables.

**Known client variable effects:**
- `view-port: maximized` → maximise the browser window / go fullscreen
- `menu-position: center` → centre the game panel (not yet implemented in JFX reference either)

### `visual` — Fade/unfade transition (There will be more transitions; this must be modular.)

```json
{
  "visual": "transition",
  "transition-type": "fade",
  "transition-length": "800",
  "transition-target": "#000000",
  "transition-blocking": "true"
}
```
`visual`: Currently, of visual there are only "transitions", but later more types of visual effects/filters/etc might be added.
`transition-type`: `"fade"` (opacity 1→0) or `"unfade"` (opacity 0→1).
`transition-blocking: "true"` means subsequent elements must wait until this transition ends.

### `responses` — Container for multiple elements

```json
{
  "responses": [
    { "visual": "", "transition-type": "fade", "transition-length": "400", "transition-blocking": "true" },
    { "narration": "The room goes dark.", "defer": "450" },
    { "menu": "dark-room", "menu-description": "You can't see anything.", "menu-options": [...] }
  ]
}
```

---

## Typewriter Animation Protocol

Any display text containing the string `DCSTP_` triggers typewriter animation.

Format: `DCSTP_delay@text_segment` — the prefix splits the string into timed segments.
Each segment is `{milliseconds}@{text}` where the number is cumulative offset from the start.

Example: `DCSTP_0@Hello, DCSTP_500@world!`
- At t=0ms: append "Hello, "
- At t=500ms: append "world!"

If a segment has no `@`, it is appended at the current cumulative offset with no additional delay.

---

## CSS Theming

Servers send CSS files via the `config` element. These files use standard CSS class names
(`.magid-default-narration`, `.magid-common-button`, etc.) and may include `:hover` rules.
The client must inject these stylesheets into the page dynamically.

Server-sent inline `css` fields use web CSS syntax (not JavaFX syntax). They may contain
custom properties:
- `-mg-abs-x`, `-mg-abs-y` — absolute pixel position
- `-mg-window-width`, `-mg-window-height` — resize the viewport
- `-mg-window-resizable` — boolean
- `filter: blur(5)` — apply CSS filter (map directly to CSS `filter:` property)

Default CSS class names applied by the client (server can override):
- Response pane: `magid-response-pane`
- Outer background: `magid-outer-background`
- Menu text area: `magid-menu-textarea`
- Narration: `magid-default-narration`
- Command button: `magid-common-button`
- Button nth-of-n: `button-{i}-of-{n}` (e.g. `button-1-of-3`)

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand |
| HTTP | `fetch` (native) |
| Styling | CSS Modules + dynamic `<style>` injection |
| Audio | `<audio>` element / Web Audio API |
| Preferences | `localStorage` wrapper |

No Redux, no React Router needed for v1.

---

## File Structure

```
src/
├── api/
│   └── magidClient.ts          # All HTTP calls to the Magid server
│
├── types/
│   └── protocol.ts             # TypeScript types for every server JSON shape
│
├── lib/
│   ├── elementFactory.ts       # Parses a server JSON object → ParsedElement[]
│   ├── cssUtils.ts             # Resolves magid:// anchors, injects <style> tags
│   └── textTimeline.ts         # Splits DCSTP_ text into timed segments
│
├── store/
│   └── magidStore.ts           # Zustand store: connection state, elements, env vars
│
├── hooks/
│   ├── useMagidCommand.ts      # Sends a command, updates store with response
│   ├── useTypewriter.ts        # Drives the typewriter animation for a text string
│   └── useAudio.ts             # Background music management
│
├── components/
│   ├── MagidRoot.tsx           # Top-level renderer — dispatches to sub-components
│   ├── ResponsesContainer.tsx  # Renders a `responses` array
│   ├── MenuScene.tsx           # Renders a `menu` (text + buttons)
│   ├── NarrationText.tsx       # Renders a `narration` / `text`
│   ├── CommandButton.tsx       # Renders a `command` button
│   ├── VisualFade.tsx          # Renders a `visual` transition
│   └── OptionsModal.tsx        # Settings panel (server URL, XML selector, toggles)
│
├── prefs/
│   └── prefHelper.ts           # localStorage read/write wrapper
│
├── App.tsx                     # App shell: connection bar + MagidRoot
├── App.module.css
└── main.tsx
```

---

## Implementation Plan

Work through these phases in order. Each step is small enough to complete and verify
independently before moving on.

---

### Phase 1 — Project scaffold

**Step 1.1** — Create the Vite + React + TypeScript project:
```bash
npm create vite@latest magid-react-client -- --template react-ts
cd magid-react-client
npm install zustand
npm install --save-dev @types/node
```

**Step 1.2** — Clear the Vite boilerplate: empty `App.tsx`, delete `assets/react.svg`,
clear `App.css`. Keep `index.css` for global resets.

**Step 1.3** — Add a `/src/api/`, `/src/types/`, `/src/lib/`, `/src/store/`,
`/src/hooks/`, `/src/components/`, `/src/prefs/` directory structure (just create the folders).

**Checkpoint:** `npm run dev` serves a blank page with no console errors.

---

### Phase 2 — Types and API layer

**Step 2.1** — Create `src/types/protocol.ts`.
Define these TypeScript interfaces exactly matching the JSON protocol above:
- `MenuResponse`
- `NarrationResponse`
- `CommandResponse`
- `ConfigResponse`
- `VisualResponse`
- `ResponsesWrapper`
- `ServerResponse` (union of all the above)
- `XmlEntry` (from `list-xmls`: `{ name, description, path, absolutePath }`)
- `ServerStatus` (from `server-status`: `{ xmlPath, ... }`)

**Step 2.2** — Create `src/api/magidClient.ts`.

Key design rules:
- Every function is `async` and returns a `Promise`.
- No shared mutable state — each call is fully independent.
- Replace `magid://` anchors with `baseUrl` in every response string.

```ts
export const MAGID_ANCHOR = 'magid://';

export function resolveAnchors(text: string, baseUrl: string): string {
  return text.replaceAll(MAGID_ANCHOR, baseUrl);
}

export async function sendCommand(baseUrl: string, cmd: string, extra?: Record<string, string>): Promise<string>
export async function getXmlList(baseUrl: string): Promise<XmlEntry[]>
export async function serverStatus(baseUrl: string): Promise<ServerStatus>
export async function requestXml(baseUrl: string, xmlPath: string): Promise<string>
```

**Step 2.3** — Manually test the API layer against the live server from the browser console
or a small test script before proceeding.

**Checkpoint:** Calling `sendCommand('http://localhost:8090', '')` returns the server's
opening JSON string.

---

### Phase 3 — Element factory

**Step 3.1** — Create `src/lib/elementFactory.ts`.

Define a `ParsedElement` discriminated union:
```ts
export type ParsedElement =
  | { type: 'menu';      data: MenuResponse }
  | { type: 'narration'; data: NarrationResponse }
  | { type: 'command';   data: CommandResponse }
  | { type: 'config';    data: ConfigResponse }
  | { type: 'visual';    data: VisualResponse }
  | { type: 'responses'; elements: ParsedElement[] };
```

Implement `parseResponse(json: object, baseUrl: string): ParsedElement[]`.
Logic: iterate the keys of the JSON object; map known keys to element types using a lookup table
(same as `ResponseNodeType` enum in JFX). Unknown keys are silently ignored.

For `responses`, recursively call `parseResponse` on each item in the array.
Apply `resolveAnchors` to all string values during parsing.

Make it future-proof: your implementation should be easily extendable with new element types in the future. Use one source of truth for the allowed/active types. (Keep that in mind when going through step 7.6) 

**Step 3.2** — Write unit tests for `parseResponse` (Jest or Vitest).
Cover: single menu, single narration, responses container, config with css-files,
visual transition, unknown key ignored.

**Checkpoint:** All unit tests pass.

---

### Phase 4 — Store

**Step 4.1** — Create `src/store/magidStore.ts` using Zustand.

State shape:
```ts
interface MagidState {
  baseUrl: string;
  connected: boolean;
  elements: ParsedElement[];
  envVars: Record<string, string>;
  cssFileSources: Record<string, string>;   // filename → CSS text
  isLoading: boolean;
  error: string | null;

  // Actions
  setBaseUrl: (url: string) => void;
  setConnected: (v: boolean) => void;
  loadResponse: (raw: string) => void;      // parse JSON, apply Config, set elements
  sendCommand: (cmd: string) => Promise<void>;
  addCssFile: (name: string, content: string) => void;
  clearCssFiles: () => void;
  setVar: (name: string, value: string) => void;
  getVar: (name: string) => string | undefined;
  isVar: (name: string, expected: string) => boolean;
}
```

**Step 4.2** — Implement `loadResponse`. It must:
1. Parse the raw JSON string with `parseResponse`.
2. If any element has `type === 'config'`, process it immediately (load CSS files, set vars)
   before updating the elements list.
3. Update `elements` with only the non-config elements (config is never rendered).

**Step 4.3** — Implement the `setVar` side-effect handler (replaces `ClientVar`):
```ts
// Inside setVar action, after envVars.put:
if (name === 'view-port' && value === 'maximized') {
  document.documentElement.requestFullscreen?.();
}
// 'menu-position' is unimplemented — log a warning and skip
```

**Checkpoint:** Calling `store.sendCommand('')` populates `store.elements` with parsed data.

---

### Phase 5 — CSS utilities

**Step 5.1** — Create `src/lib/cssUtils.ts`.

Implement `injectStylesheet(name: string, cssText: string): void`.
Creates a `<style>` tag with `data-magid-file={name}` and appends it to `<head>`.
If a tag with that name already exists, replace it.

Implement `clearInjectedStylesheets(): void`.
Removes all `<style>` tags with `data-magid-file` attribute.

**Step 5.2** — Wire CSS injection into the store's `addCssFile` and `clearCssFiles` actions.
The store should call `injectStylesheet` / `clearInjectedStylesheets` from `cssUtils`.

**Step 5.3** — Implement `src/lib/textTimeline.ts`.

```ts
export interface TextSegment {
  offsetMs: number;
  text: string;
}

export function hasTypewriterAnimation(text: string): boolean
export function parseTextSegments(raw: string): TextSegment[]
```

Logic: split on `DCSTP_`, then split each piece on `@` (max 2 parts).
The first part is the delay in ms (cumulative), the second is the text to append.
Accumulate the cumulative offset across segments.

**Checkpoint:** `parseTextSegments('DCSTP_0@Hello DCSTP_500@world')` returns
`[{ offsetMs: 0, text: 'Hello ' }, { offsetMs: 500, text: 'world' }]`.

---

### Phase 6 — Hooks

**Step 6.1** — Create `src/hooks/useTypewriter.ts`.

```ts
export function useTypewriter(raw: string, skip: boolean): string
```

- If `skip` or `!hasTypewriterAnimation(raw)`: return `raw` immediately.
- Otherwise: parse segments, schedule `setTimeout` calls to build up `displayed` state.
- **Cleanup:** return a cleanup function from `useEffect` that calls `clearTimeout`
  on all pending timeouts. This prevents stale updates if the component re-renders
  with new text before the animation finishes.

**Step 6.2** — Create `src/hooks/useAudio.ts`.

```ts
export function useAudio(src: string | undefined, volume: number): void
```

- Creates an `<audio>` element when `src` is set, plays it at `volume`.
- Cleans up (pause + remove) on unmount or when `src` changes.

**Step 6.3** — Create `src/hooks/useMagidCommand.ts`.

```ts
export function useMagidCommand(): (cmd: string) => void
```

Returns a stable callback that calls `store.sendCommand(cmd)`.
Handles loading state and surfaces errors from the store.

---

### Phase 7 — Components (bottom-up)

Build components in dependency order: leaves first, container last.

**Step 7.1 — `CommandButton.tsx`**

Props: `data: CommandResponse`, `onClick: (cmd: string) => void`.
- Renders a `<button>`.
- Applies `command-class` and `magid-common-button` as CSS classes.
- Applies inline style from `command-css` if present.
- Calls `onClick(data['command-name'])` on click.
- Respects `command-defer` (render after N ms using `useState` + `useEffect` with timeout).

**Step 7.2 — `NarrationText.tsx`**

Props: `data: NarrationResponse`.
- Reads `ignoreTextTimelines` setting from prefs.
- Uses `useTypewriter(text, ignoreTextTimelines)` to get the displayed string.
- Renders a `<p>` or `<div>`.
- Applies `class` from data and `magid-default-narration` as CSS classes.
- Respects `defer`.

**Step 7.3 — `VisualFade.tsx`**

Props: `data: VisualResponse`, `onComplete?: () => void`.
- On mount: triggers a CSS transition (opacity 1→0 for `fade`, 0→1 for `unfade`)
  using `transition-length` ms.
- If `transition-blocking: "true"`: calls `onComplete` after the transition ends
  so the parent container knows when to render the next element.
- Use `useEffect` + `setTimeout` + CSS class toggling.

**Step 7.4 — `MenuScene.tsx`**

Props: `data: MenuResponse`.
- Renders the description text in a `<div>` (with optional typewriter effect).
- Renders one `<CommandButton>` per item in `menu-options`.
- Applies `menu-class` and button position classes (`button-{i}-of-{n}`).
- Uses `useAudio` with `menu-background-music` if present.
- Handles `-mg-window-width` / `-mg-window-height` via `document.documentElement` style
  if those CSS properties are present in `menu-css`.

**Step 7.5 — `ResponsesContainer.tsx`**

Props: `elements: ParsedElement[]`.
- Iterates elements in order.
- For `visual` with `transition-blocking: "true"`: renders only that element first,
  waits for `onComplete`, then renders the remaining elements.
  Use `useState` to track how many elements have been "unlocked".
- For all other elements: render immediately.
- Delegates each element to `MagidRoot`.

**Step 7.6 — `MagidRoot.tsx`**

Props: `elements: ParsedElement[]`.
- Switch on `element.type` and render the correct component.
- This is the central dispatch — keep it thin.

```tsx
export function MagidRoot({ elements }: { elements: ParsedElement[] }) {
  return (
    <div className={styles.responsePane}>
      {elements.map((el, i) => {
        switch (el.type) {
          case 'menu':      return <MenuScene       key={i} data={el.data} />;
          case 'narration': return <NarrationText   key={i} data={el.data} />;
          case 'command':   return <CommandButton   key={i} data={el.data} onClick={sendCmd} />;
          case 'visual':    return <VisualFade      key={i} data={el.data} />;
          case 'responses': return <ResponsesContainer key={i} elements={el.elements} />;
          default:          return null;
        }
      })}
    </div>
  );
}
```

**Checkpoint after Phase 7:** Load a story from the server. Menu scenes with buttons,
narration text (with and without typewriter), and fade transitions all work.

---

### Phase 8 — Preferences and Options panel

**Step 8.1** — Create `src/prefs/prefHelper.ts`.

```ts
export const prefs = {
  get:        (k: string, fallback = '') => localStorage.getItem(k) ?? fallback,
  getBoolean: (k: string) => localStorage.getItem(k) === 'true',
  getDouble:  (k: string) => parseFloat(localStorage.getItem(k) ?? '0') || 0,
  set:        (k: string, v: string)  => localStorage.setItem(k, v),
  setBoolean: (k: string, v: boolean) => localStorage.setItem(k, String(v)),
  setDouble:  (k: string, v: number)  => localStorage.setItem(k, String(v)),
};
```

Preference keys (matching the JFX client):
- `server.address` — string
- `story.xml` — string (path of the active story XML)
- `startup.arm.xml` — boolean
- `narration.ignoretimelines` — boolean
- `narration.ignoretexttimelines` — boolean
- `viewport.ignoremaximization` — boolean
- `music.volume` — double (0.0–1.0)

**Step 8.2** — Create `src/components/OptionsModal.tsx`.

Features:
- Server address text input (saves to `server.address`).
- XML list dropdown: fetched from `getXmlList(baseUrl)`. Selecting one calls `requestXml`.
- Checkboxes for the four boolean prefs.
- Volume slider (0–1) for `music.volume`.
- "Save" button writes all prefs; "Cancel" reverts in-memory changes.
- Display the currently active XML path.

**Checkpoint:** Changing server address, selecting a new XML, and toggling options
persists across page reloads.

---

### Phase 9 — App shell and connection flow

**Step 9.1** — Create `App.tsx`.

Layout:
```
┌─────────────────────────────────────────────────────┐
│ [☰ Options]              [status message label]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│              MagidRoot (game canvas)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

On mount:
1. Read `server.address` from prefs (fallback: `http://localhost:8090`).
2. Call `serverStatus(baseUrl)` silently to check connectivity.
3. If `startup.arm.xml` is true and `story.xml` is set, call `requestXml`.
4. Call `sendCommand('')` to load the opening scene.

**Step 9.2** — Implement the status message bar.

The status bar shows transient messages (e.g. "Server reloaded", "Could not connect").
Use a `setTimeout`-based approach — not threads:
```ts
function showMessage(text: string, durationMs = 5000) {
  setStatusMessage(text);
  setTimeout(() => setStatusMessage(''), durationMs);
}
```

**Step 9.3** — Wire the "Establish Connection" button.
On click: read prefs, create a new store connection, call `sendCommand('')`.

**Checkpoint:** Full end-to-end: app loads, connects to server, renders the opening scene,
player can click buttons and advance the story.

---

### Phase 10 — Polish and edge cases

**Step 10.1** — Error handling.
- If `sendCommand` fails: show error in status bar, do not clear the current scene.
- If JSON parse fails: show "Server returned unexpected data" in status bar.
- If CSS file fetch fails: log to console, skip that file silently.

**Step 10.2** — Loading state.
- While a command is in-flight: disable all `CommandButton` elements to prevent double-sends.
- Optional: show a subtle spinner in the status bar area.

**Step 10.3** — Reset on new scene.
When a new response arrives, clear injected CSS stylesheets before processing the new
`config` element (mirrors `client.clearCssFiles()` in the JFX client).

**Step 10.4** — Accessibility.
- All buttons must have accessible labels.
- Typewriter text should complete immediately if the user presses `Escape`.

**Step 10.5** — Manual regression test checklist.
Run through this against a live server:
- [ ] Opening scene renders correctly
- [ ] Clicking a command loads the next scene
- [ ] Narration typewriter effect plays and finishes
- [ ] Skip / ignore-timelines toggle works
- [ ] Fade and unfade transitions block the next element correctly
- [ ] Background music starts on a menu that uses it
- [ ] CSS from the server's `config` element styles the scene
- [ ] Options panel saves server address and survives reload
- [ ] Changing XML in options loads the new story
- [ ] Status bar shows and clears messages

---

## Known Intentional Gaps (do not fix in the React port)

These items exist in the JFX reference client and are acknowledged as out-of-scope:

- `menu-position` client variable — the handler exists in JFX but is dead code (`if(true) return`).
  In React: accept the var, log a `console.warn`, and skip.
- `magid://` CSS protocol handling for JavaFX stylesheets — irrelevant in React; use standard URLs.

---

## Key Design Rules for This Session

1. **No shared mutable module-level state.** Every piece of state lives in the Zustand store
   or component-local `useState`. No static singletons.

2. **Every `useEffect` that adds an event listener must return a cleanup function**
   that removes it. This is the React equivalent of the listener-leak fix in the JFX client.

3. **`fetch` is stateless.** Each call to `sendCommand` creates a fresh request. No connection
   object is stored between calls.

4. **TypeScript discriminated unions replace reflection.** The `ParsedElement` union with a
   `type` field replaces the `ResponseNodeType` enum + reflection factory. TypeScript's
   exhaustiveness checking will catch missing cases at compile time.

5. **CSS is CSS.** Server-sent `css` fields are standard web CSS. Inject them as inline `style`
   attributes or `<style>` tags. No conversion layer needed (unlike the JFX `-fx-` prefix hack).
