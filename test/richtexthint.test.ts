// @vitest-environment jsdom
/**
 * The one-time hint for rich text editors (ADR-0014). With the opt-in off, a
 * bound chord pressed in a contenteditable root does nothing, which reads as
 * the extension being broken; the first such press shows a hint saying where
 * to turn it on, once per browser profile, and the key still goes to the page.
 */
import { describe, expect, test, vi } from "vitest";
import { createRichTextHint } from "../src/richtexthint";
import { Keymap } from "../src/operation";

const noop = () => {};
const keymap: Keymap[] = [
  { id: "end", label: "end", operation: noop, editableOperation: noop, ctrl: true, key: "e" },
  { id: "upcase", label: "upcase", operation: noop, alt: true, key: "u" },
  { id: "optin", label: "optin", operation: noop, editableOperation: noop, unassigned: true, ctrl: true, key: "c" },
];

function keydown(init: KeyboardEventInit, composing = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { ...init, cancelable: true });
  if (composing) Object.defineProperty(event, "isComposing", { value: true });
  return event;
}

function harness(alreadyShown = false, writeFails = false) {
  const read = vi.fn(async () => alreadyShown);
  const write = vi.fn(async () => {
    if (writeFails) throw new Error("quota");
  });
  const show = vi.fn();
  const hint = createRichTextHint({ read, write, show, keymap: () => keymap });
  return { hint, read, write, show };
}

describe("the rich text hint shows once and never takes the key @C1.20", () => {
  test("the first chord that would act in a rich editor shows the hint and records it", async () => {
    const { hint, write, show } = harness();
    const event = keydown({ key: "e", ctrlKey: true });
    await hint.offer(event);
    expect(show).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  test("a profile that has seen the hint does not see it again", async () => {
    const { hint, write, show } = harness(true);
    await hint.offer(keydown({ key: "e", ctrlKey: true }));
    expect(show).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test("the same frame asks storage once, whatever is pressed after", async () => {
    const { hint, read, show } = harness();
    await hint.offer(keydown({ key: "e", ctrlKey: true }));
    await hint.offer(keydown({ key: "e", ctrlKey: true }));
    expect(read).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a chord with no rich text counterpart", { key: "u", altKey: true }],
    ["an unassigned opt-in chord", { key: "c", ctrlKey: true }],
    ["plain typing", { key: "x" }],
  ])("%s does not count as a press the hint is for", async (_name, init) => {
    const { hint, read, show } = harness();
    await hint.offer(keydown(init));
    expect(read).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  test("a keydown inside an IME composition does not count", async () => {
    const { hint, read } = harness();
    await hint.offer(keydown({ key: "e", ctrlKey: true }, true));
    expect(read).not.toHaveBeenCalled();
  });

  test("a hint whose record could not be written is not shown, so it cannot nag", async () => {
    const { hint, show } = harness(false, true);
    await hint.offer(keydown({ key: "e", ctrlKey: true }));
    expect(show).not.toHaveBeenCalled();
  });
});
