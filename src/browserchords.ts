/**
 * @file browserchords.ts
 * @brief The two chords Chrome owns, described well enough for the keymap table
 *        to show a row for each.
 *
 * These are not keymap entries and deliberately do not live in `defaultKeymap`.
 * A keymap entry is a chord razorshell binds and the user may rebind in the
 * page; these two are the opposite on both counts. Chrome handles Ctrl+W and
 * Ctrl+T before any page sees them and refuses to let a manifest suggest them,
 * so the binding exists only once the user assigns it on the shortcuts page,
 * and the browser — not this extension — is what holds it afterwards. See
 * ADR-0011.
 *
 * `chord` is therefore the INTENDED chord, printed as the row's default so the
 * user knows which one to assign. What is actually bound is read at runtime from
 * `chrome.commands.getAll()`, because the user may have assigned something else
 * or nothing at all.
 *
 * The command names are written out here rather than imported from
 * `commandroute.ts`, which also names them. This module is reached from the
 * OPTIONS bundle and that one from the SERVICE WORKER, and sharing a module
 * across the two makes Vite hoist it into a chunk that both `import` — but the
 * manifest registers the worker without `"type": "module"`, so a worker carrying
 * a static import registers no listeners at all and the toolbar badge silently
 * stops updating. `test/browserchords.test.ts` reads the manifest and fails if
 * these names and its `commands` block ever drift apart, which is the check the
 * import was there to provide.
 */

import { Chord } from "./keymapmerge";

/** One browser-managed row: what it does, which command carries it, what to assign. */
export interface BrowserChord {
  /** The manifest command name, and the key `chrome.commands.getAll()` reports it under. */
  command: string;
  /** The row's action column, in the same voice as a keymap entry's label. */
  label: string;
  /** The chord the row asks the user to assign, shown in the default column. */
  chord: Chord;
}

/**
 * The rows the keymap table appends after the rebindable ones.
 *
 * Order matches the manifest's `commands` block, which is also the order the
 * shortcuts page lists them in, so the two readings agree.
 */
export const browserChords: BrowserChord[] = [
  {
    command: "unix_word_rubout",
    label: "unix word rubout",
    chord: { key: "w", ctrl: true },
  },
  {
    command: "transpose_chars",
    label: "transpose chars",
    chord: { key: "t", ctrl: true },
  },
];
