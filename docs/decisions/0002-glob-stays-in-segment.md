# ADR-0002: Glob wildcards stay inside one path segment

Date: 2026-08-14
Status: accepted

## Context

Rules match the full page URL (ADR-0001). Glob sits between exact and
regex among the match types in src/urlrules.ts, whose `matchesRule`
docstring reads: "glob `**` crosses `/`, while `*` and `?` stay
within one path segment".

## Decision

`*` translates to `[^/]*`, `?` to `[^/]`, and `**` to `.*`.

## Criteria

A wildcard written for the host part must not be satisfiable from the
path or query. With `*` translated to `.*`, the pattern
`https://*.example.com/*` matches
`https://evil.com/?u=app.example.com/x` — the first star crosses `/`
and finds `.example.com/` inside the query string, so a rule scoped
to one host fires on a foreign page.

## Alternatives rejected

- `*` as `.*`: the mismatch above.
- Segment-scoped `*` with no `**`, using regex for deep paths:
  rejected because "this whole site" is the common case and regex is
  the error-prone way to write it.

## Cost

Covering a site takes `https://example.com/**`; `/*` covers one path
segment only.
