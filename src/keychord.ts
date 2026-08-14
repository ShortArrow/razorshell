interface ChordSource {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

interface SelectionSource {
  selectionStart: number | null;
  selectionEnd: number | null;
  value: string;
}

function keyLabel(key: string): string {
  return key === " " ? "Space" : key;
}

/**
 * Splits a keyboard event into display labels, modifiers first in
 * Ctrl, Alt, Shift order and the key label last.
 */
export function keyChord(e: ChordSource): string[] {
  const chord: string[] = [];
  if (e.ctrlKey) chord.push("Ctrl");
  if (e.altKey) chord.push("Alt");
  if (e.shiftKey) chord.push("Shift");
  chord.push(keyLabel(e.key));
  return chord;
}

function positionLabel(position: number | null): string {
  return position === null ? "-" : String(position);
}

/**
 * Renders a text field selection as `start=3 end=5 len=11`,
 * with `-` standing in for an absent position.
 */
export function selectionSummary(s: SelectionSource): string {
  const start = positionLabel(s.selectionStart);
  const end = positionLabel(s.selectionEnd);
  return `start=${start} end=${end} len=${s.value.length}`;
}
