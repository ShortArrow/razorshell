function logKey(event: KeyboardEvent) {
  let ss = "";
  ss += event.ctrlKey ? "ctrl+" : "";
  ss += event.altKey ? "alt+" : "";
  ss += event.shiftKey ? "shift+" : "";
  ss += event.key;
  console.debug(`key: ${ss}`);
}

export const debug = {
  logKey,
};
