/**
 * @file handleranalysis.ts
 * @brief Reads a page keydown handler's own source for the traces a chord test
 *        leaves behind, so a possible conflict is named without firing anything
 *        at the page.
 */

import { Chord } from "./keymapmerge";

const modifierProperties: { flag: (chord: Chord) => boolean; property: string }[] = [
  { flag: (chord) => chord.ctrl === true, property: "ctrlKey" },
  { flag: (chord) => chord.alt === true, property: "altKey" },
  { flag: (chord) => chord.shift === true, property: "shiftKey" },
];

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasQuotedKey(source: string, key: string): boolean {
  return new RegExp(`["'\`]${escapeForRegExp(key)}["'\`]`).test(source);
}

function hasKeyCode(source: string, key: string): boolean {
  if (key.length !== 1) return false;
  const code = key.toUpperCase().charCodeAt(0);
  return new RegExp(`\\b${code}\\b`).test(source);
}

function testsKey(source: string, key: string): boolean {
  return hasQuotedKey(source, key) || hasKeyCode(source, key);
}

function testsModifiers(source: string, chord: Chord): boolean {
  return modifierProperties
    .filter((modifier) => modifier.flag(chord))
    .every((modifier) => source.includes(modifier.property));
}

/**
 * @fn analyzeHandlerSource
 * @brief Pick the chords whose key test, modifier test and preventDefault call
 *        all appear in the handler's source, a match being a suspicion rather
 *        than a proven conflict.
 * @param string source - The handler's source as String(handler) gives it
 * @param Chord[] chords - The chords to look for
 * @return Chord[] - The matching chords, a subsequence of the chords argument
 */
export function analyzeHandlerSource(source: string, chords: Chord[]): Chord[] {
  if (!source.includes("preventDefault")) return [];
  return chords.filter(
    (chord) => testsKey(source, chord.key) && testsModifiers(source, chord),
  );
}
