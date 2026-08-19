# Changelog

Notable changes to Razorshell. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Design rationale lives in [docs/decisions](decisions/README.md).

## [Unreleased]

### Changed

- The assurance case now states its platform contract: A8 assumes
  Windows/Linux with a layout that reports plain letters for
  Alt+letter chords, macOS and AltGr layouts and fullscreen move to
  the boundary, and new records freeze what an adversarial review of
  the v0.0.4 plan measured — kills are unrecoverable today, what
  execCommand does and does not do, and why accelerator interception
  can only ever be verified in a real browser.

- Every shipped PNG — the four extension icons and the README banner
  — regenerates from its committed SVG source through the asset
  generator, and image/promotion.svg is written from the same
  palette and typography as the promo tiles, so no image depends on
  a manual export and the store art cannot drift from the tiles. The
  README demo media are centered.

## [0.0.3] - 2026-08-16

### Added

- A Sample button beside Export downloads config.sample.json, round-
  tripped through the importer so the file it hands out is one Apply
  accepts by construction.
- The theme toggle sits centered at the top of the options page.

- URL rules: each rule pairs a pattern (exact, glob or regex) with an
  allow or deny action. Rules apply in list order and unmatched pages
  follow a configurable default action (ADR-0001). The options page
  edits and reorders them; changes reach open tabs without a reload.
  Glob `*` and `?` stay inside one path segment, `**` crosses `/`
  (ADR-0002).
- The options test area shows the last keydown — the chord, whether
  the extension handled it, the event code — and the selection range
  of each test field.
- Keybindings can be rebound from the options page: each row shows
  the default and current chord, captures a new one on "rebind", and
  resets per row or all at once. A chord already held by another row
  is rejected with that row named (ADR-0004). Changes reach open
  tabs immediately, and a key match now runs only the first matching
  binding.
- The toolbar icon shows an "off" badge on tabs where the URL policy
  disables the keybindings, so the extension's own state is visible
  next to Chrome's site-access indicator. The two stay separate
  layers: Chrome decides whether the content script is injected at
  all, the policy decides whether an injected script acts.
- The dormant Lua section left over from the abandoned init.lua plan
  is gone from the options page.
- axe is now fully conclusive with nothing exempted: the select
  arrow is a real icon instead of the daisyUI background gradient,
  and tooltip bubbles exist in the DOM only while shown, so every
  background computes. That exposed dark-theme contrast failures on
  dimmed helper text that no gate had ever checked — the a11y run
  only exercised light — which are fixed, and the screenshot suite
  now asserts zero violations in both themes with only page-level
  structure rules set aside as inapplicable to lone components.
- The axe "needs review" backlog is resolved and guarded: an empty
  rule table shows a "no rules" row so header association is
  decidable, the page-level skip-link rule is off for component
  stories, and a budget assertion fails the suite if any
  inconclusive result appears beyond the two causes axe cannot
  compute — daisyUI's gradient select arrow and tooltip pseudo
  content, both contrast-verified by hand.
- The failure paths have their own coverage: stories drive a refused
  storage write, an empty pattern, the probe's default-action badge,
  a keymap conflict corrected afterwards, staging a config file and
  a browser reporting no languages, while the end-to-end suite
  checks that a denied SPA route flips the toolbar badge and that
  the extension recovers after each rejected input.
- docs/assurance.md states the claim the suites support — property,
  assumptions, boundary, acceptance criterion — and lists what
  remains unassured. The claim-to-test mapping lives in the suites
  as `@C1.x` tags, and a gate test fails when a sub-claim has no
  tagged evidence or a tag names a dropped claim, so the document
  and the suites cannot drift apart silently.
- The GUI-to-storage contract is exercised against the real
  extension: URL rules are added, reordered and deleted through the
  options page with the stored policy and the content script checked
  after each step, reset-all is proven to unbind the chord in an
  open tab, a failing import is shown to apply none of its keys in
  real Chrome, and every export re-parses through the importer. The
  chrome mock behind the stories now clones values, keeps local and
  sync apart and omits unstored keys, like the real API.
- Six more story scenarios close the review's coverage gaps:
  switching the language, a handled chord in the test area, removing
  a rule, a rejected regex pattern, the inspect-mode hint, and a
  two-modifier override — the last of these exposed and fixed one
  more low-contrast text.
- Stories run as tests: the Storybook vitest addon executes every
  story in a real Chromium alongside the unit suite, play functions
  drive interactions (adding a rule, rebinding by keyboard, the rich
  text toggle persisting), and axe accessibility checks fail the run
  on violations. The audit fixed missing accessible names on selects
  and icon buttons, empty table headers, low-contrast helper text,
  and a success badge pairing that sat at 4.24:1 against the 4.5:1
  requirement.
