# Decision records

What was chosen, by which criteria, and what was rejected. Each
record names the files it concerns and is frozen when written.

- [ADR-0001](0001-url-rules-first-match.md) — URL rules apply in
  order, first match wins, then a default action
- [ADR-0002](0002-glob-stays-in-segment.md) — glob wildcards stay
  inside one path segment; `**` crosses `/`
- [ADR-0003](0003-content-script-iife-build.md) — the content script
  is a separate IIFE build
