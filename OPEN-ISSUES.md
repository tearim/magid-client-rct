# Open issues

Problems found by AI agents while working in this repo, left **unfixed on purpose** for the owner to resolve.
Agents add new findings here instead of fixing code they weren't asked to touch (see `CLAUDE.md` → "Working with the owner").
Delete an entry once it's resolved. Each entry: what's wrong, where, why it matters, and a suggested fix.

## Protocol / parsing

### P2. `-mg-*` inline CSS properties are dropped (2026-10-21)
- `magid-core/src/magidCss.ts` skips every property starting with `-mg-` (same line as `-fx-`). CLAUDE.md used to say they
  were converted (`-mg-abs-x`, `-mg-window-width`); they are not, so a story using them gets no effect in this client.
- Check what the JFX client does with them and whether stories use them (`grep -r "\-mg-" content/` in the server repo),
  then either map them (e.g. `-mg-abs-x` → `left` + `position: absolute`) or document them as JFX-only.

## Rendering

### R2. An implied `type-by-word-*` overrides an explicit `type-by-letter-*` (2026-10-21)
- `content/oasis/scenes/hermit.xmls:67` has `class="hermit-talking type-by-letter-40"`; the var
  `implied-classes-of: hermit-talking*` adds `type-by-word-50`. `getConsequentalTypingConfig` then sets both
  `typeEachLetter` and `typeEachWord`, and `NarrationText` checks word after letter, so the narration types by **word**
  (at 40 ms, the letter speed), against what the author wrote.
- Precedence between explicit and implied classes only works within the same family (first `type-by-word-*` wins).
- Fix idea: in `getConsequentalTypingConfig`, let whichever `type-by-*` class comes first in the string win, so explicit
  classes (always first) beat implied ones.

## Tooling / hygiene

### H1. Lint baseline (magid-app): 15 errors, 1 warning (2026-10-21; was 26 before R1, the core extraction and the store rewrite)
- Mostly `react-hooks` rules (setState synchronously inside effects, reading/writing refs during render, a `useEffect`
  after an early return in `InputElement.tsx`) plus `prefer-const`.
  Files: `App.tsx`, `InputElement.tsx`, `MagidRoot.tsx`, `NarrationText.tsx` (most), `ResponsesContainer.tsx`,
  `ServerStatsDashboard.tsx`, `ToastContainer.tsx`, `useTypewriter.ts`, `renderText.tsx`.
- `npm run lint` lists them; `npx eslint . --fix` handles the 4 `prefer-const`.
