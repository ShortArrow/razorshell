/**
 * The three opt-in operations of ADR-0012, on real fields in jsdom.
 *
 * jsdom implements no `document.execCommand`, so every write below takes the
 * value-splice fallback; the undo and input-event half of each contract is the
 * e2e suite's to claim. Form submission is observed through the `submit` event
 * — jsdom fires it from `requestSubmit` and stops there, which is exactly the
 * boundary the operation owns.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { clearRing, newestEntry, ringSnapshot } from "../src/killring";
import { canAcceptLine, canOpenLine, operation } from "../src/operation";

function makeInput(value: string, caret: number): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(caret, caret);
  return el;
}

function makeTextarea(value: string, caret: number): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.value = value;
  el.setSelectionRange(caret, caret);
  return el;
}

beforeEach(() => {
  clearRing();
});

describe("kill whole field @C1.19", () => {
  test("empties the field and puts the whole value on the ring", () => {
    const el = makeTextarea("first\nsecond\nthird", 8);
    operation.killWholeField(el);
    expect(el.value).toBe("");
    expect(el.selectionStart).toBe(0);
    expect(newestEntry()).toBe("first\nsecond\nthird");
  });

  test("an empty field stores nothing", () => {
    const el = makeInput("", 0);
    operation.killWholeField(el);
    expect(ringSnapshot()).toEqual([]);
  });

  test("a password field is emptied but never stored", () => {
    const el = makeInput("hunter2", 3);
    el.type = "password";
    operation.killWholeField(el);
    expect(el.value).toBe("");
    expect(ringSnapshot()).toEqual([]);
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("keep", 2);
    el.readOnly = true;
    operation.killWholeField(el);
    expect(el.value).toBe("keep");
    expect(ringSnapshot()).toEqual([]);
  });
});

describe("accept line @C1.19", () => {
  test("in a textarea inserts a newline at the caret and moves past it", () => {
    const el = makeTextarea("ab", 1);
    operation.acceptLine(el);
    expect(el.value).toBe("a\nb");
    expect(el.selectionStart).toBe(2);
    expect(el.selectionEnd).toBe(2);
  });

  test("in a textarea replaces the selection", () => {
    const el = makeTextarea("abcd", 1);
    el.setSelectionRange(1, 3);
    operation.acceptLine(el);
    expect(el.value).toBe("a\nd");
    expect(el.selectionStart).toBe(2);
  });

  test("in an input inside a form submits the form", () => {
    const form = document.createElement("form");
    const el = makeInput("query", 5);
    form.appendChild(el);
    document.body.appendChild(form);
    const submitted = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submitted);
    operation.acceptLine(el);
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(el.value).toBe("query");
    form.remove();
  });

  test("can handle a textarea and an input with a form, not an input without one", () => {
    const form = document.createElement("form");
    const inForm = makeInput("", 0);
    form.appendChild(inForm);
    expect(canAcceptLine(makeTextarea("", 0))).toBe(true);
    expect(canAcceptLine(inForm)).toBe(true);
    expect(canAcceptLine(makeInput("", 0))).toBe(false);
  });

  test("refuses a readonly textarea", () => {
    const el = makeTextarea("x", 0);
    el.readOnly = true;
    expect(canAcceptLine(el)).toBe(false);
  });
});

/**
 * Accept line in an input follows HTML's implicit submission, which is what
 * Enter does: the form's default button, the first submit button among the
 * form's elements, receives a click and the click submits; a disabled default
 * button means nothing happens; with no submit button the form submits only
 * when at most one of its fields blocks implicit submission. Measured
 * 2026-09-30 against real Chromium: Enter fired the default button's click
 * listener and then submit, while the first accept line fired submit alone,
 * so a page that submits from its button's click handler saw nothing.
 */
