/**
 * @file keymapmerge.ts
 * @brief Pure composition of the keymap layers, from defaults up through the
 *        override layers, and the chord conflict lookup the rebind UI needs.
 */

import { Keymap } from "./operation";

export interface Chord {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

function applyChord(entry: Keymap, chord: Chord): Keymap {
  return {
    ...entry,
    key: chord.key,
    ctrl: chord.ctrl === true,
    alt: chord.alt === true,
    shift: chord.shift === true,
  };
}

function sameChord(left: Chord, right: Chord): boolean {
  return (
    left.key === right.key &&
    (left.ctrl === true) === (right.ctrl === true) &&
    (left.alt === true) === (right.alt === true) &&
    (left.shift === true) === (right.shift === true)
  );
}

/**
 * @fn mergeKeymap
 * @brief Fold override layers onto the defaults, the later layer winning.
 * @param Keymap[] defaults - The base keymap, one entry per operation
 * @param layers - Chords by entry id; an override replaces the whole chord and
 *                 an id absent from the defaults is ignored
 * @return Keymap[] - The defaults in order, with label and operation preserved
 */
export function mergeKeymap(defaults: Keymap[], ...layers: Record<string, Chord>[]): Keymap[] {
  return defaults.map((entry) => {
    let merged = entry;
    for (const layer of layers) {
      const chord = layer[entry.id];
      if (chord) merged = applyChord(merged, chord);
    }
    return merged;
  });
}

/**
 * @fn findConflict
 * @brief Look for another entry already holding the chord.
 * @param Chord chord - The chord about to be bound
 * @param Keymap[] keymap - The composed keymap to search
 * @param string excludeId - The entry being rebound, which never conflicts with itself
 * @return string | null - The id of the conflicting entry, or null when the chord is free
 */
export function findConflict(chord: Chord, keymap: Keymap[], excludeId: string): string | null {
  const hit = keymap.find((entry) => entry.id !== excludeId && sameChord(chord, entry));
  return hit ? hit.id : null;
}
