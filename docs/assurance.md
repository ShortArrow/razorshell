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
under assumptions A1–A8, razorshell's keybindings act on editable
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
| C1.14 | A kill is undoable, fires one input event the page can see, does nothing at the end of the value where the region is empty, and leaves readonly fields alone |
| C1.15 | Killed text lands on a frame-local ring: chained kills concatenate in readline order, Ctrl+Y yanks the newest entry, Alt+Y rotates with verified replacement, a password kill is never stored, and an empty-ring Ctrl+Y leaves the native key untouched |
| C1.16 | Word kills join the ring, character deletes remove whole graphemes without touching it, and both undo chords reach the native history |
| C1.17 | Case operations recase exactly one word and land at its end, transpose-words drags the earlier word past the later, and Ctrl+K at a line end kills the newline joining the lines |
| C1.18 | The reclaimed chords route by focus: assigned Ctrl+W rubs out a whitespace word inside a field and still closes the tab outside one, Ctrl+T transposes graphemes inside and still opens a tab outside — interception itself rests on the recorded manual measurement. The keymap table carries a row per chord that reads its binding from `chrome.commands`, grays an unassigned one, and reaches Chrome's shortcuts page, which a link cannot |

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
- 2026-09-05, a reserved chord can be reclaimed through the commands
  API: in a real Chrome, chrome://extensions/shortcuts accepted a
  manual `Ctrl+W` assignment for an extension command, and with a
  text field focused the chord reached the command instead of
  closing the tab (experiments/commands-probe, maintainer-observed,
  badge evidence). The harness cannot reproduce this — CDP keys skip
  the accelerator path — so it stays a manually measured fact.
- 2026-08-17, the kill operations destroy their text unrecoverably:
  in Playwright Chromium with the built extension, type, Ctrl+A,
  Ctrl+K, then Ctrl+Z leaves the field empty, while a native
  deletion (Shift+Home, Delete) in the same field undoes normally.
  Direct `.value` assignment clears the field's undo stack and fires
  no input event. (Superseded as of C1.14: the kill now runs through
  `execCommand`. The record stands as what was measured that day.)
- 2026-08-20, `document.execCommand` `insertText` and `delete` work
  on `input` and `textarea`: they fire `input` events with proper
  `inputType`s (`insertText`, `deleteContentBackward`,
  `historyUndo`) and the deletion undoes. With an EMPTY selection,
  `delete` acts as Backspace and removes one character — any rework
  built on it must not call it with an empty kill region.
- 2026-08-27, mutation panel over the kill ring, run before and after
  the yank-pop remediation. M1, the password kill stored anyway:
  red in three unit tests. M2, the yank-pop text check forced true:
  ALL GREEN before this remediation — no test in any suite could see
  a stale record replaced, which is what the page-rewrite e2e test
  now covers. M3, the ring keeping password text: red only in the
  e2e test that surfaces the secret into a visible field; no unit
  test distinguished it. M4, the empty-ring Ctrl+Y cancelled anyway:
  red on the pass-through assertion alone. M5, the deny path leaving
  the ring intact: red on the deny test alone. Each mutation was
  reverted and the revert confirmed by `git status`.
  Detection outside e2e exists for M1 only; M2 through M5 are held by
  the e2e suite, so a green unit run is not evidence for them.
- 2026-08-27, sensitivity of the three tests added by that
  remediation, each planted and reverted: the M2 mutation replanted
  turns the page-rewrite e2e red; dropping the caret condition from
  `canYankPop` turns the typing-after-yank e2e and two unit cases
  (U-y4, U-y5) red; dropping `clearYankRecord` from the deny path
  turns the deny e2e red. The weak element references in
  `killring.ts` and `yank.ts` have NO behavioral test — garbage
  collection cannot be forced from a test, so no assertion can tell a
  weak reference from a strong one, and that fix rests on reading.
- 2026-09-05, `event.key` for the chords v0.0.5 adds, read off
  `keydown` on a focused text input in Playwright Chromium
  (`channel: "chromium"`, headless): Alt+Backspace reports
  `"Backspace"` with `altKey` true and `shiftKey` false; Ctrl held
  while Shift+Minus is struck reports `key: "_"`, `code: "Minus"`,
  `ctrlKey` and `shiftKey` both true; Ctrl+Slash reports `key: "/"`,
  `code: "Slash"`, `shiftKey` false. Playwright's `press("Control+_")`
  shorthand disagrees with the keyboard: it fabricates `_` with
  `shiftKey` FALSE, which no physical layout produces, so the e2e
  tests press that chord in its down/up form. The bindings and
  test/undochords.test.ts rest on these values.
