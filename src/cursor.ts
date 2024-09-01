export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    const sliced = text.slice(undefined, cursor);
    const splited = sliced.split(" ");
    return cursor - splited.reverse()[0].length;
  },
  getEndOfWord(text: string, cursor: number): number {
    const sliced = text.slice(cursor);
    const splited = sliced.split(" ");
    return cursor + splited[0].length;
  },
};
