console.log("extension loaded");
const query = [
  'input[type="text"]',
  'input[type="search"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="email"]',
].join(', ');
// select all elements that can input single line text
const textInputs = document.querySelectorAll<HTMLInputElement>(query);

if (textInputs.length === 0) {
  console.log("nothing targets");
} else {
  textInputs.forEach((textinput) => {
    console.log(textinput);
    textinput.addEventListener("keydown", function (event) {
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault(); // cancel default action
        console.log('ctrl+a');
        textinput.setSelectionRange(0, 0); // テキストボックスの先頭にカーソルを移動
      }
      // Ctrl + Eが押された場合
      else if (event.ctrlKey && event.key === 'e') {
        event.preventDefault(); // デフォルトのイベントをキャンセル
        console.log('ctrl+e');
        const end = textinput.value.length; // テキストボックスの文字数を取得
        textinput.setSelectionRange(end, end); // テキストボックスの末尾にカーソルを移動
      }
    });
  });
}