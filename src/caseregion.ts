/**
 * @file caseregion.ts
 * @brief The case operations and transpose-words as pure functions of value and
 *        caret: which span changes, what it becomes, and where the caret lands.
 *
 * Nothing here touches the DOM. Each function answers with a region, the text
 * that replaces it, and the caret position afterwards, which keeps the decision
 * about what readline means testable without a field to run it in — the shape
 * `killregion.ts` already uses for the kills.
 *
 * The semantics are readline's, read off its C source rather than its manual,
 * because the two disagree on the case that matters most. `rl_change_case` in
 * readline's `text.c` records `start = rl_point`, calls `rl_forward_word`, and
 * recases the span between the two; it never scans backward. So the manual's
 * "the current (or following) word" means "from the caret to the end of the word
 * ahead of it" — a caret mid-word recases only the TAIL of that word, and a
 * caret at a word end recases the word that FOLLOWS, dragging the separator
 * along harmlessly. That is what these functions implement.
 *
 * The word boundary is `cursor.getEndOfWord`, the same one Alt+F moves over and
 * Alt+D kills, so a case operation covers exactly the span its own motion does.
 * Where that flavor differs from readline's `rl_forward_word` it is this
 * extension's own motion that wins, for the reason the word kills already give:
 * a binding disagreeing with its own motion would be the worse defect.
 */
import { cursor } from "./cursor";

/**
 * A span of the value, the text that replaces it, and where the caret ends.
 *
 * `text` equal to the current slice means nothing needs writing — the caller
 * moves the caret and leaves the value, and therefore the undo stack, alone.
 */
export interface CaseEdit {
  start: number;
  end: number;
  text: string;
  caret: number;
}

/**
 * Uppercases from the caret to the end of the word ahead of it.
 *
 * Casing is JavaScript's own `toUpperCase`, which is locale-INSENSITIVE: it
 * applies the Unicode default case mappings and ignores the browser's locale.
 * Turkish-style casing — where a dotless `ı` must uppercase to `I` and `i` to
 * `İ` — is therefore unclaimed, deliberately. Claiming it would mean choosing a
 * locale, and the only honest source for that choice would be the field's own
 * language, which a text field does not reliably carry.
 *
 * The mapping may change the string's length: `ß` uppercases to `SS`. The caret
 * lands at the end of the REPLACED text, so it stays at the word's end wherever
 * the mapping puts it.
 */
export function upcaseWordEdit(value: string, caret: number): CaseEdit {
  return caseEdit(value, caret, (slice) => slice.toUpperCase());
}

/** Lowercases from the caret to the end of the word ahead of it. The mirror of
 * `upcaseWordEdit`, including its locale-insensitivity. */
export function downcaseWordEdit(value: string, caret: number): CaseEdit {
  return caseEdit(value, caret, (slice) => slice.toLowerCase());
}

/**
 * Capitalizes from the caret to the end of the word ahead of it: the first
 * cased character up, the rest of that run down, so `hELLO` becomes `Hello`.
 *
 * Readline's rule, and the reason it is written against ALPHANUMERIC runs
 * rather than alphabetic ones: `rl_change_case` tests each character with
 * `rl_alphabetic`, which is `isalnum`, and holds an `inword` flag that resets on
 * anything else. A digit is therefore a word constituent that takes the
 * capitalization slot — `123abc` comes back unchanged, because `1` is what gets
 * uppercased (a no-op) and `abc` is then lowercased. Matching readline here
 * matters more than matching intuition: the binding exists to be readline's.
 *
 * `Intl` case mapping is not consulted, for the reason `upcaseWordEdit` gives.
 */
export function capitalizeWordEdit(value: string, caret: number): CaseEdit {
  return caseEdit(value, caret, capitalizeRuns);
}

