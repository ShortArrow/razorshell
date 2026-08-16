/**
 * @file languages.test.ts
 * @brief The dictionary fetch is allowed to fail; the UI is not allowed to go blank.
 *
 * `initI18n` fetches the packaged `_locales` json over `chrome.runtime.getURL`.
 * That fetch can fail — a partial unpack, a locale directory missing from the
 * build, an extension update swapping the files under a live page. When it
 * does, the module keeps no dictionary at all, and `getMessage` has to reach
 * past it to `chrome.i18n.getMessage`, which the browser resolves from the same
 * packaged messages without going through fetch. The failure mode this guards
 * against is the other branch: a caught error leaving an empty dictionary in
 * place, so every lookup resolves to "" and the options page renders labelless.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const chromeMessage = "from-chrome-i18n";

type ChromeStub = {
  i18n: { getMessage: (key: string) => string; getUILanguage: () => string };
  runtime: { getURL: (path: string) => string };
  storage: {
    sync: { get: (defaults?: unknown) => Promise<{ language: string }> };
    onChanged: { addListener: (listener: unknown) => void };
  };
};

function installChromeStub(): void {
  const stub: ChromeStub = {
    i18n: {
      getMessage: () => chromeMessage,
      getUILanguage: () => "ja",
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://razorshell-test/${path}`,
    },
    storage: {
      sync: { get: () => Promise.resolve({ language: "ja" }) },
      onChanged: { addListener: () => undefined },
    },
  };
  (globalThis as unknown as { chrome: ChromeStub }).chrome = stub;
}

describe("language dictionary loading", () => {
  beforeEach(() => {
    vi.resetModules();
    installChromeStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as unknown as { chrome?: ChromeStub }).chrome;
  });

  test("a failed dictionary fetch falls back to the browser messages @C1.12", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

    const { initI18n, getMessage } = await import("../src/languages");
    await initI18n();

    expect(getMessage("tooltip_match_type")()).toBe(chromeMessage);
    expect(getMessage("anything")()).toBe(chromeMessage);
  });

  /**
   * The counterpart: with the fetch answering, the packaged dictionary wins
   * over `chrome.i18n`. Without this the test above would still pass if
   * `getMessage` ignored the dictionaries entirely.
   */
  test("a loaded dictionary is preferred over the browser messages @C1.12", async () => {
    const dict = { tooltip_match_type: { message: "from-packaged-dict" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(dict),
        } as unknown as Response),
      ),
    );

    const { initI18n, getMessage } = await import("../src/languages");
    await initI18n();

    expect(getMessage("tooltip_match_type")()).toBe("from-packaged-dict");
  });
});
