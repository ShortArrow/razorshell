export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    if (cursor === text.length + 1) return cursor - 1;
    if (cursor === 0) return 0;
    const sliced = text.slice(0, cursor);
    const words = sliced.split(" ");
    const lastWordLength = words[words.length - 1].length;
    const newCursor = cursor - lastWordLength;
    if (newCursor === cursor) {
      return cursor - words[words.length - 1].length - 1;
    }
    return newCursor;
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
