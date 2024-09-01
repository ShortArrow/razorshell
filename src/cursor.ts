export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    if (cursor === text.length + 1) return cursor - 1;
    if (cursor === 0) return 0;
    const sliced = text.slice(undefined, cursor);
    const splited = sliced.split(" ");
    splited.reverse();
    const responce = cursor - splited[0].length;
    if (responce === cursor) return cursor - splited.reverse()[1].length - 1;
    return responce;
  },
  getEndOfWord(text: string, cursor: number): number {
    const sliced = text.slice(cursor);
    if (sliced === "") return text.length;
    const splited = sliced.split(" ");
    const responce = cursor + splited[0].length;
    if (responce === cursor) return cursor + splited[1].length + 1;
    return responce;
  },
};
