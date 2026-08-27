/**
 * The kill ring and its chain state machine, as pure state.
 *
 * Every assertion here is derived from readline's documented kill semantics —
 * consecutive kills accumulate into one ring entry, a forward kill appending and
 * a backward kill prepending, so Ctrl+U then Ctrl+K at one caret reconstructs
 * the line — and from the design's own limits (frame-local, ten entries, a size
 * cap, nothing stored from a password field). The module did not exist when
 * these were written, so none of them can agree with an implementation by
 * construction.
 *
 * No DOM appears below: `elementToken` is an opaque reference and the caret is a
 * number the caller supplies, which is what keeps the ring testable without a
 * field.
 */
import { describe, expect, test, beforeEach } from "vitest";
import fc from "fast-check";
import {
  beginYank,
  clearRing,
  newestEntry,
  noteForeignCommand,
  recordKill,
  ringSnapshot,
  rotateYank,
  ringCapacity,
  ringEntrySizeLimit,
} from "../src/killring";

/** Two distinct opaque tokens, standing for two different fields. */
const fieldA = { name: "a" };
const fieldB = { name: "b" };

/** A storable forward kill, spelled out so each test reads as its own scenario. */
function killForward(text: string, token: object, caretAfter: number, storable = true) {
  recordKill({ direction: "forward", text, elementToken: token, caretAfter, storable });
}

/** A storable backward kill. */
function killBackward(text: string, token: object, caretAfter: number, storable = true) {
  recordKill({ direction: "backward", text, elementToken: token, caretAfter, storable });
}

beforeEach(() => {
  clearRing();
});

describe("chained kills accumulate into one entry", () => {
  test("two forward kills at the same caret append in order", () => {
    killForward("hello ", fieldA, 3);
    killForward("world", fieldA, 3);
    expect(ringSnapshot()).toEqual(["hello world"]);
  });

  test("two backward kills at the same caret prepend", () => {
    killBackward("world", fieldA, 3);
    killBackward("hello ", fieldA, 3);
    expect(ringSnapshot()).toEqual(["hello world"]);
  });

  test("backward then forward at one caret reconstructs the original line", () => {
    killBackward("abc", fieldA, 0);
    killForward("def", fieldA, 0);
    expect(ringSnapshot()).toEqual(["abcdef"]);
  });

  test("forward then backward at one caret reconstructs the original line", () => {
    killForward("def", fieldA, 3);
    killBackward("abc", fieldA, 3);
    expect(ringSnapshot()).toEqual(["abcdef"]);
  });

  test("three chained forward kills concatenate in order", () => {
    killForward("one ", fieldA, 0);
    killForward("two ", fieldA, 0);
    killForward("three", fieldA, 0);
    expect(ringSnapshot()).toEqual(["one two three"]);
  });
});

describe("the chain breaks on anything but a same-place kill", () => {
  test("a different element starts a new entry", () => {
    killForward("first", fieldA, 3);
    killForward("second", fieldB, 3);
    expect(ringSnapshot()).toEqual(["second", "first"]);
  });

  test("a moved caret starts a new entry", () => {
    killForward("first", fieldA, 3);
    killForward("second", fieldA, 7);
    expect(ringSnapshot()).toEqual(["second", "first"]);
  });

  test("an interposed foreign command starts a new entry", () => {
    killForward("first", fieldA, 3);
    noteForeignCommand(fieldA);
    killForward("second", fieldA, 3);
    expect(ringSnapshot()).toEqual(["second", "first"]);
  });

  test("a non-storable kill stores nothing and breaks the chain", () => {
    killForward("first", fieldA, 3);
    killForward("secret", fieldA, 3, false);
    killForward("second", fieldA, 3);
    expect(ringSnapshot()).toEqual(["second", "first"]);
  });

  test("a non-storable kill alone leaves the ring empty", () => {
    killForward("secret", fieldA, 3, false);
    expect(ringSnapshot()).toEqual([]);
    expect(newestEntry()).toBeUndefined();
  });
});

describe("an empty kill is not an event the ring sees", () => {
  test("empty text stores nothing", () => {
    killForward("", fieldA, 3);
    expect(ringSnapshot()).toEqual([]);
  });

  test("an empty kill between two chained kills leaves the chain intact", () => {
    killForward("hello ", fieldA, 3);
    killForward("", fieldA, 3);
    killForward("world", fieldA, 3);
    expect(ringSnapshot()).toEqual(["hello world"]);
  });

  test("an empty kill on another element still leaves the chain intact", () => {
    killForward("hello ", fieldA, 3);
    killForward("", fieldB, 9);
    killForward("world", fieldA, 3);
    expect(ringSnapshot()).toEqual(["hello world"]);
  });
});

describe("the ring holds ten entries", () => {
  test("capacity is ten", () => {
    expect(ringCapacity).toBe(10);
  });

  test("an eleventh distinct entry evicts the oldest", () => {
    for (let i = 1; i <= 11; i += 1) killForward(`kill${i}`, fieldA, i);
    const snapshot = ringSnapshot();
    expect(snapshot).toHaveLength(10);
    expect(snapshot[0]).toBe("kill11");
    expect(snapshot[9]).toBe("kill2");
    expect(snapshot).not.toContain("kill1");
  });
});

