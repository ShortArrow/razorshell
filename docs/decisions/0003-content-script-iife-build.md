# ADR-0003: The content script is a separate IIFE build

Date: 2026-08-14
Status: accepted

## Context

Chrome executes `content_scripts` entries as classic scripts, where a
top-level `export` is a SyntaxError. Rollup refuses
`format: "iife"` for a build with more than one entry, and this
project has three (content, options, service). The single ESM build
shipped in v0.0.1 emitted a dist/content.js ending in `export{...}`,
so the content script never ran.

## Decision

Two Vite configs run in sequence. vite.config.ts builds options and
service as ES modules and copies the static files;
vite.config.content.ts builds src/content.ts alone as a
self-contained IIFE into the same dist/ with `emptyOutDir: false`.
The build script chains them:
`tsc && vite build && vite build --config vite.config.content.ts`.

## Alternatives rejected

- One config with `output.format: "iife"`: Rollup rejects it for
  multiple entries.
- A loader that dynamic-imports the real module: needs
  `web_accessible_resources` and adds a runtime hop.
- @crxjs/vite-plugin: a framework dependency for a problem two
  configs solve.

## Cost

Every `pnpm build` runs two builds, and the second must not empty the
output directory.
