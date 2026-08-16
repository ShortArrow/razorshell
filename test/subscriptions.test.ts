/**
 * The options UI remounts its whole subtree on a language change, so every
 * subscribe-style store export is called again on each remount. Without a way
 * to release a callback the lists grew monotonically and stale callbacks kept
 * firing. These tests pin the release contract from the outside: what a caller
 * can observe is whether its callback runs after a storage change, never the
 * module's internal list.
 *
 * The chrome-level bound is a design claim, not an incidental number. Each
 * store registers at most one `chrome.storage.onChanged` listener for the page
 * lifetime and fans out to an internal list, so subscriber churn must not add
 * chrome listeners at all: after 50 subscribe/unsubscribe cycles the count is
 * asserted to stay at the handful registered at module init (bound: 4).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type StorageChange = { newValue?: unknown; oldValue?: unknown };
type ChangeListener = (changes: Record<string, StorageChange>, area: string) => void;

interface ChromeStub {
  listeners: ChangeListener[];
  store: Record<string, unknown>;
  fire: (key: string, newValue: unknown) => void;
}

let stub: ChromeStub;

/**
 * @fn installChromeStub
 * @brief Put a minimal chrome on globalThis: sync storage backed by a plain
 *        object and an onChanged registry whose listeners can be counted.
 * @return ChromeStub - The listener array, the backing object and a fire helper
 */
function installChromeStub(): ChromeStub {
  const listeners: ChangeListener[] = [];
  const store: Record<string, unknown> = {};

  const chrome = {
    storage: {
      sync: {
        get: (defaults: Record<string, unknown>) => {
          const result: Record<string, unknown> = {};
          for (const key of Object.keys(defaults)) {
            result[key] = key in store ? store[key] : defaults[key];
          }
          return Promise.resolve(result);
        },
        set: (values: Record<string, unknown>) => {
          Object.assign(store, values);
          return Promise.resolve();
        },
        remove: (key: string) => {
          delete store[key];
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (listener: ChangeListener) => {
          listeners.push(listener);
        },
        removeListener: (listener: ChangeListener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    },
    i18n: {
      getAcceptLanguages: () => Promise.resolve(["en"]),
      getUILanguage: () => "en",
      getMessage: (name: string) => name,
    },
    runtime: {
      getURL: (path: string) => `https://stub/${path}`,
    },
  };

  vi.stubGlobal("chrome", chrome);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no dictionaries in the stub")));

  return {
    listeners,
    store,
    fire: (key, newValue) => {
      store[key] = newValue;
      for (const listener of [...listeners]) listener({ [key]: { newValue } }, "sync");
    },
  };
}

/**
 * A store reduced to what the release contract needs: how to subscribe, what
 * storage key drives it, a value that differs from the stored default, and the
 * init call that installs the module-level chrome listener where one exists.
 */
interface StoreCase {
  name: string;
  key: string;
  value: unknown;
  subscribe: () => Promise<(callback: () => void) => () => void>;
}

const storeCases: StoreCase[] = [
  {
    name: "urlpolicy",
    key: "urlPolicy",
    value: { defaultAction: "deny", rules: [] },
    subscribe: async () => {
      const { subscribeUrlPolicy } = await import("../src/urlpolicy");
      return (callback) => subscribeUrlPolicy(() => callback());
    },
  },
  {
    name: "keymapstore",
    key: "keymapOverrides",
    value: { forward_char: { key: "l", ctrl: true } },
    subscribe: async () => {
      const { initKeymap, onKeymapChange } = await import("../src/keymapstore");
      await initKeymap();
      return (callback) => onKeymapChange(callback);
    },
  },
  {
    name: "contenteditablesetting",
    key: "enableContentEditable",
    value: true,
    subscribe: async () => {
      const { subscribeContentEditableSetting } = await import("../src/contenteditablesetting");
      return (callback) => subscribeContentEditableSetting(() => callback());
    },
  },
  {
    name: "languages",
    key: "language",
    value: "ja",
    subscribe: async () => {
      const { initI18n, onLanguageChange } = await import("../src/languages");
      await initI18n();
      return (callback) => onLanguageChange(callback);
    },
  },
];

/** The dictionary reload in languages defers its notification through a promise chain. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  stub = installChromeStub();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(storeCases)("$name release contract", (storeCase) => {
  test("a subscriber runs on a storage change and stops after unsubscribe", async () => {
    const subscribe = await storeCase.subscribe();
    const callback = vi.fn();
    const unsubscribe = subscribe(callback);

    stub.fire(storeCase.key, storeCase.value);
    await settle();
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    stub.fire(storeCase.key, storeCase.value);
    await settle();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("unsubscribe removes exactly its own callback", async () => {
    const subscribe = await storeCase.subscribe();
    const released = vi.fn();
    const kept = vi.fn();
    const unsubscribe = subscribe(released);
    subscribe(kept);

    unsubscribe();
    stub.fire(storeCase.key, storeCase.value);
    await settle();

    expect(released).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  test("unsubscribing twice releases nothing else", async () => {
    const subscribe = await storeCase.subscribe();
    const kept = vi.fn();
    const unsubscribe = subscribe(vi.fn());
    subscribe(kept);

    unsubscribe();
    unsubscribe();
    stub.fire(storeCase.key, storeCase.value);
    await settle();

    expect(kept).toHaveBeenCalledTimes(1);
  });

  test("50 remount cycles leave one live subscriber called exactly once", async () => {
    const subscribe = await storeCase.subscribe();

    for (let cycle = 0; cycle < 50; cycle += 1) {
      const stale = vi.fn();
      subscribe(stale)();
    }

    const live = vi.fn();
    subscribe(live);
    stub.fire(storeCase.key, storeCase.value);
    await settle();

    expect(live).toHaveBeenCalledTimes(1);
  });

  test("50 remount cycles add no chrome.storage.onChanged listener", async () => {
    const subscribe = await storeCase.subscribe();
    // Stores that attach lazily register their one listener on the first
    // subscribe, so the baseline is taken once that has happened.
    subscribe(vi.fn())();
    const attached = stub.listeners.length;
    expect(attached).toBeLessThanOrEqual(1);

    for (let cycle = 0; cycle < 50; cycle += 1) {
      subscribe(vi.fn())();
    }

    expect(stub.listeners.length).toBe(attached);
  });
});

describe("every store together", () => {
  test("churn across all four stores keeps the chrome listener count within the per-module bound", async () => {
    const subscribes = [];
    for (const storeCase of storeCases) subscribes.push(await storeCase.subscribe());

    for (let cycle = 0; cycle < 50; cycle += 1) {
      for (const subscribe of subscribes) subscribe(vi.fn())();
    }

    expect(stub.listeners.length).toBeLessThanOrEqual(storeCases.length);
  });
});
