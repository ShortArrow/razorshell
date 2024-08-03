export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    const splited = text.slice(undefined, cursor).split(" ");
    let wordcount = 0;
    let charcount = 0;
    while (splited[wordcount]) {
      charcount += splited[wordcount].length + 1;
      if (charcount + splited[wordcount].length >= cursor) {
        break;
      }
      wordcount++;
    }
    return charcount + 1;
  },
};