- Storybook covers the options page components: thirteen stories
  with an in-memory chrome mock, each pinned by a screenshot
  comparison, and the story build compiles in CI.
- The end-to-end suite lives in tests/e2e (30 Playwright tests
  covering the content script, options page, live policy and keymap
  propagation, SPA navigation, legacy-key migration and
  restart persistence) and runs in CI on every push and before every
  release; releases previously shipped with only unit tests, lint
  and a build.
- Settings export and import: a Config section downloads every
  setting as versioned JSON and applies a pasted or chosen file back,
  validating it with the failing field named (ADR-0008 records why
  this replaced the init.lua plan). config.sample.json in the
  repository shows the format and is kept valid by a test.
- Rich text editor support, off by default (ADR-0005): a toggle on
  the options page applies the keybindings inside contenteditable
  editors, with Ctrl+a/e/k/u working on the visual line. Editors and
  fields inside open shadow roots are reached as well. The inspector
  can probe editable targets when the toggle is on.
- Conflict inspector: clicking the extension icon puts the page in
  inspect mode; clicking a text field reports, as an in-page toast
  and in the console, which of the current bindings the page already
  handles. Nothing is dispatched (ADR-0006): handler code recorded
  by a first-party page hook is analyzed statically, listeners that
  resist analysis are counted openly, and a binding becomes a
  confirmed conflict once the page is seen cancelling it during real
  typing. The content script also ignores untrusted synthetic key
  events.
- A URL tester above the rule list: type a URL and the first rule it
  hits is highlighted, with the resulting action shown as a badge —
  including when only the default action applies.
- Tooltips on the options page controls — default policy, match
  type, rule action, rule ordering, language select, test area — in
  all eleven locales.
- The options page language can be overridden from a select listing
  the eleven packaged locales, with "auto" following the browser as
  before. The current effective language is shown next to it. The
  extension name and description stay in the browser language; Chrome
  resolves those itself.

### Changed

- A promise in src/ must be awaited, handled or explicitly `void`-ed:
  type-aware `no-floating-promises` now guards the discipline the
  swallowed-save-failure fixes established, `pnpm check` bundles
  typecheck, lint and the vitest suites into one command, and
  CLAUDE.md records the commands, test structure and conventions an
  agent session needs.
- Store assets generate from the repository: `node promo/generate.mjs`
  renders the two promo tiles from the mascot, five 1280x800 JPEG
  screenshots from the real extension with a branded caption band,
  the README demo GIF (gifenc, no ffmpeg), and a 960x600 webm demo
  kept in the repository. The README opens with the GIF and links
  the video.
- Double execution has its canary: every earlier key assertion used
  idempotent operations, so a duplicated keydown handler would have
  passed the whole suite. Alt+f — one word per press — now runs once
  after heavy settings churn, after options-page remounts, after SPA
  navigations and after an abandoned rebind capture, and must land
  exactly one word in. The badge and policy are also proven per tab
  with two tabs open, and repeated inspector clicks keep a single
  toast.
- Three assurance residuals became tests, and one became a product
  fix: real Chrome was measured to fire no storage change event for
  a redundant write (the story mock now mirrors that), all eleven
  locales are driven through the language select against their
  packaged strings with the dictionary-fetch fallback pinned in
  unit tests, and the storage subscriptions — which could never be
  released and grew with every options-page remount — now return an
  unsubscribe that the components call on unmount, held by contract
  tests. Wiring those subscriptions also made the url, rich text and
  language sections follow storage changes they previously ignored
  until a reload.
- Two more silent gaps have gates: every story in the Storybook
  build must be screenshot-captured or listed as excluded with the
  rendering it repeats, and every `getMessage` key in src/ must
  exist in the packaged locales — a missing key rendered as blank
  text without failing anything.
- Options page strings outside tooltips are English literals; only
  tooltips (and the extension description) localize (ADR-0007). Six
  message keys leave all eleven locales.
- The keymap list is a compact table instead of a stack of rows, and
  its tooltips open upward.

### Fixed

- Save failures no longer pass unnoticed. The keymap, theme, rich
  text and language controls each showed the new value and dropped
  whatever storage said; now the write is awaited, a refusal is
  shown beside the control, and the view rolls back to what storage
  kept (ADR-0009). The keymap store likewise updates its cached
  overrides only once the write lands, so a refused rebind no longer
  drives open tabs from memory the next reload discards.
- A refused URL rule edit resyncs without migrating: the reload it
  ran could itself write the legacy `urls` migration, which fails
  for the same reason the save did and replaced the message the user
  needed to read.
