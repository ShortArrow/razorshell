# ADR-0004: Keymap overrides layer as default < lua < gui

Date: 2026-08-15
Status: accepted

## Context

Keybindings can be changed from the options page, and a planned
init.lua source will set them too. `mergeKeymap` in
src/keymapmerge.ts takes the defaults and any number of override
layers, later layers winning per entry. Entries are addressed by an
`id` equal to the message key they already carry (for example
`move_cursor_to_the_beginning`), so a Lua table can name them
directly. Dispatch runs only the first matching entry
(`dispatchKey` in src/keyhandling.ts).

## Decision

Three layers, later wins: the built-in defaults, then Lua-provided
overrides, then overrides set in the options page. Only the GUI
validates: a rebind that collides with another row's chord is
rejected and the colliding row is named. Lua merges last-wins with
no validation.

## Criteria

The GUI user acts one binding at a time and benefits from an
immediate, named error. A config file is applied as a whole; partial
rejection of a file would leave the result depending on evaluation
order, which is harder to reason about than "the file wins where it
speaks". First-match dispatch keeps behaviour defined even if a Lua
layer introduces a duplicate chord.

## Alternatives rejected

- One flat override store written by both sources: the file and the
  GUI would overwrite each other and removing the file could not
  restore GUI settings.
- Validating Lua overrides like the GUI: rejecting part of a config
  file silently produces a mixed state the author never wrote.

## Cost

A duplicate chord created by Lua resolves by list order, visible
only in the options page display.
