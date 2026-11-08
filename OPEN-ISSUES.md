# Open issues

Problems found by AI agents while working in this repo, left **unfixed on purpose** for the owner to resolve.
Agents add new findings here instead of fixing code they weren't asked to touch (see `CLAUDE.md` → "Working with the owner").
Issues in the client core belong in its own repo's `OPEN-ISSUES.md` (`tearim/magid-client-core`).
Delete an entry once it's resolved. Each entry: what's wrong, where, why it matters, and a suggested fix.

## Rendering

## Tooling / hygiene

### H1. Lint baseline (magid-app): 15 errors, 1 warning (2026-10-21; was 26 before R1, the core extraction and the store rewrite)
- Mostly `react-hooks` rules (setState synchronously inside effects, reading/writing refs during render, a `useEffect`
  after an early return in `InputElement.tsx`) plus `prefer-const`.
  Files: `App.tsx`, `InputElement.tsx`, `MagidRoot.tsx`, `NarrationText.tsx` (most), `ResponsesContainer.tsx`,
  `ServerStatsDashboard.tsx`, `ToastContainer.tsx`, `useTypewriter.ts`, `renderText.tsx`.
- `npm run lint` lists them; `npx eslint . --fix` handles the 4 `prefer-const`.