- Export validates before it downloads. Storage can hold values an
  older version or an external writer left, and a file our own
  import refuses is worse than no file; the offending field is now
  named instead.
- Import rejects overrides naming a keymap id that does not exist,
  and a chord whose key is the empty string — the first silently did
  nothing, the second bound a chord no key press can produce.
- Only `sync` writes are accepted. The four storage listeners read
  any area, so a `local` or `managed` write under the same key
  changed the policy, keymap, language or rich text opt-in.
- A config file staged and then edited by hand no longer keeps the
  file name beside text it no longer describes; a file over 1 MiB is
  refused before it is read, and an unreadable one says so.
- A URL rule edit that storage refuses no longer leaves the table
  showing the unsaved change: the list reloads from what storage
  kept and the failure is shown next to it. An empty pattern is
  rejected before it reaches the list — under glob and regex it
  would match every URL.
- Alt+f no longer jumps across newlines and tabs: end-of-word motion
  treated only spaces as separators. Fourteen hardening tests pin the
  behaviors a mutation review found unconstrained, among them glob
  `?` staying inside a segment, multi-modifier handler analysis, the
  page keeping chords razorshell has no editable counterpart for, and
  the rich text opt-in defaulting off.
- Same-document navigations (pushState, replaceState, popstate,
  hashchange) re-evaluate the URL policy, so a single-page app moving
  onto a denied path disables the keybindings without a reload.
- The legacy "urls" storage key migrates only from the top frame;
  every subframe used to run the migration concurrently.
- The Chinese locale directory is zh_CN, the code Chrome actually
  resolves; it was shipped as "cn", which no browser UI language
  maps to.
- The README keymap table now lists only the implemented bindings —
  it promised over twenty shortcuts while eight exist — and a test
  keeps the table equal to the code; the rest moved to a planned
  section.
- `email` inputs were dead keys since 0.0.1: the selection API does
  not apply to that type, so every operation threw after
  preventDefault had already suppressed the native action. `email`
  leaves the target list, restoring native behavior; `password`,
  where the selection API works, joins it. `number` stays out for
  the same platform reason.
- The theme toggle now persists: the choice is stored and reapplied
  when the options page opens, instead of resetting on every reload.
- The handled badge follows the selected theme's accent color;
  allow/deny badges keep the theme's semantic success/error colors,
  which carry the permit/block polarity.
- success/error now follow primary's lightness exactly per theme
  (backgrounds oklch L49 in light and L66 in dark, content L90 and
  L13), differing only in hue. The defaults used one palette for
  both themes with black text on each. The packaged CSS also drops
  from 32 themes to the two the toggle offers.
- Nine of the eleven locales carried only the extension name; the
  description and the keymap descriptions are now translated in all
  of them, and a test keeps the locale files key-identical.
- The options test area ran every matched keybinding twice. Key
  handling moved to a module without the content script's document
  listener; both entry points import it.
- The options page title image never rendered on Windows checkouts:
  the file was a git symlink, which Git for Windows materializes as a
  text file that holds the link target. The artwork is now a regular
  file at image/razorshell.svg, and the packaged images/ directory
  carries only the files the manifest and options page reference.
- Keymap tooltips open above the row; tooltip-left clipped at the
  viewport edge in narrow layouts.

## [0.0.2] - 2026-08-14

### Fixed

- Keybindings never ran: the content script was emitted as an ES
  module, and Chrome executes content scripts as classic scripts, so
  its top-level `export` was a SyntaxError (ADR-0003).
- Removed the `_execute_action` command suggesting the reserved
  shortcut `Ctrl+W`, along with the invalid `"commands"` permission
  entry.

### Added

- `textarea` support: Ctrl+a / Ctrl+e / Ctrl+k / Ctrl+u act on the
  current line.
- Text fields rendered after page load are covered, through one
  delegated listener on the document.
- Inputs inside iframes are covered (`all_frames: true`).
- `testtarget.html` shows each field's selection range and the last
  keydown for manual checks.
- Pushing a `v*` tag runs tests, lint and build, then attaches the
  packaged zip to a GitHub Release.

### Security

- Resolved all 51 open dependency advisories; every one was in a
  development dependency, so the shipped extension was unaffected.
  Vite 7, Vitest 3, ESLint 9 with typescript-eslint 8, and a `yaml`
  override for the Tailwind 3 chain.

### Changed

- `deploy.sh` stops at the first failure instead of packaging a stale
  `dist/`.

## [0.0.1]

- Initial release: bash/readline-style keyboard shortcuts for
  single-line text inputs, options page, 11 locales.
