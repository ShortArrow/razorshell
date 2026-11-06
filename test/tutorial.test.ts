/**
 * The tutorial's advance rule: a step passes when a key the keymap handled
 * leaves the field in the step's Then state (see ADR-0018, "A tutorial opens
 * from the toolbar icon's menu and advances on the field state each chord
 * produces").
 */
// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { keyEventHandling } from "../src/keyhandling";
import { defaultKeymap } from "../src/keymap";
import { advances, skippedFor, stepsFor, tutorialSteps, type FieldState } from "../src/tutorial";

const then: FieldState = { value: "hello world", selectionStart: 0, selectionEnd: 0 };

describe("advances", () => {
  test("a handled key that leaves the Then state advances the step", () => {
    expect(advances(then, { ...then }, true)).toBe(true);
  });

  test("the Then state reached by a key the keymap did not handle does not advance", () => {
    expect(advances(then, { ...then }, false)).toBe(false);
  });

  test("a handled key that leaves another value does not advance", () => {
    expect(advances(then, { ...then, value: "hello" }, true)).toBe(false);
  });

  test("a handled key that leaves the caret elsewhere does not advance", () => {
    expect(advances(then, { ...then, selectionStart: 5, selectionEnd: 5 }, true)).toBe(false);
  });

  test("a handled key that leaves a selection where the Then state has a caret does not advance", () => {
    expect(advances(then, { ...then, selectionEnd: 5 }, true)).toBe(false);
  });
});

function chordFor(operationId: string): KeyboardEvent {
  const entry = defaultKeymap.find((candidate) => candidate.id === operationId)!;
  return new KeyboardEvent("keydown", {
    key: entry.key,
    ctrlKey: entry.ctrl === true,
    altKey: entry.alt === true,
    shiftKey: entry.shift === true,
    cancelable: true,
  });
}

function stateOf(field: HTMLInputElement): FieldState {
  return { value: field.value, selectionStart: field.selectionStart!, selectionEnd: field.selectionEnd! };
}

describe("tutorialSteps @C1.21", () => {
  test("the steps teach start, end, word back, kill and yank, in that order", () => {
    expect(tutorialSteps.map((step) => step.operationId)).toEqual([
      "move_cursor_to_the_beginning",
      "move_cursor_to_the_end",
      "move_cursor_to_the_previous_word",
      "delete_to_the_end_of_the_line",
      "yank",
    ]);
  });

  test("the first step opens on hello world with the caret at its end", () => {
    expect(tutorialSteps[0].given).toEqual({ value: "hello world", selectionStart: 11, selectionEnd: 11 });
  });

  test("each step opens where the one before it ends", () => {
    tutorialSteps.slice(1).forEach((step, index) => {
      expect(step.given).toEqual(tutorialSteps[index].then);
    });
  });

  test("pressing each step's default chord in order advances every step", () => {
    const field = document.createElement("input");
    document.body.append(field);
    field.value = tutorialSteps[0].given.value;
    field.setSelectionRange(tutorialSteps[0].given.selectionStart, tutorialSteps[0].given.selectionEnd);
    for (const step of tutorialSteps) {
      const event = chordFor(step.operationId);
      keyEventHandling(event, field);
      expect(stateOf(field)).toEqual(step.then);
      expect(advances(step.then, stateOf(field), event.defaultPrevented)).toBe(true);
    }
    field.remove();
  });
});

describe("stepsFor @C1.21", () => {
  test("the default keymap keeps all five steps", () => {
    expect(stepsFor(defaultKeymap)).toEqual(tutorialSteps);
  });

  test("a step whose operation is marked unassigned is left out, and the rest keep their order", () => {
    const keymap = defaultKeymap.map((entry) =>
      entry.id === "move_cursor_to_the_beginning" ? { ...entry, unassigned: true } : entry);
    expect(stepsFor(keymap)).toEqual(tutorialSteps.slice(1));
  });

  test("the yank step goes with the kill step it rests on", () => {
    const keymap = defaultKeymap.map((entry) =>
      entry.id === "delete_to_the_end_of_the_line" ? { ...entry, unassigned: true } : entry);
    expect(stepsFor(keymap).map((step) => step.operationId)).toEqual([
      "move_cursor_to_the_beginning",
      "move_cursor_to_the_end",
      "move_cursor_to_the_previous_word",
    ]);
  });

  test("a step whose operation is missing from the keymap is left out", () => {
    const keymap = defaultKeymap.filter((entry) => entry.id !== "move_cursor_to_the_previous_word");
    expect(stepsFor(keymap).map((step) => step.operationId)).not.toContain("move_cursor_to_the_previous_word");
    expect(stepsFor(keymap)).toHaveLength(4);
  });
});

describe("skippedFor @C1.21", () => {
  test("the default keymap skips nothing", () => {
    expect(skippedFor(defaultKeymap)).toEqual([]);
  });

  test("an unassigned operation's step is skipped as unassigned", () => {
    const keymap = defaultKeymap.map((entry) =>
      entry.id === "move_cursor_to_the_beginning" ? { ...entry, unassigned: true } : entry);
    expect(skippedFor(keymap)).toEqual([{ step: tutorialSteps[0], reason: "unassigned" }]);
  });

  test("a missing operation's step is skipped as unassigned", () => {
    const keymap = defaultKeymap.filter((entry) => entry.id !== "move_cursor_to_the_previous_word");
    expect(skippedFor(keymap)).toEqual([{ step: tutorialSteps[2], reason: "unassigned" }]);
  });

  test("the yank step is skipped for the kill step it rests on, after it", () => {
    const keymap = defaultKeymap.map((entry) =>
      entry.id === "delete_to_the_end_of_the_line" ? { ...entry, unassigned: true } : entry);
    expect(skippedFor(keymap)).toEqual([
      { step: tutorialSteps[3], reason: "unassigned" },
      { step: tutorialSteps[4], reason: "rests-on-skipped" },
    ]);
  });
});
