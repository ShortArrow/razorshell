const separators = [" ", "\n", "\t", "\r"];

function isStartOfWord(text: string, pos: number): boolean {
  if (pos === 0) return true;
  return separators.includes(text[pos - 1])
}

export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    if (cursor === 0) return cursor;
    // check already at the beginning
    if (!isStartOfWord(text, cursor)) {
      while (cursor > 0 && !isStartOfWord(text, cursor)) {
        cursor--; // to the beginning of the word
      }
      return cursor;
    }
    while (isStartOfWord(text, cursor)) {
      cursor--;  // ignore separators
    }
    while (!isStartOfWord(text, cursor)) {
      cursor--;  // to the previous word
    }
    return cursor;
  },
  getEndOfWord(text: string, cursor: number): number {
    const sliced = text.slice(cursor);
    if (sliced === "") return text.length;
    const words = sliced.split(" ");
    const firstWordLength = words[0].length;
    const newCursor = cursor + firstWordLength;
    if (newCursor === cursor) {
      return cursor + words[1].length + 1;
    }
    return newCursor;
  },
};
