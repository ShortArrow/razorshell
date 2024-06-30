export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    const splited = text.slice(cursor).split(" ");
    return cursor - splited[splited.length - 1].length + 2;
  },
};
