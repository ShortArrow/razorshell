# Changelog

Notable changes to Razorshell. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.2] - 2026-08-14

### Fixed

- Keybindings did not work at all: Vite emitted the content script as an
  ES module, whose top-level `export` is a SyntaxError in Chrome's
  classic content script context. The content entry is now built
  separately as a self-contained IIFE.
- Removed the `_execute_action` command suggesting the reserved
  shortcut `Ctrl+W`, which Chrome cannot honor and which risked
  rejection when loading the extension, along with an invalid
  `"commands"` permission entry.

### Added

- `textarea` support with per-line readline behavior: `Ctrl+a` /
  `Ctrl+e` / `Ctrl+k` / `Ctrl+u` operate on the current line.
- Text fields rendered after page load are now covered, via a
  document-level delegated listener instead of per-element listeners
  bound once at injection.
- Inputs inside iframes are now covered (`all_frames: true`).
- `testtarget.html` shows live `selectionStart`/`selectionEnd` for every
  field and the last keydown (key, code, modifiers, `defaultPrevented`)
  for manual verification.
- Release workflow: pushing a `v*` tag runs tests, lint and build, then
  attaches the packaged zip to a GitHub Release.

### Security

- Resolved all open dependency advisories (51 Dependabot alerts,
  including 3 critical). Toolchain upgrades: Vite 7, Vitest 3,
  ESLint 9 (flat config) with typescript-eslint 8, plus a `yaml`
  override for the Tailwind 3 chain. `pnpm audit` reports zero known
  vulnerabilities. All advisories were in development dependencies;
  the shipped extension was not affected.

### Changed

- `deploy.sh` fails fast (`set -euo pipefail`) instead of silently
  packaging a stale `dist/` when the build fails.

## [0.0.1]

- Initial release: bash/readline-style keyboard shortcuts for
  single-line text inputs, options page, 11 locales.
