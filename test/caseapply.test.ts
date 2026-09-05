/**
 * The case operations and the newline kill as they reach a real field.
 *
 * These run in jsdom, where `document.execCommand` does not exist, so the write
 * takes the documented splice fallback and nothing here can assert undo or input
 * events — the e2e suite owns that half, and the Alt+U undo test there is what
 * shows the write really goes through `execCommand("insertText")`. What these
 * can show, and the pure-function tests cannot, is the wiring: that the caret
 * ends where the edit said, that a no-op transform does not write at all, that a
 * refused transpose leaves the field untouched, and that a Ctrl+K at a line end
 * now joins the lines and chains into one ring entry.
 */
// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from "vitest";
import { operation } from "../src/operation";
import { clearRing, ringSnapshot } from "../src/killring";

function makeInput(value: string, start: number, end = start): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
}

function makeTextarea(value: string, start: number): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.value = value;
  el.setSelectionRange(start, start);
  return el;
}

beforeEach(() => {
  clearRing();
});

describe("the case operations reach the field @C1.17", () => {
  test("Alt+U uppercases the word ahead of the caret and lands at its end", () => {
    const el = makeInput("hello world", 0);
    operation.upcaseWord(el);
    expect(el.value).toBe("HELLO world");
    expect(el.selectionStart).toBe(5);
    expect(el.selectionEnd).toBe(5);
  });

  test("Alt+L lowercases the word ahead of the caret", () => {
    const el = makeInput("HELLO WORLD", 0);
    operation.downcaseWord(el);
    expect(el.value).toBe("hello WORLD");
    expect(el.selectionStart).toBe(5);
  });

  test("Alt+C capitalizes a word whose tail is already upper case", () => {
    const el = makeInput("hELLO world", 0);
    operation.capitalizeWord(el);
    expect(el.value).toBe("Hello world");
    expect(el.selectionStart).toBe(5);
  });

  test("a caret at a word end acts on the following word", () => {
    const el = makeInput("hello world", 5);
    operation.upcaseWord(el);
    expect(el.value).toBe("hello WORLD");
    expect(el.selectionStart).toBe(11);
  });

  /**
   * The no-write path, asserted through the field rather than the pure function.
   *
   * A word already in the target case must not be rewritten: in the browser that
   * is what keeps a redundant Alt+U from pushing an entry onto the undo stack, so
   * a following Ctrl+Z undoes the user's own last edit rather than a recase that
   * changed nothing. jsdom cannot observe the undo stack, so what is observed
   * here is the write itself — the value property is trapped and must never be
   * assigned.
   */
  test("a word already upper case is not written at all", () => {
    const el = makeInput("HELLO world", 0);
    let writes = 0;
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!;
    Object.defineProperty(el, "value", {
      configurable: true,
      get: () => descriptor.get!.call(el),
      set: (next: string) => {
        writes += 1;
        descriptor.set!.call(el, next);
      },
    });

    operation.upcaseWord(el);

    expect(writes, "the value was assigned for a transform that changed nothing").toBe(0);
    expect(el.value).toBe("HELLO world");
    expect(el.selectionStart).toBe(5);
  });

  test("a word of non-letters is not written but the caret still moves", () => {
    const el = makeInput("--- rest", 0);
    operation.upcaseWord(el);
    expect(el.value).toBe("--- rest");
    expect(el.selectionStart).toBe(3);
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("hello world", 0);
    el.readOnly = true;
    operation.upcaseWord(el);
    expect(el.value).toBe("hello world");
    expect(el.selectionStart).toBe(0);
  });

  /** None of them is a kill, so none of them puts anything on the ring. */
  test("a case operation stores nothing on the ring", () => {
    const el = makeInput("hello world", 0);
    operation.upcaseWord(el);
    operation.capitalizeWord(el);
    expect(ringSnapshot()).toEqual([]);
  });
});

describe("transpose reaches the field @C1.17", () => {
  test("Alt+T swaps the words either side of the caret", () => {
    const el = makeInput("one two", 3);
    operation.transposeWords(el);
    expect(el.value).toBe("two one");
    expect(el.selectionStart).toBe(7);
  });

  test("Alt+T at the end of the value transposes the last two words", () => {
    const el = makeInput("one two", 7);
    operation.transposeWords(el);
    expect(el.value).toBe("two one");
    expect(el.selectionStart).toBe(7);
  });

  /**
   * The refusal, and the shape it must take: nothing changes, not even the
   * caret. The key is still consumed — `preventDefault` lives in the dispatcher
   * and runs before the operation — which is this extension's reading of the
   * bell readline rings. A browser has no bell, and letting the key fall through
   * would make Alt+T mean one thing on a line with two words and whatever the
   * page decided on a line with one.
   */
  test("a single word leaves the field and the caret exactly as they were", () => {
    const el = makeInput("hello", 5);
    operation.transposeWords(el);
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(5);
    expect(el.selectionEnd).toBe(5);
  });

  test("the caret at the very start of the value is refused", () => {
    const el = makeInput("one two", 0);
    operation.transposeWords(el);
    expect(el.value).toBe("one two");
    expect(el.selectionStart).toBe(0);
  });

  test("an empty field is refused", () => {
    const el = makeInput("", 0);
    operation.transposeWords(el);
    expect(el.value).toBe("");
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("one two", 3);
    el.readOnly = true;
    operation.transposeWords(el);
    expect(el.value).toBe("one two");
  });
});

describe("Ctrl+K at a line end joins the lines @C1.17", () => {
  test("a kill at a line end takes the newline and joins them", () => {
    const el = makeTextarea("first\nsecond", 5);
    operation.deleteToEOL(el);
    expect(el.value).toBe("firstsecond");
    expect(el.selectionStart).toBe(5);
  });

  test("a kill at the end of the value still does nothing", () => {
    const el = makeTextarea("first\nsecond", 12);
    operation.deleteToEOL(el);
    expect(el.value).toBe("first\nsecond");
    expect(ringSnapshot()).toEqual([]);
  });

  /**
   * The flow the behaviour change exists for: three presses from a line start
   * take the line, the newline and the next line, and because all three begin at
   * the same caret the ring chains them into ONE entry in readline's forward
   * order. Before the change the second press found an empty region, recorded
   * nothing, and left the newline in the field forever.
   *
   * Driven through the real operation rather than the region function, because
   * the chaining is what is being asserted and that lives in the ring.
   */
  test("three kills from a line start make one entry holding both lines", () => {
    const el = makeTextarea("first\nsecond", 0);
    operation.deleteToEOL(el);
    expect(el.value).toBe("\nsecond");
    operation.deleteToEOL(el);
    expect(el.value).toBe("second");
    operation.deleteToEOL(el);
    expect(el.value).toBe("");
    expect(ringSnapshot()).toEqual(["first\nsecond"]);
  });

  /** Two presses are enough to see the join itself land on the one entry. */
  test("a kill then a newline kill chain into one entry", () => {
    const el = makeTextarea("first\nsecond", 0);
    operation.deleteToEOL(el);
    operation.deleteToEOL(el);
    expect(ringSnapshot()).toEqual(["first\n"]);
  });
});
