import { expect, test } from "vitest";
import { keymaching } from "../src/keymap";
import { Keymap } from "../src/operation";

test("key and event match", () => {
  const target: Keymap = { label: "", operation: () => { }, key: "a" };
  const eventNoKey = new KeyboardEvent("", { key: "t" });
  const eventHasKey = new KeyboardEvent("", { key: "a" });
  expect(keymaching(eventHasKey, target)).toBeTruthy();
  expect(keymaching(eventNoKey, target)).not.toBeTruthy();
});

test("ctrl and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, ctrl: true };
  const eventNoKey = new KeyboardEvent("", { key: "a", ctrlKey: false });
  const eventHasKey = new KeyboardEvent("", { key: "a", ctrlKey: true });
  expect(keymaching(eventNoKey, targetNoKey)).toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});

test("alt and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, alt: true };
  const eventNoKey = new KeyboardEvent("", { key: "a", altKey: false });
  const eventHasKey = new KeyboardEvent("", { key: "a", altKey: true });
  expect(keymaching(eventNoKey, targetNoKey)).toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});

test("shift and event match", () => {
  const targetCommon: Keymap = { label: "", operation: () => { }, key: "a" };
  const targetNoKey: Keymap = { ...targetCommon };
  const targetHasKey: Keymap = { ...targetCommon, shift: true };
  const eventNoKey = new KeyboardEvent("", { key: "a", shiftKey: false });
  const eventHasKey = new KeyboardEvent("", { key: "a", shiftKey: true });
  expect(keymaching(eventNoKey, targetNoKey)).toBeTruthy();
  expect(keymaching(eventHasKey, targetNoKey)).not.toBeTruthy();
  expect(keymaching(eventNoKey, targetHasKey)).not.toBeTruthy();
  expect(keymaching(eventHasKey, targetHasKey)).toBeTruthy();
});
