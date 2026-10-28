Pl# Open issues

Problems found by AI agents while working in this repo, left **unfixed on purpose** for the owner to resolve.
Agents add new findings here instead of fixing code they weren't asked to touch (see `CLAUDE.md` → "Working with the owner").
Issues in the client core belong in its own repo's `OPEN-ISSUES.md` (`tearim/magid-client-core`).
Delete an entry once it's resolved. Each entry: what's wrong, where, why it matters, and a suggested fix.

## Rendering

### R2. An implied `type-by-word-*` overrides an explicit `type-by-letter-*` (2026-10-21)
- `content/oasis/scenes/hermit.xmls:67` has `class="hermit-talking type-by-letter-40"`; the var
  `implied-classes-of: hermit-talking*` adds `type-by-word-50`. `getConsequentalTypingConfig` then sets both
  `typeEachLetter` and `typeEachWord`, and `NarrationText` checks word after letter, so the narration types by **word**
  (at 40 ms, the letter speed), against what the author wrote.
- Precedence between explicit and implied classes only works within the same family (first `type-by-word-*` wins).
- Fix idea: in `getConsequentalTypingConfig`, let whichever `type-by-*` class comes first in the string win, so explicit
  classes (always first) beat implied ones.

### R4. Menu "append" detached elements never appear when the description has `DCSTP_` markers (2026-10-23)
- `MenuScene.tsx`: `typingComplete = displayed === timeline`, but `useTypewriter` ends with the marker-free text, so with
  markers the comparison never holds and `appendEls` stay hidden. (Same before HTML support, with `rawDesc`.)
- Fix idea: compare with `resolveCleanText(timeline)`, as `NarrationText` does.

### R6. `by-anchor` placeholders are typed out letter by letter in menu descriptions (2026-10-28, from reading the code)
- The server writes the anchor (`INPUT_ANCHOR_<uuid>`, 49 characters) into the description text. The typewriter reveals
  it like prose, and `renderTextWithAnchors` (`renderText.tsx`) only swaps an anchor once it is complete, so the
  placeholder appears character by character before the input replaces it. The same problem the HTML tags had.
- Fix idea: in the core, treat a known anchor as one atomic unit in the timeline (zero or one visible character), the way
  `truncateHtml` treats tags; then `MenuScene` renders it whole. Needs the core to know the batch's anchors.

## Tooling / hygiene

### H1. Lint baseline (magid-app): 15 errors, 1 warning (2026-10-21; was 26 before R1, the core extraction and the store rewrite)
- Mostly `react-hooks` rules (setState synchronously inside effects, reading/writing refs during render, a `useEffect`
  after an early return in `InputElement.tsx`) plus `prefer-const`.
  Files: `App.tsx`, `InputElement.tsx`, `MagidRoot.tsx`, `NarrationText.tsx` (most), `ResponsesContainer.tsx`,
  `ServerStatsDashboard.tsx`, `ToastContainer.tsx`, `useTypewriter.ts`, `renderText.tsx`.
- `npm run lint` lists them; `npx eslint . --fix` handles the 4 `prefer-const`.
