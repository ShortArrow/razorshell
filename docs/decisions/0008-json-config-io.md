# ADR-0008: Settings import and export use JSON

Date: 2026-08-15
Status: accepted

## Context

ADR-0004 assumed an init.lua that the extension would read from
disk. The File System Access API blocks `~/.config`, so the file a
shell user would write is exactly the one the browser refuses to
open. Reading it automatically needs a Native Messaging host, which
is a lot of machinery for a feature that otherwise stays inside the
web page.

## Decision

Settings move in and out of the options page as a JSON document.
`src/settingsio.ts` parses and serializes it as pure functions, and
`src/ui/config.tsx` downloads the current settings and applies a
pasted or chosen file. `config.sample.json` shows all five keys.

## Criteria

Import and export need a declarative format that survives the round
trip. A hand-written Lua config cannot be regenerated from the
current settings, so exporting would produce something other than
what the user wrote. JSON goes both ways exactly and costs no
dependency, since the browser already parses it.

## Alternatives rejected

- Lua through fengari or wasmoon: the runtime is 67-150KB and needs
  a sandbox design around it. The settings surface is small enough
  that nothing here benefits from being programmable.
- TOML: comments make it nicer to write by hand, but it needs a
  parser dependency. It can be added later as a second format.
- Native Messaging: the official way to reach the filesystem, and it
  requires a separate install per operating system. It stays open as
  a future option.

## Cost

A hand-written config cannot carry comments. The Lua layer in
ADR-0004 is dormant for now; `mergeKeymap` keeps its variadic
signature so a layer can be added back without changing callers.
