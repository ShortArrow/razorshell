# Changelog

Notable changes to Razorshell. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Design rationale lives in [docs/decisions](decisions/README.md).

## [Unreleased]

### Added

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
- Tooltips on the options page controls — default policy, match
  type, rule action, rule ordering, language select, test area — in
  all eleven locales.
- The options page language can be overridden from a select listing
  the eleven packaged locales, with "auto" following the browser as
  before. The current effective language is shown next to it. The
  extension name and description stay in the browser language; Chrome
  resolves those itself.

### Changed

- The keymap list is a compact table instead of a stack of rows, and
  its tooltips open upward.

### Fixed

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
