function logKey(event: KeyboardEvent) {
  let ss = "";
  ss += event.ctrlKey ? "ctrl+" : "";
  ss += event.altKey ? "alt+" : "";
  ss += event.shiftKey ? "shift+" : "";
  ss += event.key;
  console.log(`key: ${ss}`);
}

export const debug = {
  logKey,
};