describe("accept line takes the path Enter takes @C1.19", () => {
  function buildForm(markup: string): { form: HTMLFormElement; field: HTMLInputElement; log: string[] } {
    document.body.innerHTML = markup;
    const form = document.querySelector("form")!;
    const field = document.querySelector<HTMLInputElement>("#field")!;
    const log: string[] = [];
    for (const button of document.querySelectorAll("button, input[type=submit]")) {
      button.addEventListener("click", () => log.push(`click ${button.id}`));
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      log.push("submit");
    });
    field.focus();
    return { form, field, log };
  }

  test("the default button is clicked, and the click submits", () => {
    const { field, log } = buildForm('<form><input id="field"><button id="go">go</button></form>');
    expect(canAcceptLine(field)).toBe(true);
    operation.acceptLine(field);
    expect(log).toEqual(["click go", "submit"]);
  });

  test("an input of type submit is a default button too", () => {
    const { field, log } = buildForm('<form><input id="field"><input type="submit" id="go"></form>');
    operation.acceptLine(field);
    expect(log).toEqual(["click go", "submit"]);
  });

  test("only the first submit button is clicked", () => {
    const { field, log } = buildForm(
      '<form><input id="field"><button id="first">a</button><button id="second">b</button></form>',
    );
    operation.acceptLine(field);
    expect(log).toEqual(["click first", "submit"]);
  });

  test("a type=button control is not a submit button", () => {
    const { field, log } = buildForm(
      '<form><input id="field"><button type="button" id="plain">x</button><button id="go">go</button></form>',
    );
    operation.acceptLine(field);
    expect(log).toEqual(["click go", "submit"]);
  });

  test("a submit button owned through the form attribute counts", () => {
    const { field, log } = buildForm(
      '<form id="f"><input id="field"></form><button form="f" id="outside">go</button>',
    );
    operation.acceptLine(field);
    expect(log).toEqual(["click outside", "submit"]);
  });

  test("a disabled default button leaves the key to the browser", () => {
    const { field, log } = buildForm(
      '<form><input id="field"><button id="go" disabled>go</button><button id="later">later</button></form>',
    );
    expect(canAcceptLine(field)).toBe(false);
    expect(log).toEqual([]);
  });

  test("with no submit button a lone text field submits without any click", () => {
    const { field, log } = buildForm('<form><input id="field"><input type="checkbox"></form>');
    expect(canAcceptLine(field)).toBe(true);
    operation.acceptLine(field);
    expect(log).toEqual(["submit"]);
  });

  test("with no submit button two text fields block submission", () => {
    const { field } = buildForm('<form><input id="field"><input type="password"></form>');
    expect(canAcceptLine(field)).toBe(false);
  });
});

describe("open line @C1.19", () => {
  test("inserts a newline at the caret and leaves the caret before it", () => {
    const el = makeTextarea("ab", 1);
    operation.openLine(el);
    expect(el.value).toBe("a\nb");
    expect(el.selectionStart).toBe(1);
    expect(el.selectionEnd).toBe(1);
  });

  test("replaces a selection and stays at its start", () => {
    const el = makeTextarea("abcd", 0);
    el.setSelectionRange(1, 3);
    operation.openLine(el);
    expect(el.value).toBe("a\nd");
    expect(el.selectionStart).toBe(1);
  });

  test("can handle a textarea but not an input, which holds no newline", () => {
    expect(canOpenLine(makeTextarea("", 0))).toBe(true);
    expect(canOpenLine(makeInput("", 0))).toBe(false);
  });
});

describe("the opt-in entries ship unassigned @C1.19", () => {
  test.each([
    ["kill_whole_field", { ctrl: true, key: "c" }],
    ["accept_line", { ctrl: true, key: "j" }],
    ["open_line", { ctrl: true, key: "o" }],
  ])("%s is unassigned with its suggested chord", (id, chord) => {
    const entry = defaultKeymap.find((candidate) => candidate.id === id);
    expect(entry).toBeDefined();
    expect(entry!.unassigned).toBe(true);
    expect(entry!.key).toBe(chord.key);
    expect(entry!.ctrl === true).toBe(chord.ctrl);
    expect(entry!.alt === true).toBe(false);
    expect(entry!.shift === true).toBe(false);
  });

  test("kill whole field is a kill and the other two are foreign to the ring", () => {
    const byId = (id: string) => defaultKeymap.find((entry) => entry.id === id)!;
    expect(byId("kill_whole_field").ringRole).toBe("kill");
    expect(byId("accept_line").ringRole).toBeUndefined();
    expect(byId("open_line").ringRole).toBeUndefined();
  });
});
