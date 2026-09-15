// @vitest-environment jsdom
/**
 * The page hook wraps every keydown listener the page registers so the
 * inspector can watch it. A wrapper the page never sees is fine only if the
 * page can still take its listener back out: `removeEventListener` must undo
 * what the wrapped `addEventListener` did, for every listener shape the
 * platform accepts, or a listener the page believes gone keeps running for the
 * life of the document. Measured 2026-09-09 in real Chromium: a page listener
 * cancelling Ctrl+V stayed in force after removal while the extension was
 * loaded, and paste stayed dead until reload.
 *
 * The hook installs itself at import and never uninstalls, so this file owns
 * one import and every test shares the patched prototype.
 */
import { beforeAll, describe, expect, test, vi } from "vitest";

beforeAll(async () => {
  await import("../src/pagehook");
});

function pressKey(target: EventTarget, key = "x"): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("a page keydown listener can be removed again @C1.13", () => {
  test("a function listener stops firing once removed", () => {
    const target = document.createElement("input");
    const listener = vi.fn();
    target.addEventListener("keydown", listener);
    pressKey(target);
    target.removeEventListener("keydown", listener);
    pressKey(target);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a handleEvent object stops firing once removed", () => {
    const target = document.createElement("input");
    const listener = { handleEvent: vi.fn() };
    target.addEventListener("keydown", listener);
    pressKey(target);
    target.removeEventListener("keydown", listener);
    pressKey(target);
    expect(listener.handleEvent).toHaveBeenCalledTimes(1);
  });

  test("a capture listener is removed only with the matching capture flag", () => {
    const target = document.createElement("input");
    const listener = vi.fn();
    target.addEventListener("keydown", listener, true);
    target.removeEventListener("keydown", listener, false);
    pressKey(target);
    target.removeEventListener("keydown", listener, true);
    pressKey(target);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a document-level listener stops firing once removed", () => {
    const listener = vi.fn();
    document.addEventListener("keydown", listener);
    const target = document.createElement("input");
    document.body.appendChild(target);
    pressKey(target);
    document.removeEventListener("keydown", listener);
    pressKey(target);
    target.remove();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a listener for another event type is untouched by the hook", () => {
    const target = document.createElement("input");
    const listener = vi.fn();
    target.addEventListener("keyup", listener);
    target.removeEventListener("keyup", listener);
    target.dispatchEvent(new KeyboardEvent("keyup", { key: "x" }));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("the inspector report follows removal @C1.13", () => {
  function reportSources(target: EventTarget): string[] {
    let sources: string[] = [];
    const onResult = (event: Event) => {
      sources = (JSON.parse((event as CustomEvent<string>).detail) as { sources: string[] }).sources;
    };
    document.addEventListener("razorshell-inspect-result", onResult);
    target.dispatchEvent(new CustomEvent("razorshell-inspect-query", { bubbles: true }));
    document.removeEventListener("razorshell-inspect-result", onResult);
    return sources;
  }

  test("a removed listener no longer counts as reaching the field", () => {
    const target = document.createElement("input");
    document.body.appendChild(target);
    const listener = function markerListenerForRemovalTest(): void {};
    target.addEventListener("keydown", listener);
    expect(reportSources(target).some((s) => s.includes("markerListenerForRemovalTest"))).toBe(true);
    target.removeEventListener("keydown", listener);
    expect(reportSources(target).some((s) => s.includes("markerListenerForRemovalTest"))).toBe(false);
    target.remove();
  });

  test("a listener added twice is one registration, gone after one removal", () => {
    const target = document.createElement("input");
    document.body.appendChild(target);
    const listener = function markerListenerForDuplicateTest(): void {};
    target.addEventListener("keydown", listener);
    target.addEventListener("keydown", listener);
    const count = (sources: string[]) =>
      sources.filter((s) => s.includes("markerListenerForDuplicateTest")).length;
    expect(count(reportSources(target))).toBe(1);
    target.removeEventListener("keydown", listener);
    expect(count(reportSources(target))).toBe(0);
    target.remove();
  });
});
