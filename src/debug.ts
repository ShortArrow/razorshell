import { Keymap } from "./operation";

function logKey(keymap: Keymap) {
  let ss = "";
  ss += keymap.ctrl ? "ctrl+" : "";
  ss += keymap.alt ? "alt+" : "";
  ss += keymap.shift ? "shift+" : "";
  ss += keymap.key;
  console.log(`key: ${ss}`);
}

export const debug = {
  logKey,
};
