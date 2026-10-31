# ADR-0008: Settings import and export use JSON

Status: Accepted

## Context

Users want their settings in a file they can keep, move to another
machine and restore. The file a shell user would write lives under
`~/.config`, which the File System Access API refuses to open, so the
extension cannot read a config file from disk on its own. Reading one
automatically needs a Native Messaging host, a separate install
outside the browser.

## Decision

Settings move in and out of the options page as a JSON document.
`src/settingsio.ts` parses and serializes it as pure functions, and
`src/ui/config.tsx` downloads the current settings and applies a
pasted or chosen file. `config.sample.json` shows every setting.

## Criteria

Import and export need a declarative format that survives the round
trip: exporting must produce what importing reads back. JSON goes
both ways exactly and costs no dependency, since the browser already
parses it.

## Alternatives rejected

- An init.lua read through fengari or wasmoon: a hand-written Lua
  config cannot be regenerated from the current settings, so export
  would produce something other than what the user wrote. The
  runtime is 67-150KB and needs a sandbox design around it, and the
  settings surface is small enough that nothing benefits from being
  programmable.
- TOML: comments make it nicer to write by hand, but it needs a
  parser dependency.
- Native Messaging: the official way to reach the filesystem, and it
  requires a separate install per operating system.

## Cost

A hand-written config cannot carry comments.