- 2026-09-05, the kill chain compared the wrong pair of caret
  positions, and had done so since the ring shipped. `isSamePlace`
  tested the previous kill's `caretAfter` against the new kill's
  `caretAfter` — whether both kills END in one place — where the
  question is whether the new kill BEGINS where the last one ended.
  A forward kill leaves the caret where it found it, so the two
  numbers coincide and every forward case passed; a backward kill
  pulls the caret left, so two of them could never match. Measured on
  the shipped build: Alt+Backspace twice from the end of
  "one two three" then Ctrl+Y returned "two " instead of
  "two three". Invisible until now because C-u twice kills an empty
  region the second time (nothing is recorded) and C-u then C-k at one
  caret has both kills reporting the same number by accident. Fixed by
  adding `caretBefore` to `KillRecord` and comparing it against the
  chain's `caretAfter`.
- 2026-09-05, sensitivity of the C1.16 evidence, planted and
  reverted: rebinding `undo_slash` off `/` turns the Ctrl+slash e2e
  test red with `received ""` — the field stays killed — so that test
  observes the binding rather than a native chord doing the work. The
  pre-batch build was also run against the new e2e block before the
  implementation landed: the M-d round trip failed with
  `expected "hello ", received "hello world"`, Alt+d having done
  nothing.
- 2026-09-05, `cursor.getTopOfWord` did not terminate for a caret with
  only separators behind it (`" "` at 1, `"  hello"` at 2): both of
  its backward loops ran below index 0, where `isStartOfWord` reads
  `text[-1]` as `undefined` and never reports a boundary. Alt+b
  tolerated it — a caret motion clamps a bad offset — so it surfaced
  only when the backward word kill tried to build a region from the
  result. Guarded at 0 and pinned under a deadline in
  test/topofword.test.ts, because a regression hangs the runner
  instead of failing an assertion.
- 2026-09-05, razorshell's `backward_kill_word` and the new
  `unix_word_rubout` are extensionally EQUAL, where readline's C-w and
  M-DEL are not. Readline delimits M-DEL with `rl_alphabetic`
  (isalnum) and C-w with whitespace, so `"foo bar-baz|"` separates
  them there; razorshell's word kill follows its own Alt+b motion
  (`cursor.getTopOfWord`), whose separator set is space, tab, newline
  and carriage return — the rubout's own boundary. An exhaustive
  search over every string up to length six on `{a, space, newline}`
  found no caret at which the two regions differ. The rubout is still
  defined in its own module rather than aliased, so that moving
  `getTopOfWord` to readline's boundary cannot silently drag it along;
  test/reclaimedregion.test.ts asserts the equality so that such a
  move goes red.
- 2026-09-05, a module shared between the options bundle and the
  service worker silently disables the worker. Importing
  `commandroute.ts` from `browserchords.ts` (options) made Vite emit
  `dist/commandroute.js` and rewrite `service.js` to `import` it; the
  manifest registers the worker with no `"type": "module"`, so it
  registered NO listeners. Observed as the toolbar badge never
  updating while the content script still reported `enabled: false`
  correctly and `chrome.action.setBadgeText` worked when called
  directly in the worker — three e2e badge assertions went red with
  no error anywhere. Fixed by duplicating the two command-name
  strings and pinning them from a test instead; `dist/service.js` and
  `dist/content.js` hash identically to the pre-change build.
- 2026-08-20, CDP-injected keys never reach Chrome's browser-
  accelerator handling on Windows and Linux (the native-event
  builder exists only for mac/ios, so injected events carry
  `skip_if_unhandled`), so whether a page handler can cancel a
  browser accelerator such as Alt+D is outside what this harness can
  ever test; the existing green runs for Ctrl+U and Alt+F prove
  nothing about interception, only real-browser use does.

## Verification and validation

The table above verifies: built as decided. Whether the decisions
are right — whether twenty bindings, first-match policy and a JSON
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
| R9 | Interception of the two reclaimed chords, and the browser-action arm that follows from it. C1.18's e2e evidence drives the MESSAGE path — the same run-operation message the command handler sends — because a reserved chord cannot be pressed under CDP (see R7 and the 2026-08-20 record). That the chord reaches the command at all, and that `tabs.remove`/`tabs.create` then run in its place, rests on the 2026-09-05 manual measurement, and the unfocused half of that measurement is itself unrecorded |
