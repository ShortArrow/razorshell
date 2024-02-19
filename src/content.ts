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
        textinput.setSelectionRange(0, 0); // set the cursor to the beginning of the text
      }
      else if (event.ctrlKey && event.key === 'e') {
        event.preventDefault(); // cancel default action
        console.log('ctrl+e');
        const end = textinput.value.length; // get the end position of the text
        textinput.setSelectionRange(end, end); // set the cursor to the end of the text
      }
      else if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // cancel default action
        console.log('ctrl+w');
        const cursor = textinput.selectionEnd; // get the end position of the selected text
        if (cursor == null || cursor === 0) return; // do nothing if the cursor is at the beginning
        const text = textinput.value.slice(0, cursor); // get the text before the cursor
        textinput.value = text; // set the text before the cursor
      }
    });
  });
}