describe("an oversized kill happens but is not stored", () => {
  test("the limit is a hundred thousand code units", () => {
    expect(ringEntrySizeLimit).toBe(100000);
  });

  test("a text at the limit is stored", () => {
    killForward("x".repeat(100000), fieldA, 0);
    expect(ringSnapshot()).toHaveLength(1);
    expect(newestEntry()).toHaveLength(100000);
  });

  test("a text one unit past the limit is not stored", () => {
    killForward("x".repeat(100001), fieldA, 0);
    expect(ringSnapshot()).toEqual([]);
  });

  test("a chained kill that would cross the limit is not stored", () => {
    killForward("x".repeat(99999), fieldA, 0);
    killForward("yy", fieldA, 0);
    expect(ringSnapshot()).toEqual(["x".repeat(99999)]);
  });
});

describe("clearRing empties everything the frame held", () => {
  test("entries and chain state both go", () => {
    killForward("hello ", fieldA, 3);
    clearRing();
    killForward("world", fieldA, 3);
    expect(ringSnapshot()).toEqual(["world"]);
  });
});

describe("the yank state machine", () => {
  test("rotating before any yank is illegal", () => {
    killForward("hello", fieldA, 0);
    expect(rotateYank()).toBeUndefined();
  });

  test("beginYank on an empty ring reports nothing to yank", () => {
    expect(beginYank()).toBeUndefined();
  });

  test("beginYank hands back the newest entry", () => {
    killForward("older", fieldA, 0);
    killForward("newer", fieldB, 0);
    expect(beginYank()).toBe("newer");
  });

  test("rotation walks newest to older and wraps", () => {
    killForward("one", fieldA, 0);
    killForward("two", fieldB, 0);
    killForward("three", fieldA, 5);
    expect(beginYank()).toBe("three");
    expect(rotateYank()).toBe("two");
    expect(rotateYank()).toBe("one");
    expect(rotateYank()).toBe("three");
  });

  test("a foreign command ends the yank sequence", () => {
    killForward("one", fieldA, 0);
    killForward("two", fieldB, 0);
    expect(beginYank()).toBe("two");
    noteForeignCommand(fieldA);
    expect(rotateYank()).toBeUndefined();
  });

  test("a kill ends the yank sequence", () => {
    killForward("one", fieldA, 0);
    killForward("two", fieldB, 0);
    expect(beginYank()).toBe("two");
    killForward("three", fieldA, 9);
    expect(rotateYank()).toBeUndefined();
  });

  test("a yank does not chain onto the kill that preceded it", () => {
    killForward("hello ", fieldA, 3);
    expect(beginYank()).toBe("hello ");
    killForward("world", fieldA, 3);
    expect(ringSnapshot()).toEqual(["world", "hello "]);
  });

  test("a fresh beginYank restarts at the newest entry", () => {
    killForward("one", fieldA, 0);
    killForward("two", fieldB, 0);
    expect(beginYank()).toBe("two");
    expect(rotateYank()).toBe("one");
    expect(beginYank()).toBe("two");
  });
});

/** A kill the ring will store: non-empty and within the size cap. */
const storableKill = fc.record({
  direction: fc.constantFrom<"forward" | "backward">("forward", "backward"),
  text: fc.string({ minLength: 1, maxLength: 8 }),
  token: fc.constantFrom(fieldA, fieldB),
  caretAfter: fc.integer({ min: 0, max: 3 }),
});

describe("ring properties", () => {
  test("P1 the ring never exceeds its capacity", () => {
    fc.assert(
      fc.property(fc.array(storableKill, { maxLength: 40 }), (kills) => {
        clearRing();
        for (const kill of kills) {
          recordKill({
            direction: kill.direction,
            text: kill.text,
            elementToken: kill.token,
            caretAfter: kill.caretAfter,
            storable: true,
          });
        }
        expect(ringSnapshot().length).toBeLessThanOrEqual(ringCapacity);
      }),
    );
  });

  test("P2 rotating ring-length times returns to the newest entry", () => {
    let sawStored = false;
    fc.assert(
      fc.property(fc.array(storableKill, { minLength: 1, maxLength: 25 }), (kills) => {
        clearRing();
        for (const kill of kills) {
          recordKill({
            direction: kill.direction,
            text: kill.text,
            elementToken: kill.token,
            caretAfter: kill.caretAfter,
            storable: true,
          });
        }
        const size = ringSnapshot().length;
        expect(size).toBeGreaterThan(0);
        sawStored = true;
        const newest = beginYank();
        expect(newest).toBe(newestEntry());
        let last: string | undefined;
        for (let i = 0; i < size; i += 1) last = rotateYank();
        expect(last).toBe(newest);
      }),
    );
    expect(sawStored, "no run stored an entry, so P2 asserted nothing").toBe(true);
  });

  test("P3 a chained run's entry is its pieces concatenated in readline order", () => {
    let sawChained = false;
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            direction: fc.constantFrom<"forward" | "backward">("forward", "backward"),
            text: fc.string({ minLength: 1, maxLength: 6 }),
          }),
          { minLength: 2, maxLength: 6 },
        ),
        (pieces) => {
          clearRing();
          let expected = "";
          for (const piece of pieces) {
            expected =
              piece.direction === "forward" ? expected + piece.text : piece.text + expected;
            recordKill({
              direction: piece.direction,
              text: piece.text,
              elementToken: fieldA,
              caretAfter: 7,
              storable: true,
            });
          }
          sawChained = true;
          expect(ringSnapshot()).toEqual([expected]);
        },
      ),
    );
    expect(sawChained, "no chained run was generated, so P3 asserted nothing").toBe(true);
  });
});
