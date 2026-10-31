# ADR-0003: Each classic-script entry is a separate IIFE build

Status: Accepted

## Context

Chrome executes `content_scripts` entries as classic scripts, where a
top-level `export` is a SyntaxError. Two entries load that way: the
content script, and the page hook that runs in the page's MAIN world
(both listed under `content_scripts` in src/manifest.json). An ES
module build of either ends in `export{...}` and never runs. Rollup
refuses `format: "iife"` for a build with more than one entry, and
the project has four: options, service, content and pagehook.

## Decision

Three Vite configs run in sequence, all writing to dist/:

- vite.config.ts builds options and service as ES modules and copies
  the static files.
- vite.config.content.ts builds src/content.ts alone as a
  self-contained IIFE, with `emptyOutDir: false`.
- vite.config.pagehook.ts builds src/pagehook.ts alone the same way.

The build script chains them:
`tsc && vite build && vite build --config vite.config.content.ts && vite build --config vite.config.pagehook.ts`.

## Alternatives rejected

- One config with `output.format: "iife"`: Rollup rejects it for
  multiple entries.
- A loader that dynamic-imports the real module: needs
  `web_accessible_resources` and adds a runtime hop.
- @crxjs/vite-plugin: a framework dependency for a problem separate
  configs solve.

## Cost

Every `pnpm build` runs three builds, and only the first may empty
the output directory. A new classic-script entry needs a config of
its own.
