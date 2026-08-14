# ADR-0001: URL rules apply in order, first match wins

Date: 2026-08-14
Status: accepted

## Context

The content script runs on every page (`<all_urls>` in
src/manifest.json). Users need per-site control over whether the
keybindings are active. `resolveAction` in src/urlrules.ts returns
the action of the first rule that matches the URL, or
`defaultAction` when none does.

## Decision

A rule list is evaluated top to bottom against the full page URL; the
first matching rule decides allow or deny. Unmatched URLs take
`defaultAction`, which the options page exposes and which starts as
allow.

## Criteria

The target users administer tools like nginx and iptables; an ordered
chain with a default policy is the model they already hold. One
mechanism covers both allowlist operation (default deny plus allow
rules) and denylist operation (default allow plus deny rules).

## Alternatives rejected

- Allow-precedence: deny rules disable, allow rules punch exceptions,
  no ordering needed. Rejected because it cannot express an exception
  inside an exception, and the audience would have to learn a second
  evaluation model on top of the default action.
- Deny-precedence: rejected because it cannot express any exception
  to a deny.

## Cost

Order matters, so the options page needs row reordering. Up and down
buttons for now; drag handles can be added without touching the
evaluation model.
