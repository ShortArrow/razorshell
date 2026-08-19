# Assurance case

What the test suites assure, under which assumptions, up to which
boundary, and what risk remains. The suites hold every claim they
can express; this file holds the remainder — the claim and its
conditions, the hazard inventory, the out-of-scope line, frozen
measurement records, and residual risk. The claim-to-test mapping
lives in the suites as tags and is checked by a test, not repeated
here.

## Claim

C1: On a Chromium-based browser that loads unpacked MV3 extensions,
under assumptions A1–A7, razorshell's keybindings act on editable
fields exactly where the URL policy allows, and every setting changed
on the options page is written to `chrome.storage.sync`, takes effect
in open tabs without a reload, survives a browser restart, and
reports any write the browser refuses.

Acceptance criterion: every suite named in the evidence table passes
in CI (`.github/workflows/ci.yml`, jobs `check` and `snapshots`) on
the commit under assessment.

## Assumptions

| # | Premise |
|---|---|
| A1 | The browser is Chromium-based and accepts `--load-extension` (Playwright Chromium in the suites; branded Chrome Stable/Beta 137+ removed the flag) |
| A2 | The page admits content scripts (`chrome://` pages and the Web Store do not) |
| A3 | Key events come from real user input; untrusted synthetic events are ignored by design, not handled |
| A4 | Writes stay inside the sync quotas: 8 KB per item, 100 KB total, and Chrome's write-rate limits |
| A5 | No other code writes this extension's `sync` keys |
| A6 | Editable fields are `input` of type text, search, url, tel or password, `textarea`, and — behind the opt-in — `contenteditable`, including open shadow roots and same-process iframes |
| A7 | For the `auto` language setting, the browser UI language is one the packaged locales cover (see R2) |
| A8 | The OS is Windows or Linux and the keyboard layout reports the plain letter in `event.key` for Alt+letter chords, with the browser window not in fullscreen. macOS is outside this assumption: Option composes glyphs (`event.key` is `"ƒ"` for Option+F), so the shipped Alt bindings never match there, and the Command modifier is not part of the chord model |

## Boundary

