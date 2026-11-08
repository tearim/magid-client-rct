# Open issues

Problems found by AI agents while working in this repo, left **unfixed on purpose** for the owner to resolve.
Agents add new findings here instead of fixing code they weren't asked to touch (see `CLAUDE.md` → "Working with the owner").
Issues in the client core belong in its own repo's `OPEN-ISSUES.md` (`tearim/magid-client-core`).
Delete an entry once it's resolved. Each entry: what's wrong, where, why it matters, and a suggested fix.

## Rendering

### R7. An async text input loses focus when it sends `update-symbol` (2026-11-08)
- `InputElement.tsx` sends `update-symbol` 500 ms after the value rests. The core clears `elements` while the request
  runs, so `App.tsx` unmounts `MagidRoot` and remounts it with the response: the field being typed into is replaced.
  The JFX client has the same problem (its R2), and magid-client-js (its R1).
- Fix idea: remember the focused input's `input-name` and caret and restore them after the next render; or (core) keep
  the previous elements during an `update-symbol` request.

### R8. A failing `audio.play()` call takes the whole app down (2026-11-08)
- `hooks/useAudio.ts` calls `audio.play().catch(…)`. Where `play()` returns nothing (older browsers, jsdom), `.catch`
  throws inside the effect, and with no error boundary React unmounts the app (blank page). Found while porting it to
  magid-client-js.
- Fix idea: `void Promise.resolve(audio.play()).catch(() => {})` in a try; and an error boundary around `MagidRoot`.

## Tooling / hygiene

### H1. Lint baseline (magid-app): 14 errors (2026-11-08; 15 errors and 1 warning before useTypewriter used the core's typingSchedule)
- Mostly `react-hooks` rules (setState synchronously inside effects, reading/writing refs during render, a `useEffect`
  after an early return in `InputElement.tsx`) plus `prefer-const`.
  Files: `App.tsx`, `InputElement.tsx`, `MagidRoot.tsx`, `NarrationText.tsx` (most), `ResponsesContainer.tsx`,
  `ServerStatsDashboard.tsx`, `ToastContainer.tsx`, `useTypewriter.ts`, `renderText.tsx`.
- `npm run lint` lists them; `npx eslint . --fix` handles the 3 `prefer-const`.
