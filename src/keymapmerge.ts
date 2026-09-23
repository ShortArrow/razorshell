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

/** An override binds the entry, so an unassigned one leaves that state here. */
function applyChord(entry: Keymap, chord: Chord): Keymap {
  return {
    ...entry,
    unassigned: false,
    key: chord.key,
    ctrl: chord.ctrl === true,
    alt: chord.alt === true,
    shift: chord.shift === true,
  };
}

/**
 * @fn boundEntries
 * @brief The entries that can match a keystroke.
 * @param Keymap[] keymap - The composed keymap
 * @return Keymap[] - The same order, minus entries still unassigned
 */
export function boundEntries(keymap: Keymap[]): Keymap[] {
  return keymap.filter((entry) => entry.unassigned !== true);
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

/** The keys that insert or remove text when nothing is held down. */
const editingKeys = ["Enter", "Tab", "Backspace", "Delete"];

/**
 * @fn typingKeyRefusal
 * @brief Judge a chord about to be bound, naming the reason a plain key cannot be one.
 * @details A chord the content script claims is consumed in every field it watches, so a
 *          key that types bound without Ctrl or Alt takes that character away from the
 *          user everywhere. Shift does not rescue it: shifted letters and punctuation type
 *          too. Navigation and function keys carry no character, so they stay bindable.
 * @param Chord chord - The chord as captured or as read from a settings document
 * @return string | null - The reason to show, or null when the chord is bindable
 */
export function typingKeyRefusal(chord: Chord): string | null {
  if (chord.ctrl === true || chord.alt === true) return null;
  const types = chord.key.length === 1 || editingKeys.includes(chord.key);
  return types ? `"${chord.key}" alone would shadow typing; hold Ctrl or Alt` : null;
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
  const hit = boundEntries(keymap).find((entry) => entry.id !== excludeId && sameChord(chord, entry));
  return hit ? hit.id : null;
}
