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

/**
 * The registrations list holds its target and listener weakly so an element the
 * page has discarded is not kept alive by the hook for the life of the frame.
 * That fix has no behavioral test — garbage collection cannot be forced from a
 * test, so no assertion can tell a weak reference from a strong one. Reviewers
 * must check this one by reading it. What is testable is the other half: a
 * registration the platform itself drops, which is what `{ once: true }` makes
 * happen without waiting for a collection.
 */
describe("the hook holds no page element @C1.13", () => {
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

  test("a once listener drops out of the report after it fires", () => {
    const target = document.createElement("input");
    document.body.appendChild(target);
    let calls = 0;
    const listener = function markerListenerForOnceTest(): void {
      calls += 1;
    };
    target.addEventListener("keydown", listener, { once: true });
    expect(reportSources(target).some((s) => s.includes("markerListenerForOnceTest"))).toBe(true);
    pressKey(target);
    expect(calls).toBe(1);
    expect(reportSources(target).some((s) => s.includes("markerListenerForOnceTest"))).toBe(false);
    pressKey(target);
    expect(calls).toBe(1);
    target.remove();
  });

  test("a once listener removed before firing is gone from the report", () => {
    const target = document.createElement("input");
    document.body.appendChild(target);
    const listener = function markerListenerForOnceRemovalTest(): void {};
    target.addEventListener("keydown", listener, { once: true });
    target.removeEventListener("keydown", listener);
    expect(reportSources(target).some((s) => s.includes("markerListenerForOnceRemovalTest"))).toBe(
      false,
    );
    target.remove();
  });
});

/**
 * The hook sits inside every `addEventListener` call a page makes, so a page
 * shape the hook did not expect must not turn into an exception the page never
 * threw before. Measured 2026-09-23 on the built hook: a listener whose
 * `toString` throws made the page's `addEventListener` throw, and calling the
 * method on a non-object raised "WeakRef: invalid target" where the platform
 * raises its own TypeError.
 */
describe("the hook never throws where the platform would not @C1.13", () => {
  test("a listener whose toString throws is registered and runs", () => {
    const target = document.createElement("input");
    let calls = 0;
    const listener = function markerListenerForToStringTest(): void {
      calls += 1;
    };
    listener.toString = () => {
      throw new Error("no source for you");
    };
    expect(() => target.addEventListener("keydown", listener)).not.toThrow();
    pressKey(target);
    expect(calls).toBe(1);
  });

  test("a null or undefined receiver is the global object, as the platform reads it", () => {
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    for (const receiver of [null, undefined]) {
      const listener = vi.fn();
      expect(() => add.call(receiver, "keydown", listener)).not.toThrow();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
      expect(listener).toHaveBeenCalledTimes(1);
      remove.call(receiver, "keydown", listener);
    }
  });

  test("a primitive receiver raises the platform's own error, not a WeakRef one", () => {
    const add = EventTarget.prototype.addEventListener;
    for (const receiver of [1, "x"]) {
      let message = "";
      try {
        add.call(receiver, "keydown", () => {});
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).not.toBe("");
      expect(message).not.toContain("WeakRef");
    }
  });
});
