# ADR-0004: Keymap overrides are one layer over the defaults; only a GUI rebind rejects conflicts

Status: Accepted

## Context

Keybindings change from two places: a rebind on the options page,
and an imported settings file (ADR-0008). `mergeKeymap` in
src/keymapmerge.ts takes the defaults and any number of override
layers, later layers winning per entry; src/keymapstore.ts passes it
one, the `keymapOverrides` record in storage. Entries are addressed
by an `id` equal to the message key they already carry (for example
`move_cursor_to_the_beginning`). Dispatch runs only the first
matching entry (`dispatchKey` in src/keyhandling.ts).

## Decision

Two layers, later wins: the built-in defaults, then the stored
overrides. A rebind on the options page and an import both write
that one record. Only the rebind validates chords against each
other: one that collides with another row's chord is rejected and
the colliding row is named. An import that carries
`keymapOverrides` replaces the record as a whole; src/settingsio.ts refuses malformed entries and typing keys,
but not two entries sharing a chord.

## Criteria

The GUI user acts one binding at a time and benefits from an
immediate, named error. A file is applied as a whole; rejecting part
of it would leave a result the author never wrote, and rejecting all
of it for a duplicate would refuse a file the extension itself can
still run. First-match dispatch keeps behaviour defined when an
import carries a duplicate chord.

## Alternatives rejected

- Three layers, default < lua < gui, with an init.lua read from disk
  as the middle layer: the browser cannot read the file a shell user
  would write, so settings files became the JSON import of ADR-0008,
  which writes the GUI's record instead of a layer of its own.
  `mergeKeymap` keeps its variadic signature, so a layer can be added
  back without changing callers.
- One flat override store written by two independent sources: each
  would overwrite the other, and removing one could not restore the
  other's settings. With import replacing the record, that is the
  intended behaviour rather than a collision.
- Validating imported chords like a rebind: rejecting part of a file
  silently produces a mixed state the author never wrote.

## Cost

A duplicate chord from an import resolves by list order, visible
only in the options page display.
