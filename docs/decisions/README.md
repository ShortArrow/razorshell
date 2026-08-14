# Decision records

What was chosen, by which criteria, and what was rejected. Each
record names the files it concerns and is frozen when written.

- [ADR-0001](0001-url-rules-first-match.md) — URL rules apply in
  order, first match wins, then a default action
- [ADR-0002](0002-glob-stays-in-segment.md) — glob wildcards stay
  inside one path segment; `**` crosses `/`
- [ADR-0003](0003-content-script-iife-build.md) — the content script
  is a separate IIFE build
- [ADR-0004](0004-keymap-override-layers.md) — keymap overrides
  layer as default < lua < gui; only the GUI rejects conflicts
- [ADR-0005](0005-contenteditable-support.md) — contenteditable
  support is opt-in and Selection-based
- [ADR-0006](0006-inspector-never-dispatches.md) — the inspector
  never dispatches key events; it reads handler code, admits what it
  cannot analyze, and confirms from real input
- [ADR-0007](0007-options-page-language-policy.md) — the options page
  localizes tooltips only; other strings are English literals
