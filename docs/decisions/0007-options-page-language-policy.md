# ADR-0007: The options page localizes tooltips only

Date: 2026-08-15
Status: accepted

## Context

Every visible string on the options page went through
`getMessage` in src/languages.ts, so each label needed an entry in
all eleven locales under src/_locales. Half of those entries were
one-word column headers — "action", "default", "current" — whose
translations nobody on the project can review.

## Decision

- Tooltips are localized: `data-tip`, `title` and `aria-label`, plus
  the per-entry `description` shown on the keymap table.
- Every other string on the page is an English literal in the TSX:
  headings, labels, column headers, placeholders, the conflict line.
- Keys that only served a non-tooltip string are gone from all
  eleven locales.

## Criteria

The users this extension is for run vim, emacs or a shell, and read
English UI already. A column header is a short technical word that
loses nothing untranslated, while a tooltip carries the sentence
that decides whether someone enables the setting. Concentrating
eleven locales on the explanatory strings puts the translation
budget where it changes behaviour.

## Alternatives rejected

- Localizing every string: nine of the eleven locales cannot be
  reviewed here, so label wording drifts per language and the key
  set grows with each new label.

## Cost

The language override in src/ui/language.tsx now only reaches
tooltips and the extension name and description in the store. A user
who picks Japanese still sees English labels, which reads as a
partial translation rather than a decision.
