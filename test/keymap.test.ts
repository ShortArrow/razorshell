import { expect, test } from "vitest";
import { keymaching } from "../src/keymap";
import { Keymap } from "../src/operation";

test("ctrl and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, ctrl: true };
  const eventNoKey = new KeyboardEvent("keydown", { key: "t", ctrlKey: false });
  const eventHasKey = new KeyboardEvent("keydown", { key: "t", ctrlKey: true });
  expect(keymaching(eventNoKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});

test("alt and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, alt: true };
  const eventNoKey = new KeyboardEvent("keydown", { key: "t", altKey: false });
  const eventHasKey = new KeyboardEvent("keydown", { key: "t", altKey: true });
  expect(keymaching(eventNoKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});

test("shift and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, shift: true };
  const eventNoKey = new KeyboardEvent("keydown", {
    key: "t",
    shiftKey: false,
  });
  const eventHasKey = new KeyboardEvent("keydown", {
    key: "t",
    shiftKey: true,
  });
  expect(keymaching(eventNoKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});
