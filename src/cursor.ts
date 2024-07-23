export const cursor = {
  getTopOfWord(text: string, cursor: number): number {
    const splited = text.slice(cursor).split(" ");
    splited.forEach((word, index) => {
      if(word.length + 1> cursor){

      }
    });
    return cursor - splited[splited.length - 1].length + 2;
  },
};
