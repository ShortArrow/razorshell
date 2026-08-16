# Assurance case

What the test suites assure, under which assumptions, up to which
boundary, and what risk remains. This is a living document: when a
suite or a claim changes, this file changes with it. Test names are
the stable handles here; counts and timings are not recorded because
they rot.

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
| A7 | For the `auto` language setting, the browser UI language is one the packaged locales cover (see R3) |

## Boundary

Nothing is claimed about: the Google-account sync transport (the
suites exercise `storage.sync` as persistence inside one profile;
cross-device merge is never run), closed shadow roots, `email` and
`number` inputs (the platform exposes no selection API there),
branded Chrome Stable/Beta 137 and later (no unpacked loading),
browser or OS crashes, interference from other extensions, and the
Storybook dev preview during manual story-to-story navigation (the
preview reloads itself when a play function outlives a navigation;
assurance rests on the vitest and CI runs, not on the panel).

## Hazards the suites are built against

Write refused by storage while the GUI already shows the new value;
an import applying some keys and not others; a rejected input
dirtying storage; a policy change not reaching an open tab; the
story-layer chrome mock diverging from the real API; an exported
file the importer refuses; a rendering readable in one theme only.

## Evidence

Each sub-claim names the suite and the test or story that would fail
if it broke. Commands: `pnpm test` (unit + stories), `pnpm test:e2e`
(real extension in Playwright Chromium), `pnpm test:storybook`
(screenshots and axe, both themes, win32 baselines).

| Sub-claim | Evidence |
|---|---|
| C1.1 Keybindings move the caret and selection as documented, in inputs, textareas, contenteditable, open shadow roots, iframes and dynamically added fields | e2e: cursor motion, line deletion, textarea, dynamically added input, iframe, password, rich text describes |
| C1.2 Untrusted synthetic events and IME composition never trigger a binding | e2e: "synthetic key events are ignored"; unit: isComposing guards |
| C1.3 URL rules apply first-match with the default action as fallback, edited through the real GUI: each add, reorder, default-action change and delete lands in real storage and flips the open tab's behavior and badge | unit: urlrules; e2e: "url policy" and "url rules edited through the gui" describes |
| C1.4 Same-document navigations re-evaluate the policy | e2e: "a same-document navigation re-evaluates the policy" |
| C1.5 A rebind reaches storage in full chord form, open tabs, and a restarted browser; a conflict is refused without touching storage; per-row reset clears only its row; reset-all empties storage and unbinds the chord in an open tab | e2e: keymap rebinding and restart describes; stories: ResetRow, ConflictThenRecover, SaveFailure |
| C1.6 An import is atomic — a refused write applies none of its keys, in the mock and in real Chrome | e2e: "a failing import applies none of its keys"; story: ImportAtomicity |
| C1.7 Malformed or invalid input is rejected with the reason, leaves storage identical, and a corrected apply then succeeds | unit: settingsio rejects; e2e: malformed json test with full-storage snapshot compare; story: ImportRecovery |
| C1.8 Every export re-parses through the importer | e2e: export test's parseSettings round trip |
| C1.9 A refused write is shown beside the control and the view rolls back to what storage kept, in every settings section | stories: SaveFailure in url, keymap, theme, richtext, language, config |
| C1.10 The options page renders both themes with zero axe violations and zero undecided results | storybook screenshot suite, light and dark passes |

Two of these were checked for sensitivity by mutation: breaking
per-row reset into reset-all turns ResetRow red, and turning the
import into per-key writes turns C1.6's e2e test red in real Chrome.
The remaining tests have not had that check (R7).

The stories run against an in-memory chrome mock that structured-
clones values, keeps `local` and `sync` as separate areas, and omits
unstored keys from string-form `get`, matching the real API on every
point a divergence was found. What the mock is known not to settle
is listed under residual risk.

## Verification and validation

The table above verifies: built as decided. Whether the decisions
are right — whether eight bindings, first-match policy and a JSON
file are what a vimmer wants — is validated only by use; the README's
planned section is the current answer, not a test.

## Residual risk

| # | Not assured |
|---|---|
| R1 | Whether real `storage.onChanged` fires on a set whose value is unchanged; the mock always notifies, and code relying on either behavior would pass the stories |
| R2 | Chrome's write-rate limits (`MAX_WRITE_OPERATIONS_*`); the only refused real write the suites produce is one oversized item through the import path |
| R3 | The `auto` language under a non-English browser UI; every suite runs an English Chromium, so `auto` always resolves to English in tests |
| R4 | Locale dictionary loading beyond `ja`: the fetch-failure fallback and the other packaged locales are unexercised, and the dictionary layer is unreachable from stories |
| R5 | Storage change listeners are registered and never removed; growth across options-page remounts is invisible to every suite |
| R6 | Concurrent edits from two devices merging through account sync |
| R7 | Test sensitivity outside the two mutation-checked invariants: a test that cannot fail would count as evidence here without being any |
