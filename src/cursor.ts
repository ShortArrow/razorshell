/**
 * @file cursor.ts
 * @brief Caret motions over a plain-text value: line ends and readline's words.
 *
 * A word is readline's (`rl_alphabetic`): a run of letters and digits, with
 * combining marks kept inside the word so accented text stays one word.
 * Everything else — whitespace and punctuation alike — separates words
 * (ADR-0013). The unit is the code point, so a letter outside the BMP is one
 * word character rather than two surrogate separators.
 */

/**
 * A word constituent in readline's sense: a letter or digit (`\p{L}`, `\p{N}`)
 * or a combining mark (`\p{M}`). Takes a single code point.
 */
export function isWordCharacter(character: string): boolean {
  return /^[\p{L}\p{N}\p{M}]$/u.test(character);
}

/** The code point starting at `pos`, or "" at the end of the text. */
function codePointAt(text: string, pos: number): string {
  const point = text.codePointAt(pos);
  return point === undefined ? "" : String.fromCodePoint(point);
}

/** The code point ending at `pos`, or "" at the start of the text. */
function codePointBefore(text: string, pos: number): string {
  if (pos <= 0) return "";
  const pair = text.slice(Math.max(0, pos - 2), pos);
  return codePointAt(pair, 0).length === 2 ? pair : text[pos - 1];
}

export const cursor = {
  /**
   * readline's backward-word: back over any non-word run, then back to the
   * start of the word before it. Never returns below 0.
   */
  getTopOfWord(text: string, cursor: number): number {
    while (cursor > 0 && !isWordCharacter(codePointBefore(text, cursor))) {
      cursor -= codePointBefore(text, cursor).length;
    }
    while (cursor > 0 && isWordCharacter(codePointBefore(text, cursor))) {
      cursor -= codePointBefore(text, cursor).length;
    }
    return cursor;
  },
  getTopOfLine(text: string, cursor: number): number {
    if (cursor === 0) return 0;
    return text.lastIndexOf("\n", cursor - 1) + 1;
  },
  getEndOfLine(text: string, cursor: number): number {
    const newline = text.indexOf("\n", cursor);
    return newline === -1 ? text.length : newline;
  },
  /**
   * readline's forward-word: over any non-word run, then to the end of the
   * word after it. Never returns past `text.length`.
   */
  getEndOfWord(text: string, cursor: number): number {
    while (cursor < text.length && !isWordCharacter(codePointAt(text, cursor))) {
      cursor += codePointAt(text, cursor).length;
    }
    while (cursor < text.length && isWordCharacter(codePointAt(text, cursor))) {
      cursor += codePointAt(text, cursor).length;
    }
    return cursor;
  },
};
