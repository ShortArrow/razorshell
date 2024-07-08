// keymap object
type Keymap = {
  label: string;
  operation: (textinput: HTMLInputElement) => void;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  key: string;
};

const InvalidKeymapFormatException = Error("Invalid keymap format.");

export function parseKeymap(map: string): Keymap {
  const keymap: Keymap = {
    label: "",
    operation: (textinput: HTMLInputElement) => {
      console.log(textinput.value);
    },
    key: "",
  };
  if (!map.startsWith("<") || !map.endsWith(">")) {
    throw InvalidKeymapFormatException;
  }
  const key = map.slice(1, -1); // remove "<" and ">"
  const keys = key.split("-");
  if (keys.length > 3) {
    throw InvalidKeymapFormatException;
  }
  const ctrl = keys.includes("C");
  keymap.ctrl = ctrl;
  const alt = keys.includes("A");
  keymap.alt = alt;
  return keymap;
}
