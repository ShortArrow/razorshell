# Agent notes

## Commands

- `pnpm check` — typecheck, lint, unit and story tests. Run after every
  change; it is the fast sensor bundle.
- `pnpm build` — tsc plus three vite configs: options page (ESM),
  content script and page hook (IIFE — content scripts cannot be ESM).
  `dist/` is what the e2e suite loads as the unpacked extension, so
  rebuild before `test:e2e` after touching `src/`.
- `pnpm test:e2e` / `test:visual` / `test:storybook` — Playwright.
  `test:storybook` needs `pnpm build-storybook` first.
- `pnpm storybook` — dev server on 6006. Restart it after editing
  `.storybook/**` or shared CSS; the running server pins that
  configuration at startup and then serves stale code without warning.

## Test structure

- Unit tests and stories run under vitest. Stories talk to the chrome
  mock in `.storybook/chromemock.ts`, which mirrors the real API's
  clone/area/get semantics — treat a mock/real divergence as a bug in
  the mock.
- `tests/e2e/extension.spec.ts` is one serial scenario over a shared
  persistent browser. Tests self-seed, and the import/export and
  restart describes near the end assert state seeded earlier in the
  file; place additions so those boundaries see the same state.
- Screenshot baselines are win32 and live next to the specs. The
  storybook spec captures each id in `storyIds` (one per visually
  distinct end state) in both themes and fails on any axe violation
  or undecided result. After a rendering change, inspect the diff
  image before regenerating a baseline.
- `docs/assurance.md` holds the claim tree. Tests carry `@C1.x` tags
  and `test/assurance.test.ts` fails a claim with no tagged evidence,
  so keep tags when renaming tests and tag new evidence.

## Conventions

- Storage writes are pessimistic: await the write, show a refusal in
  the section's `*-save-error` element, and resync the view from
  storage. `no-floating-promises` enforces the discipline in `src/`;
  a deliberate fire-and-forget is written with `void`.
- Options-page strings are English literals; only tooltips localize
  through `getMessage`.
- Story plays assert both the rendered state and `storedValue()`, and
  end by blurring the active element.
- The inspector never dispatches synthetic events, and the content
  script ignores untrusted ones.
- Why-decisions go to `docs/decisions/` as one-page ADRs; changes go
  to `docs/CHANGELOG.md` under Unreleased, in its terse style.