/** The shared shape: find the span, transform it, land the caret at its end. */
function caseEdit(value: string, caret: number, transform: (slice: string) => string): CaseEdit {
  const start = clamp(caret, value.length);
  const end = cursor.getEndOfWord(value, start);
  const text = transform(value.slice(start, end));
  return { start, end, text, caret: start + text.length };
}

/**
 * Upper-cases the first alphanumeric of each run and lower-cases the rest of it.
 *
 * `isAlphanumeric` is the JavaScript reading of readline's `isalnum`: a
 * character that changes under either case mapping is a letter, and `\p{N}`
 * covers the digits, which case mapping leaves alone. Written this way rather
 * than as `/[a-z0-9]/i` so that a precomposed `é` is a word character and
 * capitalizes to `É`, which an ASCII class would refuse.
 */
function capitalizeRuns(slice: string): string {
  let inWord = false;
  let result = "";
  for (const character of slice) {
    if (!isAlphanumeric(character)) {
      inWord = false;
      result += character;
      continue;
    }
    result += inWord ? character.toLowerCase() : character.toUpperCase();
    inWord = true;
  }
  return result;
}

/** A word constituent in readline's sense: a letter or a digit. */
function isAlphanumeric(character: string): boolean {
  return /[\p{L}\p{N}]/u.test(character);
}

/**
 * What a transpose-words replaces, and where it leaves the caret.
 *
 * Readline's `rl_transpose_words` delimits two words, copies both, and writes
 * each into the other's extent — so the SEPARATORS BETWEEN THEM NEVER MOVE.
 * `one,  two` transposes to `two,  one`: the comma and both spaces are outside
 * the two extents and are never deleted. This function reproduces that by
 * replacing the single span from the first word's start to the second word's
 * end with `word2 + separator + word1`, the separator read from between them.
 *
 * The refusal is readline's too, and its shape is the guard
 * `(w1_beg == w2_beg) || (w2_beg < w1_end)`, which fires BEFORE any text is
 * copied or deleted. Fewer than two words is therefore not a partial edit but no
 * edit at all — readline rings the bell and restores the caret. A caret at the
 * very START of a line with two words after it hits that guard as well, because
 * the backward search for a first word finds the same word the forward search
 * did; readline does nothing there, and neither does this.
 *
 * Returns null when there is nothing to transpose, which the caller must treat
 * as "consume the key and leave the field alone" rather than as an error.
 */
export function transposeWordsEdit(value: string, caret: number): CaseEdit | null {
  const point = clamp(caret, value.length);

  const w2End = cursor.getEndOfWord(value, point);
  const w2Beg = cursor.getTopOfWord(value, w2End);
  const w1Beg = cursor.getTopOfWord(value, w2Beg);
  const w1End = endOfWordAt(value, w1Beg);

  if (w1Beg === w2Beg || w2Beg < w1End) return null;
  if (w1Beg < 0 || w1End > value.length || w2End > value.length) return null;

  const word1 = value.slice(w1Beg, w1End);
  const word2 = value.slice(w2Beg, w2End);
  if (word1 === "" || word2 === "") return null;

  const separator = value.slice(w1End, w2Beg);
  return { start: w1Beg, end: w2End, text: word2 + separator + word1, caret: w2End };
}

/**
 * The end of the word STARTING at an offset, without the separator skip that
 * `cursor.getEndOfWord` performs first.
 *
 * `getEndOfWord` is a motion: from a separator it moves over the separator run
 * and through the word after it, which is right for Alt+F and wrong here, where
 * the offset is already known to be a word start and the answer must be that
 * word's own end. Using the motion would make `w1End` land past the second word
 * and collapse the guard.
 */
function endOfWordAt(value: string, start: number): number {
  let end = start;
  while (end < value.length && !isSeparator(value[end])) end += 1;
  return end;
}

function isSeparator(character: string): boolean {
  return character === " " || character === "\n" || character === "\t" || character === "\r";
}

function clamp(position: number, length: number): number {
  return Math.max(0, Math.min(position, length));
}
