const separators = [" ", "\n", "\t", "\r"];

function isStartOfWord(text: string, pos: number): boolean {
  if (pos === 0) return true;
  return separators.includes(text[pos - 1])
}

export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    if (cursor === 0) return cursor;
    if (!isStartOfWord(text, cursor)) {
      while (cursor > 0 && !isStartOfWord(text, cursor)) {
        cursor--;
      }
      return cursor;
    }
    while (cursor > 0 && isStartOfWord(text, cursor)) {
      cursor--;
    }
    while (cursor > 0 && !isStartOfWord(text, cursor)) {
      cursor--;
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
  getEndOfWord(text: string, cursor: number): number {
    while (cursor < text.length && separators.includes(text[cursor])) {
      cursor++;
    }
    while (cursor < text.length && !separators.includes(text[cursor])) {
      cursor++;
    }
    return cursor;
  },
};