Nothing is claimed about: the Google-account sync transport (the
suites exercise `storage.sync` as persistence inside one profile;
cross-device merge is never run), branded Chrome Stable/Beta 137 and
later (no unpacked loading), browser or OS crashes, interference
from other extensions, macOS in its entirety (A8), keyboard layouts
whose AltGr raises both `ctrlKey` and `altKey`, fullscreen windows
(Chrome's reserved-shortcut set inverts there), and the Storybook
dev preview during manual story-to-story navigation (the preview
reloads itself when a play function outlives a navigation; assurance
rests on the vitest and CI runs, not on the panel). Fields the
extension cannot reach — closed shadow roots, `email` and `number`
inputs — are not out of scope but a claim of their own: C1.11 says
they keep their native behavior.

## Hazards the suites are built against

Write refused by storage while the GUI already shows the new value;
an import applying some keys and not others; a rejected input
dirtying storage; a policy change not reaching an open tab; the
story-layer chrome mock diverging from the real API; an exported
file the importer refuses; a rendering readable in one theme only.

## Sub-claims

| Id | Property |
|---|---|
| C1.1 | Keybindings move the caret and selection as documented, in inputs, textareas, opt-in contenteditable, open shadow roots, iframes and dynamically added fields, and the opt-in itself reaches storage and open tabs |
| C1.2 | Untrusted synthetic events and IME composition never trigger a binding |
| C1.3 | URL rules apply first-match with the default action as fallback, and editing them through the real GUI — add, reorder, default-action change, delete — lands in real storage and flips the open tab's behavior and badge |
| C1.4 | Same-document navigations re-evaluate the policy |
| C1.5 | A rebind reaches storage in full chord form, open tabs, and a restarted browser; a conflict is refused without touching storage; per-row reset clears only its row; reset-all empties storage and unbinds the chord in an open tab |
| C1.6 | An import is atomic: a refused write applies none of its keys, in the mock and in real Chrome |
| C1.7 | Malformed or invalid input is rejected with the reason, leaves storage identical, and a corrected apply then succeeds |
| C1.8 | Every export re-parses through the importer |
| C1.9 | A refused write is shown beside the control and the view rolls back to what storage kept, in every settings section |
| C1.10 | The options page renders both themes with zero axe violations and zero undecided results |
| C1.11 | Fields the extension cannot reach — closed shadow roots, `email` inputs — keep their native behavior instead of dying half-handled |
| C1.12 | The language override resolves every packaged locale's tooltips, and a failed dictionary fetch falls back to the browser's own messages |
| C1.13 | A binding runs exactly once per keypress — settings churn, options-page remounts, same-document navigations and an abandoned rebind capture leave no duplicate or stale key handler behind |

## Traceability

The tests are the evidence, and they carry the mapping themselves: a
test or story supporting a sub-claim is tagged `@C1.x` — in its title
for Playwright and vitest, in its `tags` array for stories, at file
level where one spec generates its tests. This file does not repeat
the mapping; `test/assurance.test.ts` reads the sub-claim ids from
the table above, scans the suites for tags, and fails when a claim
has no tagged evidence or a tag names a claim that no longer exists.
`rg "@C1\." test tests src` prints the current matrix.

Suite commands: `pnpm test` (unit + stories), `pnpm test:e2e` (real
extension in Playwright Chromium), `pnpm test:storybook`
(screenshots and axe, both themes, win32 baselines).

The stories run against an in-memory chrome mock that structured-
clones values, keeps `local` and `sync` as separate areas, and omits
unstored keys from string-form `get`, matching the real API on every
point a divergence was found. What the mock is known not to settle
is listed under residual risk.

## Measurement records

Frozen observations; each holds only for its date.

- 2026-08-16, mutation check: replacing per-row reset with reset-all
  turned the ResetRow story red; rewriting the import into per-key
  writes turned C1.6's e2e test red in real Chrome. Both reverted.
- 2026-08-16, further deliberate-violation checks, all reverted after
  going red: the traceability gate in both directions (a removed tag,
  a fabricated tag), the locale sweep against the wrong locale's
  strings, the dictionary fallback blanked, one store's unsubscribe
  made a no-op, a bare storage `set` against the floating-promises
  rule, and a story dropped from the screenshot lists. Tests outside
  these records keep R4 open.
- 2026-08-16, real Chrome fires no `storage.onChanged` for a write
  whose value serializes to what the key already holds — measured
  counts 1/1/1 across an initial write, an identical rewrite and a
  deep-equal fresh object, reproduced twice. A redundant write cannot
  be used to wake listeners. The chrome mock mirrors this.
- 2026-08-16, Ctrl+Shift+9 under Playwright's `press` reports
  `KeyboardEvent.key === "9"`, not `"("` — the stored-chord
  assertions depend on this.
- 2026-08-17, the kill operations destroy their text unrecoverably:
  in Playwright Chromium with the built extension, type, Ctrl+A,
  Ctrl+K, then Ctrl+Z leaves the field empty, while a native
  deletion (Shift+Home, Delete) in the same field undoes normally.
  Direct `.value` assignment clears the field's undo stack and fires
  no input event.
- 2026-08-20, `document.execCommand` `insertText` and `delete` work
  on `input` and `textarea`: they fire `input` events with proper
  `inputType`s (`insertText`, `deleteContentBackward`,
  `historyUndo`) and the deletion undoes. With an EMPTY selection,
  `delete` acts as Backspace and removes one character — any rework
  built on it must not call it with an empty kill region.
- 2026-08-20, CDP-injected keys never reach Chrome's browser-
  accelerator handling on Windows and Linux (the native-event
  builder exists only for mac/ios, so injected events carry
  `skip_if_unhandled`), so whether a page handler can cancel a
  browser accelerator such as Alt+D is outside what this harness can
  ever test; the existing green runs for Ctrl+U and Alt+F prove
  nothing about interception, only real-browser use does.

## Verification and validation

The table above verifies: built as decided. Whether the decisions
are right — whether eight bindings, first-match policy and a JSON
file are what a vimmer wants — is validated only by use; the README's
planned section is the current answer, not a test.

## Residual risk

| # | Not assured |
|---|---|
| R1 | Chrome's write-rate limits (`MAX_WRITE_OPERATIONS_*`); the only refused real write the suites produce is one oversized item through the import path |
| R2 | The `auto` language under a non-English browser UI; every suite runs an English Chromium, so `auto` always resolves to English in tests |
| R3 | Concurrent edits from two devices merging through account sync |
| R4 | Test sensitivity outside the deliberate-violation checks the measurement records list: a test that cannot fail would count as evidence here without being any |
| R5 | An orphaned content script after an extension update or reload: Chrome leaves the old script's DOM listeners in place, so a binding can run twice until the page reloads — reproducing an update in the harness is not automated |
| R6 | The 102,400-byte total sync quota; only the 8 KB per-item limit is exercised |
| R7 | Interception of browser accelerators (Alt+F today, Alt+D if adopted): Chromium's source lists them outside the reserved set, but the harness cannot exercise that path (see the 2026-08-20 record), so the claim rests on real-browser use, not on a test |
| R8 | Everything A8 excludes, silently: on macOS the Alt bindings never match and Cmd+key can reach a binding as if unmodified; on AltGr layouts a Ctrl+Alt chord reaches the matcher with both modifiers set. No macOS runner exists in CI |
| R9 | Killed text is unrecoverable today — no kill ring, no clipboard, no undo (2026-08-17 record). Known defect, not an accepted property; the 0.0.4 plan exists to retire it |
