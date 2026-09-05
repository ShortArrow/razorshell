/**
 * End-to-end suite for the unpacked extension.
 *
 * The whole file is one serial scenario: a single persistent context and a
 * single test page are carried across tests, because the extension's state
 * lives in `chrome.storage.sync` and each block builds on the settings the
 * previous one left behind. Parallel execution would interleave those writes.
 *
 * The extension is loaded from `dist/`, so `pnpm build` must have run first;
 * `beforeAll` fails with that instruction rather than letting Chromium start
 * without the extension. The extension ID is read back from the service
 * worker URL instead of being hardcoded, so the suite survives a checkout at
 * any path. Chromium must be the full build (`channel: "chromium"`) because
 * the default headless shell cannot load extensions.
 *
 * The HTTP server answers every path with `testtarget.html`, which lets the
 * same origin stand in for a sub-frame document and for SPA routes that were
 * never really served.
 */
import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { parseSettings } from "../../src/settingsio";
import { availableLocales } from "../../src/i18n";
import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, "../../dist");
const testTargetPath = path.resolve(here, "../../testtarget.html");
const userDataDir = path.resolve(here, "../../test-results/e2e-user-data");

let server: http.Server;
let origin: string;
let context: BrowserContext;
let extensionId: string;
let page: Page;
let optionsPage: Page;
let consoleLogs: string[];
let optionsPageErrors: string[];

function launchOptions() {
  return {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  } as const;
}

/**
 * The service worker starts on the first `chrome.runtime.sendMessage` from a
 * content script, so a loaded test page is the precondition for this call.
 */
async function resolveExtensionId(ctx: BrowserContext): Promise<string> {
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  return new URL(worker.url()).host;
}

function optionsUrl(): string {
  return `chrome-extension://${extensionId}/options.html`;
}

function fieldState(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => ({
    value: el.value,
    start: el.selectionStart,
    end: el.selectionEnd,
  }));
}

function caretState(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => ({
    start: el.selectionStart,
    end: el.selectionEnd,
  }));
}

async function setPolicy(policy: unknown): Promise<void> {
  await optionsPage.evaluate(
    (value) => chrome.storage.sync.set({ urlPolicy: value }),
    policy,
  );
  await page.waitForTimeout(500);
}

async function seedTextInput(value: string, caret: number): Promise<void> {
  await page.locator('input[type="text"]').first().evaluate(
    (el: HTMLInputElement, args: { value: string; caret: number }) => {
      el.value = args.value;
      el.focus();
      el.setSelectionRange(args.caret, args.caret);
    },
    { value, caret },
  );
}

/**
 * The inspector toast, read from its own container rather than the whole body,
 * so an assertion cannot be satisfied by text that happens to sit on the page.
 */
function toastText(): Promise<string> {
  return page.evaluate(
    () => document.getElementById("razorshell-inspect-toast")?.innerText ?? "",
  );
}

/**
 * Listeners the tests attach to observe the extension are removed again through
 * these handles. Left in place they would leak into the inspector's report,
 * which counts every keydown listener reaching the clicked field.
 */
async function addPageKeydownListener(
  slot: "cancelCtrlK" | "dispatchAltB",
): Promise<void> {
  await page.evaluate((which) => {
    const store = window as unknown as Record<string, EventListener>;
    if (which === "cancelCtrlK") {
      const handler = (e: Event) => {
        const key = e as KeyboardEvent;
        if (key.ctrlKey && key.key === "k") key.preventDefault();
      };
      store.__rsCancelCtrlK = handler;
      document.querySelector('input[type="text"]')!.addEventListener("keydown", handler);
      return;
    }
    const handler = (e: Event) => {
      const key = e as KeyboardEvent;
      if (key.altKey && key.key === "b") key.preventDefault();
    };
    store.__rsDispatchAltB = handler;
    document.addEventListener("keydown", handler);
  }, slot);
}

async function removePageKeydownListener(
  slot: "cancelCtrlK" | "dispatchAltB",
): Promise<void> {
  await page.evaluate((which) => {
    const store = window as unknown as Record<string, EventListener | undefined>;
    if (which === "cancelCtrlK") {
      const handler = store.__rsCancelCtrlK;
      if (handler) {
        document.querySelector('input[type="text"]')!.removeEventListener("keydown", handler);
        delete store.__rsCancelCtrlK;
      }
      return;
    }
    const handler = store.__rsDispatchAltB;
    if (handler) {
      document.removeEventListener("keydown", handler);
      delete store.__rsDispatchAltB;
    }
  }, slot);
}

/** Arms inspect mode on the content page from the extension side. */
async function startInspecting(): Promise<void> {
  await optionsPage.evaluate(async (base) => {
    const tabs = await chrome.tabs.query({ url: `${base}/*` });
    await chrome.tabs.sendMessage(tabs[0].id!, { type: "razorshell-inspect" });
  }, origin);
  await page.waitForTimeout(400);
}

/**
 * The override layer as `chrome.storage.sync` actually holds it. The rendered
 * rows are a claim about this value, so assertions that must not be satisfied
 * by a stale render read it here instead of reading the table.
 */
function storedOverrides(): Promise<Record<string, unknown>> {
  return optionsPage.evaluate(async () => {
    const data = (await chrome.storage.sync.get("keymapOverrides")) as {
      keymapOverrides?: Record<string, unknown>;
    };
    return data.keymapOverrides ?? {};
  });
}

/** The url policy as stored, with the same intent as `storedOverrides`. */
function storedPolicy(): Promise<{
  defaultAction?: string;
  rules?: { pattern: string; matchType: string; action: string }[];
}> {
  return optionsPage.evaluate(async () => {
    const data = (await chrome.storage.sync.get("urlPolicy")) as {
      urlPolicy?: { defaultAction?: string; rules?: never[] };
    };
    return data.urlPolicy ?? {};
  });
}

function storedRules(): Promise<{ pattern: string; matchType: string; action: string }[]> {
  return storedPolicy().then((policy) => policy.rules ?? []);
}

function badgeText(): Promise<string> {
  return optionsPage.evaluate(async (base) => {
    const tabs = await chrome.tabs.query({ url: `${base}/*` });
    return chrome.action.getBadgeText({ tabId: tabs[0].id });
  }, origin);
}

/**
 * The badge as it stands on one named tab. `badgeText` takes whichever tab the
 * query returns first, which is enough while a single content tab is open but
 * cannot tell two apart — a per-tab claim has to name the tab it is about.
 */
function badgeTextOfTab(tabId: number): Promise<string> {
  return optionsPage.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
}

/**
 * The extension's own view of a page, which is the id the badge is keyed by.
 * Playwright's `Page` carries no tab id, so the url it was opened at is the
 * handle that crosses into `chrome.tabs`.
 */
function tabIdForUrl(url: string): Promise<number> {
  return optionsPage.evaluate(async (target) => {
    const tabs = await chrome.tabs.query({ url: target });
    if (tabs.length !== 1) throw new Error(`expected 1 tab at ${target}, found ${tabs.length}`);
    return tabs[0].id!;
  }, url);
}

/**
 * One word forward from caret 0 in "hello world", measured rather than assumed:
 * a single Alt+f lands on 5, two land on 11. That gap is the whole point of the
 * @C1.13 tests — an idempotent chord like Ctrl+a cannot tell one run from two,
 * while a doubled handler overshoots 5 and lands on 11. Verified by flipping
 * the expectation to 11: the assertion fails with `received 5`, so it is the
 * single run it claims to measure and not a number that passes either way.
 */
const oneWordForward = 5;

/** Seeds "hello world" at caret 0 in the content page and presses Alt+f once. */
async function pressAltFOnceOnContentPage(): Promise<{ start: number | null; end: number | null }> {
  await seedTextInput("hello world", 0);
  await page.keyboard.press("Alt+f");
  return caretState(page.locator('input[type="text"]').first());
}

/** The same single Alt+f, in the options page's own test field. */
async function pressAltFOnceOnOptionsInput(): Promise<{ start: number | null; end: number | null }> {
  const optInput = optionsPage.locator('[data-testid="test-input"]');
  await optInput.evaluate((el: HTMLInputElement) => {
    el.value = "hello world";
    el.focus();
    el.setSelectionRange(0, 0);
  });
  await optionsPage.keyboard.press("Alt+f");
  return caretState(optInput);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(distPath, "manifest.json"))) {
    throw new Error(
      `No built extension at ${distPath}. Run \`pnpm build\` before \`pnpm test:e2e\`.`,
    );
  }

  const testPage = fs.readFileSync(testTargetPath, "utf8");
  server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(testPage);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  context = await chromium.launchPersistentContext(userDataDir, launchOptions());

  page = await context.newPage();
  consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(msg.text()));
  await page.goto(`${origin}/`);
  await page.waitForTimeout(1500);

  extensionId = await resolveExtensionId(context);
  optionsPage = await context.newPage();
  optionsPageErrors = [];
  optionsPage.on("pageerror", (err) => optionsPageErrors.push(err.message));
  await optionsPage.goto(optionsUrl());
  await optionsPage.waitForTimeout(1500);
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test.describe("content script keybindings", () => {
  test("content script is injected", () => {
    expect(consoleLogs.some((t) => t.includes("extension razorshell loaded"))).toBe(true);
  });

  test("cursor motion in a text input @C1.1", async () => {
    const input = page.locator('input[type="text"]').first();
    await input.click();
    await page.keyboard.press("End");

    await page.keyboard.press("Control+a");
    await expect.poll(() => fieldState(input)).toEqual({
      value: "hello world new order",
      start: 0,
      end: 0,
    });

    await page.keyboard.press("Control+e");
    expect(await fieldState(input)).toEqual({
      value: "hello world new order",
      start: 21,
      end: 21,
    });

    await page.keyboard.press("Alt+b");
    expect(await fieldState(input)).toEqual({
      value: "hello world new order",
      start: 16,
      end: 16,
    });

    await page.keyboard.press("Control+b");
    expect(await fieldState(input)).toEqual({
      value: "hello world new order",
      start: 15,
      end: 15,
    });

    await page.keyboard.press("Alt+f");
    expect(await fieldState(input)).toEqual({
      value: "hello world new order",
      start: 21,
      end: 21,
    });
  });

  test("line deletion in a text input @C1.1", async () => {
    const input = page.locator('input[type="text"]').first();
    await page.keyboard.press("Control+a");
    for (let i = 0; i < 5; i++) await page.keyboard.press("Control+f");
    await page.keyboard.press("Control+k");
    expect(await fieldState(input)).toEqual({ value: "hello", start: 5, end: 5 });

    await page.keyboard.press("Control+e");
    await page.keyboard.press("Control+b");
    await page.keyboard.press("Control+u");
    expect(await fieldState(input)).toEqual({ value: "o", start: 0, end: 0 });
  });

  test("textarea operates on the current line @C1.1", async () => {
    const ta = page.locator("textarea");
    await ta.evaluate((el: HTMLTextAreaElement) => {
      el.value = "first line\nsecond line\nthird";
      el.focus();
      el.setSelectionRange(15, 15);
    });

    await page.keyboard.press("Control+e");
    expect(await fieldState(ta)).toEqual({
      value: "first line\nsecond line\nthird",
      start: 22,
      end: 22,
    });

    await page.keyboard.press("Control+u");
    expect(await fieldState(ta)).toEqual({
      value: "first line\n\nthird",
      start: 11,
      end: 11,
    });
  });

  test("dynamically added input is covered @C1.1", async () => {
    await page.evaluate(() => {
      const dyn = document.createElement("input");
      dyn.type = "text";
      dyn.id = "rs-dynamic-input";
      dyn.value = "dynamic input";
      document.body.appendChild(dyn);
      dyn.focus();
      dyn.setSelectionRange(dyn.value.length, dyn.value.length);
    });
    await page.keyboard.press("Control+a");

    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement;
      return { start: el.selectionStart, end: el.selectionEnd };
    });
    expect(state).toEqual({ start: 0, end: 0 });

    await page.evaluate(() => document.getElementById("rs-dynamic-input")?.remove());
  });

  test("an input inside a closed shadow root is out of reach, so Ctrl+a stays the native select-all @C1.11", async () => {
    await page.evaluate(() => {
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "closed" });
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = "hello world";
      root.appendChild(inp);
      host.id = "rs-closed-host";
      document.body.appendChild(host);
      (window as unknown as { __closedInput: HTMLInputElement }).__closedInput = inp;
    });

    await page.evaluate(() => {
      const inp = (window as unknown as { __closedInput: HTMLInputElement }).__closedInput;
      inp.focus();
      inp.setSelectionRange(11, 11);
    });

    await page.keyboard.press("Control+a");

    const state = await page.evaluate(() => {
      const inp = (window as unknown as { __closedInput: HTMLInputElement }).__closedInput;
      return { start: inp.selectionStart, end: inp.selectionEnd };
    });
    expect(state).toEqual({ start: 0, end: 11 });

    await page.evaluate(() => {
      document.getElementById("rs-closed-host")?.remove();
      delete (window as unknown as { __closedInput?: HTMLInputElement }).__closedInput;
    });
  });

  test("input inside an iframe is covered @C1.1", async () => {
    await page.evaluate((base) => {
      const frame = document.createElement("iframe");
      frame.src = `${base}/frame`;
      frame.id = "childframe";
      document.body.appendChild(frame);
      return new Promise((resolve) => frame.addEventListener("load", resolve));
    }, origin);

    const frameInput = page.frameLocator("#childframe").locator('input[type="text"]');
    await frameInput.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Control+a");
    expect(await caretState(frameInput)).toEqual({ start: 0, end: 0 });
  });

  test("password input is covered @C1.1", async () => {
    const pwd = page.locator('input[type="password"]');
    await pwd.evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    await page.keyboard.press("Control+a");
    expect(await caretState(pwd)).toEqual({ start: 0, end: 0 });
  });

  test("email input keeps native select-all @C1.11", async () => {
    await page.evaluate(() => {
      const el = document.createElement("input");
      el.type = "email";
      el.id = "hero_user_email";
      el.value = "user@example.com";
      document.body.appendChild(el);
      el.focus();
    });
    await page.keyboard.press("Control+a");
    await page.keyboard.type("x");

    const value = await page.evaluate(
      () => (document.getElementById("hero_user_email") as HTMLInputElement).value,
    );
    expect(value).toBe("x");

    await page.evaluate(() => document.getElementById("hero_user_email")?.remove());
  });
});

test.describe("options page", () => {
  test("renders without errors", async () => {
    const rendered = await optionsPage.evaluate(
      () => (document.querySelector("#root")?.children.length ?? 0) > 0,
    );
    expect(rendered).toBe(true);
    expect(optionsPageErrors).toEqual([]);

    const isSvg = await optionsPage.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>("img[alt='icon']");
      if (!img) return "img not found";
      const text = await fetch(img.src).then((r) => r.text());
      return text.includes("<svg") ? true : `not svg: ${text.slice(0, 40)}`;
    });
    expect(isSvg).toBe(true);
  });

  test("test area handles the chord itself", async () => {
    const testInput = optionsPage.locator('[data-testid="test-input"]');
    await testInput.click();
    await optionsPage.keyboard.press("End");
    await optionsPage.keyboard.press("Control+a");
    expect(await caretState(testInput)).toEqual({ start: 0, end: 0 });

    const status = await optionsPage.locator('[data-testid="last-status"]').innerText();
    expect(status).toContain("Ctrl");
    expect(status).toContain("handled");

    await expect(optionsPage.locator('[data-testid="test-input-selection"]')).toContainText(
      "start=0 end=0",
    );
  });

  test("theme toggle persists across a reload", async () => {
    const readTheme = () =>
      optionsPage.evaluate(() => document.documentElement.dataset.theme);
    const before = await readTheme();

    await optionsPage.locator('[data-testid="theme-toggle"]').click({ force: true });
    await optionsPage.waitForTimeout(300);
    const after = await readTheme();
    expect(after).not.toBe(before);

    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);
    expect(await readTheme()).toBe(after);
  });

  test("language override switches the tooltips", async () => {
    const tooltipHas = (text: string) =>
      optionsPage.evaluate(
        (t) =>
          Array.from(document.querySelectorAll<HTMLElement>("[data-tip]")).some((el) =>
            (el.dataset.tip ?? "").includes(t),
          ),
        text,
      );

    expect(await tooltipHas("Move cursor to the beginning")).toBe(true);
    expect(await tooltipHas("Applied when no rule matches")).toBe(true);

    await optionsPage.locator('[data-testid="language-select"]').selectOption("ja");
    await optionsPage.waitForTimeout(700);
    expect(await tooltipHas("行の先頭までカーソルを移動")).toBe(true);
    expect(await tooltipHas("どのルールにもマッチしない")).toBe(true);
    await expect(optionsPage.locator('[data-testid="effective-language"]')).toContainText("ja");

    await optionsPage.locator('[data-testid="language-select"]').selectOption("auto");
    await optionsPage.waitForTimeout(700);
    expect(await tooltipHas("Move cursor to the beginning")).toBe(true);
  });

  /**
   * The test above proves the override mechanism on one locale. This one proves
   * the packaging: every locale in `availableLocales` must have a dictionary
   * that actually reaches the DOM. A locale whose directory is missing from the
   * build, or whose json fails to parse, falls back to english and renders a
   * plausible page — so the assertion compares against the locale's own
   * `messages.json` read from disk rather than against a hardcoded string.
   *
   * `tooltip_match_type` is the probe key: it sits on the add-rule form, which
   * renders whatever the url policy currently holds, so this test does not
   * depend on the rules the surrounding blocks leave behind. It restores "auto"
   * at the end, which is the state the following describes expect.
   */
  test("every packaged locale reaches the tooltips @C1.12", async () => {
    const localesDir = path.resolve(here, "../../src/_locales");
    const messageFor = (locale: string) => {
      const raw = fs.readFileSync(path.join(localesDir, locale, "messages.json"), "utf8");
      return (JSON.parse(raw) as Record<string, { message: string }>).tooltip_match_type.message;
    };
    const tooltips = () =>
      optionsPage.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-tip]")).map(
          (el) => el.dataset.tip ?? "",
        ),
      );

    for (const locale of availableLocales) {
      await optionsPage.locator('[data-testid="language-select"]').selectOption(locale);
      await optionsPage.waitForTimeout(700);
      expect(await tooltips(), `locale ${locale}`).toContain(messageFor(locale));
      await expect(optionsPage.locator('[data-testid="effective-language"]')).toContainText(
        locale,
      );
    }

    await optionsPage.locator('[data-testid="language-select"]').selectOption("auto");
    await optionsPage.waitForTimeout(700);
    expect(await tooltips()).toContain(messageFor("en"));
  });
});

test.describe("keymap rebinding @C1.5", () => {
  const currentChord = (id: string) =>
    optionsPage
      .locator(`[data-testid="current-${id}"]`)
      .innerText()
      .then((t) => t.replace(/\s+/g, ""));

  test("a rebound chord takes effect everywhere", async () => {
    await optionsPage.locator('[data-testid="rebind-move_cursor_to_the_beginning"]').click();
    await optionsPage.keyboard.press("Control+m");
    await optionsPage.waitForTimeout(500);
    expect(await currentChord("move_cursor_to_the_beginning")).toBe("Ctrl+m");

    const optInput = optionsPage.locator('[data-testid="test-input"]');
    await optInput.evaluate((el: HTMLInputElement) => {
      el.value = "hello world";
      el.focus();
      el.setSelectionRange(11, 11);
    });
    await optionsPage.keyboard.press("Control+m");
    expect(await caretState(optInput)).toEqual({ start: 0, end: 0 });

    await optionsPage.keyboard.press("End");
    await optionsPage.keyboard.press("Control+a");
    expect(await caretState(optInput)).toEqual({ start: 0, end: 11 });

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+m");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });
  });

  test("a conflicting chord is rejected", async () => {
    await optionsPage.locator('[data-testid="rebind-move_cursor_to_the_end"]').click();
    await optionsPage.keyboard.press("Control+m");
    await optionsPage.waitForTimeout(300);

    await expect(
      optionsPage.locator('[data-testid="conflict-move_cursor_to_the_end"]'),
    ).toContainText("move cursor to the beginning");
    expect(await currentChord("move_cursor_to_the_end")).toBe("Ctrl+e");

    // The row reverting is what the GUI shows; storage is what the content
    // script reads. A rejected capture must never have reached it.
    expect(await storedOverrides()).not.toHaveProperty("move_cursor_to_the_end");
  });

  test("rebinding the rejected row to a free chord clears the conflict", async () => {
    await optionsPage.locator('[data-testid="rebind-move_cursor_to_the_end"]').click();
    await optionsPage.keyboard.press("Control+Shift+9");
    await optionsPage.waitForTimeout(500);

    const chord = await currentChord("move_cursor_to_the_end");
    expect(chord).toContain("Ctrl");
    expect(chord).toContain("Shift");
    expect(chord).toContain("9");

    await expect(
      optionsPage.locator('[data-testid="conflict-move_cursor_to_the_end"]'),
    ).toHaveCount(0);
    await expect(optionsPage.locator('[data-testid="keymap-no-conflict"]')).toHaveCount(1);

    // Chromium reports Digit9 under Shift as key "9", not "(" — verified by
    // reading KeyboardEvent.key for this exact press.
    await expect.poll(() => storedOverrides()).toMatchObject({
      move_cursor_to_the_end: { key: "9", ctrl: true, alt: false, shift: true },
    });
    expect((await storedOverrides()).move_cursor_to_the_end).toEqual({
      key: "9",
      ctrl: true,
      alt: false,
      shift: true,
    });
  });

  /**
   * Reset all is the one mutation whose failure the GUI cannot betray: the rows
   * re-render from the defaults either way. Only storage and the content script
   * distinguish a real reset from a silent no-op, so both are read here.
   *
   * Unmodified Ctrl+m carries no native caret action in Chromium (verified),
   * so an unmoved caret is evidence the binding is gone rather than evidence of
   * a fallback.
   */
  test("reset all restores the defaults", async () => {
    await optionsPage.locator('[data-testid="keymap-reset-all"]').click();
    await optionsPage.waitForTimeout(500);
    expect(await currentChord("move_cursor_to_the_beginning")).toBe("Ctrl+a");

    await expect.poll(() => storedOverrides()).toEqual({});

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+m");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 11,
      end: 11,
    });

    await page.keyboard.press("Control+a");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });
  });

  /**
   * Capture mode installs a document-level keydown listener that swallows the
   * next key and binds it. Its removal rides on the effect cleanup, so an
   * unmount that skipped the cleanup would leave a listener that steals the
   * user's next keystroke into a binding they never asked for.
   *
   * The language change is what remounts: the options root is keyed on a
   * generation the language subscription bumps, so switching away and back
   * unmounts the whole subtree while the capture is still armed.
   *
   * A plain letter is the probe, because a leaked listener calls
   * `preventDefault` on anything non-modifier: the character reaching the field
   * is what proves nothing intercepted it, and storage is what proves nothing
   * was bound behind the render.
   */
  test("an abandoned rebind capture leaves no key handler behind", async () => {
    const rebind = optionsPage.locator('[data-testid="rebind-move_cursor_to_the_end"]');
    await rebind.click();
    await expect(rebind.locator(".loading")).toHaveCount(1);

    await optionsPage.locator('[data-testid="language-select"]').selectOption("ja");
    await optionsPage.waitForTimeout(700);
    await optionsPage.locator('[data-testid="language-select"]').selectOption("auto");
    await optionsPage.waitForTimeout(700);

    const optInput = optionsPage.locator('[data-testid="test-input"]');
    await optInput.evaluate((el: HTMLInputElement) => {
      el.value = "";
      el.focus();
      el.setSelectionRange(0, 0);
    });
    await optionsPage.keyboard.press("m");
    await optionsPage.waitForTimeout(400);

    expect(await optInput.evaluate((el: HTMLInputElement) => el.value)).toBe("m");
    expect(await storedOverrides()).not.toHaveProperty("move_cursor_to_the_end");
    await expect(
      optionsPage.locator('[data-testid="rebind-move_cursor_to_the_end"]').locator(".loading"),
    ).toHaveCount(0);
  });
});

test.describe("url policy @C1.3", () => {
  test("a deny rule disables the keybindings", async () => {
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: `${origin}/`, matchType: "exact", action: "deny" }],
    });

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 11,
    });

    expect(await badgeText()).toBe("✕");
  });

  test("the first matching rule beats the default action", async () => {
    await setPolicy({
      defaultAction: "deny",
      rules: [{ pattern: `${origin}/**`, matchType: "glob", action: "allow" }],
    });

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 0,
    });

    expect(await badgeText()).toBe("");
  });

  test("the probe reports the matching rule", async () => {
    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);

    const host = new URL(origin).host;
    await expect(optionsPage.locator("body")).toContainText(host);

    await optionsPage.locator('[data-testid="url-probe-input"]').fill(`${origin}/`);
    await expect(optionsPage.locator('tr[data-matched="true"]')).toHaveCount(1);
    await expect(optionsPage.locator('[data-testid="url-probe-result"]')).toHaveText("allow");

    await optionsPage.locator('[data-testid="url-probe-input"]').fill("https://unmatched.example/");
    await expect(optionsPage.locator('[data-testid="url-probe-result"]')).toHaveText(
      "default: deny",
    );
    await expect(optionsPage.locator('tr[data-matched="true"]')).toHaveCount(0);
  });

  test("the legacy url list migrates into exact deny rules", async () => {
    await optionsPage.evaluate(() => chrome.storage.sync.remove(["urlPolicy"]));
    await optionsPage.evaluate(
      (url) => chrome.storage.sync.set({ urls: [url] }),
      `${origin}/`,
    );

    await page.reload();
    await page.waitForTimeout(500);

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 11,
    });

    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);
    await expect(optionsPage.locator("body")).toContainText("exact");
    await expect(optionsPage.locator("body")).toContainText("deny");

    const legacy = await optionsPage.evaluate(() => chrome.storage.sync.get("urls"));
    expect(legacy).toEqual({});

    await setPolicy({ defaultAction: "allow", rules: [] });
  });

  test("a same-document navigation re-evaluates the policy @C1.4", async () => {
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: `${origin}/denied-spa`, matchType: "exact", action: "deny" }],
    });

    await page.evaluate(() => history.pushState({}, "", "/denied-spa"));
    await page.waitForTimeout(400);
    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 11,
    });
    expect(await badgeText()).toBe("✕");

    await page.evaluate(() => history.back());
    await page.waitForTimeout(400);
    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 0,
    });
    expect(await badgeText()).toBe("");

    await setPolicy({ defaultAction: "allow", rules: [] });
  });
});

/**
 * The url policy describe above drives storage directly. This one drives the
 * same policy through the rendered controls, so the wiring between the form,
 * `chrome.storage.sync` and the content script is what is under test rather
 * than the rule evaluation, which the previous describe already covers.
 *
 * It inherits `{defaultAction:'allow', rules:[]}` from that describe's last
 * test and leaves exactly that state behind, so the blocks after it are
 * unaffected.
 */
test.describe("url rules edited through the gui @C1.3", () => {
  // Both selects are labelled only by their tooltip message, so the accessible
  // name is the handle the real DOM offers. Matching a stable fragment of it
  // keeps the locator readable and survives rewording around it.
  const patternInput = () => optionsPage.getByPlaceholder("pattern");
  const matchTypeSelect = () => optionsPage.getByLabel(/exact: whole URL/);
  const actionSelect = () => optionsPage.getByLabel(/allow enables the keybindings/);
  const denyRule = () => ({ pattern: `${origin}/**`, matchType: "glob", action: "deny" });
  const allowRule = () => ({ pattern: `${origin}/other`, matchType: "exact", action: "allow" });

  test.beforeAll(async () => {
    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);
  });

  test("a rule added through the form reaches storage and the content script", async () => {
    await patternInput().fill(`${origin}/**`);
    await matchTypeSelect().selectOption("glob");
    await actionSelect().selectOption("deny");
    await optionsPage.getByRole("button", { name: "add rule" }).click();

    await expect.poll(() => storedRules()).toEqual([denyRule()]);

    await page.waitForTimeout(500);
    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 11,
    });
    expect(await badgeText()).toBe("✕");
  });

  test("the reorder buttons rewrite the stored order", async () => {
    await patternInput().fill(`${origin}/other`);
    await matchTypeSelect().selectOption("exact");
    await actionSelect().selectOption("allow");
    await optionsPage.getByRole("button", { name: "add rule" }).click();

    await expect.poll(() => storedRules()).toEqual([denyRule(), allowRule()]);

    await optionsPage.getByRole("button", { name: "move rule 2 up" }).click();
    await expect.poll(() => storedRules()).toEqual([allowRule(), denyRule()]);

    await optionsPage.getByRole("button", { name: "move rule 1 down" }).click();
    await expect.poll(() => storedRules()).toEqual([denyRule(), allowRule()]);
  });

  test("the default action select writes through", async () => {
    await optionsPage.locator("#default-action").selectOption("deny");
    await expect.poll(() => storedPolicy().then((p) => p.defaultAction)).toBe("deny");

    await optionsPage.locator("#default-action").selectOption("allow");
    await expect.poll(() => storedPolicy().then((p) => p.defaultAction)).toBe("allow");
  });

  test("deleting every rule hands the page back to the keybindings", async () => {
    await optionsPage.getByRole("button", { name: "delete rule 2" }).click();
    await expect.poll(() => storedRules()).toEqual([denyRule()]);

    await optionsPage.getByRole("button", { name: "delete rule 1" }).click();
    await expect.poll(() => storedRules()).toEqual([]);

    await page.waitForTimeout(500);
    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await fieldState(page.locator('input[type="text"]').first())).toEqual({
      value: "hello world",
      start: 0,
      end: 0,
    });
    expect(await badgeText()).toBe("");
  });
});

/**
 * A binding must run exactly once per keypress.
 *
 * Every other block asserts with idempotent chords — Ctrl+a lands on 0 and
 * Ctrl+k deletes to the end whether the handler ran once or twice — so a
 * duplicated keydown listener, which is the regression these tests exist to
 * catch, would pass the whole suite. Alt+f is the discriminator: it advances
 * one word per run, so a doubled handler overshoots by exactly one word.
 *
 * The landing positions are measured, not chosen: from caret 0 in "hello
 * world", one Alt+f lands on 5 and two land on 11 (verified against real
 * Chromium with the built extension).
 *
 * The block inherits `{defaultAction:'allow', rules:[]}`, no overrides,
 * language `auto` and `enableContentEditable` false from the describes above,
 * and restores exactly that, so what follows is unaffected.
 */
test.describe("a binding runs once @C1.13", () => {
  /**
   * Every settings path a user can reach, driven through the surface a user
   * would drive it through: the GUI for the rebind, the reset and the language,
   * storage for what has no control of its own here. Each of these re-runs the
   * content script's subscribers, and any of them re-registering the document
   * listener instead of replacing it would double the binding.
   */
  async function churnTheSettings(): Promise<void> {
    await optionsPage.locator('[data-testid="rebind-move_cursor_to_the_beginning"]').click();
    await optionsPage.keyboard.press("Control+m");
    await expect
      .poll(() => storedOverrides())
      .toHaveProperty("move_cursor_to_the_beginning");

    await optionsPage.locator('[data-testid="keymap-reset-all"]').click();
    await expect.poll(() => storedOverrides()).toEqual({});

    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: `${origin}/**`, matchType: "glob", action: "deny" }],
    });
    await setPolicy({ defaultAction: "allow", rules: [] });

    await optionsPage.evaluate(() => chrome.storage.sync.set({ enableContentEditable: true }));
    await page.waitForTimeout(400);
    await optionsPage.evaluate(() => chrome.storage.sync.set({ enableContentEditable: false }));
    await page.waitForTimeout(400);

    await optionsPage.locator('[data-testid="language-select"]').selectOption("ja");
    await optionsPage.waitForTimeout(700);
    await optionsPage.locator('[data-testid="language-select"]').selectOption("auto");
    await optionsPage.waitForTimeout(700);
  }

  test.afterAll(async () => {
    await optionsPage.evaluate(() =>
      chrome.storage.sync.set({ keymapOverrides: {}, enableContentEditable: false, language: "auto" }),
    );
    await setPolicy({ defaultAction: "allow", rules: [] });
    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);
  });

  test("a binding runs once after settings churn @C1.13", async () => {
    await churnTheSettings();

    expect(await pressAltFOnceOnContentPage()).toEqual({
      start: oneWordForward,
      end: oneWordForward,
    });

    expect(await pressAltFOnceOnOptionsInput()).toEqual({
      start: oneWordForward,
      end: oneWordForward,
    });
  });

  /**
   * `reapplyUrlPolicy` runs on every same-document navigation. It re-decides
   * `enabled` against the policy already held, and must not be a second place
   * the keydown listener gets attached from.
   */
  test("a binding runs once after same-document navigations @C1.13", async () => {
    for (const route of ["/spa-one", "/spa-two", "/spa-three"]) {
      await page.evaluate((path) => history.pushState({}, "", path), route);
      await page.waitForTimeout(300);
      await page.evaluate(() => history.back());
      await page.waitForTimeout(300);
    }

    expect(await pressAltFOnceOnContentPage()).toEqual({
      start: oneWordForward,
      end: oneWordForward,
    });
  });
});

/**
 * The policy is decided per document, and the badge is set per tab. With one
 * tab open the two are indistinguishable from a single global switch — this
 * block opens a second tab that the same policy denies while the first is
 * allowed, so a global decision or a global badge would show up as both tabs
 * agreeing.
 */
test.describe("the badge and policy are decided per tab @C1.3", () => {
  let deniedPage: Page;
  let allowedTabId: number;
  let deniedTabId: number;

  test.beforeAll(async () => {
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: `${origin}/denied`, matchType: "exact", action: "deny" }],
    });

    deniedPage = await context.newPage();
    await deniedPage.goto(`${origin}/denied`);
    await deniedPage.waitForTimeout(1200);

    allowedTabId = await tabIdForUrl(`${origin}/`);
    deniedTabId = await tabIdForUrl(`${origin}/denied`);
  });

  test.afterAll(async () => {
    await deniedPage.close();
    await setPolicy({ defaultAction: "allow", rules: [] });
  });

  test("the badge names the denied tab only", async () => {
    await expect.poll(() => badgeTextOfTab(deniedTabId)).toBe("✕");
    expect(await badgeTextOfTab(allowedTabId)).toBe("");
  });

  test("the same chord is disabled in one tab and live in the other", async () => {
    await deniedPage.locator('input[type="text"]').first().evaluate((el: HTMLInputElement) => {
      el.value = "hello world";
      el.focus();
      el.setSelectionRange(11, 11);
    });
    await deniedPage.keyboard.press("Control+a");
    expect(await caretState(deniedPage.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 11,
    });

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });
  });

  test("lifting the rule re-enables both tabs without a reload", async () => {
    await setPolicy({ defaultAction: "allow", rules: [] });

    await deniedPage.locator('input[type="text"]').first().evaluate((el: HTMLInputElement) => {
      el.value = "hello world";
      el.focus();
      el.setSelectionRange(11, 11);
    });
    await deniedPage.keyboard.press("Control+a");
    expect(await caretState(deniedPage.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });

    await expect.poll(() => badgeTextOfTab(deniedTabId)).toBe("");
    expect(await badgeTextOfTab(allowedTabId)).toBe("");
  });
});

test.describe("event trust and the inspector", () => {
  test("synthetic key events are ignored @C1.2", async () => {
    await addPageKeydownListener("cancelCtrlK");
    await seedTextInput("hello", 5);
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>('input[type="text"]')!;
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "a",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 5,
      end: 5,
    });
  });

  test("the inspector reports conflicts on the clicked field", async () => {
    await addPageKeydownListener("dispatchAltB");
    await page.locator('input[type="text"]').first().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(3, 3);
    });
    await page.keyboard.press("Alt+b");

    await startInspecting();
    await page.locator('input[type="text"]').first().click();
    await page.waitForTimeout(500);

    const toast = await toastText();
    expect(toast).toContain("Ctrl+k");
    expect(toast).toContain("Alt+b");
    expect(toast).toContain("could not be analyzed");

    await page.keyboard.press("Control+a");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });

    await removePageKeydownListener("cancelCtrlK");
    await removePageKeydownListener("dispatchAltB");
  });

  test("Escape leaves inspect mode and hands the chord back to the keybindings", async () => {
    await startInspecting();
    expect(await page.evaluate(() => document.documentElement.style.cursor)).toBe("crosshair");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.style.cursor)).toBe("");

    await seedTextInput("hello world", 11);
    await page.keyboard.press("Control+a");
    expect(await caretState(page.locator('input[type="text"]').first())).toEqual({
      start: 0,
      end: 0,
    });
  });

  /**
   * The page keeps one document-level keydown listener of its own for the
   * `#keyinfo` readout, and the inspector counts every listener reaching the
   * clicked field. That listener names no chord, so it lands in the
   * "could not be analyzed" tally on any field of this page and the
   * no-conflicts wording is out of reach here.
   *
   * Observed preventDefault chords accumulate in the page hook for the
   * lifetime of the document and are reported for every field, so the chords
   * the earlier tests pressed for real would still be named here. A reload
   * starts a fresh document where nothing has been observed yet.
   */
  test("a field with no chord-bearing listener reports no named conflict", async () => {
    await page.reload();
    await page.waitForTimeout(800);

    await startInspecting();
    await page.locator('input[type="password"]').click();
    await page.waitForTimeout(700);

    const toast = await toastText();
    expect(toast).not.toContain("Ctrl+k");
    expect(toast).not.toContain("Alt+b");
    expect(toast).toContain("could not be analyzed");
  });

  /**
   * `showToast` is documented as replacing the toast already shown, and it is
   * addressed by a fixed id — two elements carrying it would make
   * `getElementById` a coin toss, so every assertion above that reads the toast
   * would be reading whichever one the DOM happened to return first.
   *
   * Each inspect click draws two toasts in sequence — the arming hint, then the
   * report — so three armed clicks pass through the replacement path six times.
   * The wait between them stays well inside the eight-second dismissal, so a
   * count of one is replacement rather than expiry.
   */
  test("repeated inspect clicks keep a single toast", async () => {
    const toastCount = () =>
      page.evaluate(
        () => document.querySelectorAll('[id="razorshell-inspect-toast"]').length,
      );

    for (let attempt = 0; attempt < 3; attempt++) {
      await startInspecting();
      await page.locator('input[type="password"]').click();
      await page.waitForTimeout(700);
      expect(await toastCount(), `after inspect click ${attempt + 1}`).toBe(1);
    }
  });
});

test.describe("rich text editors @C1.1", () => {
  const setCaret = (offset: number) =>
    page.evaluate((o) => {
      const div = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
      div.focus();
      const range = document.createRange();
      range.setStart(div.firstChild!, o);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }, offset);

  const selectionState = () =>
    page.evaluate(() => {
      const sel = window.getSelection()!;
      return { offset: sel.focusOffset, collapsed: sel.isCollapsed };
    });

  /**
   * The tests below seed `enableContentEditable` straight into storage, which
   * leaves the checkbox itself unproven. Clicking it is the only way to show
   * that the rendered control reaches storage and that the content script acts
   * on what the click wrote.
   *
   * It ends with the toggle off, which is the state the next test expects.
   */
  test("the toggle click reaches storage and the content script", async () => {
    const stored = () =>
      optionsPage.evaluate(async () => {
        const data = (await chrome.storage.sync.get("enableContentEditable")) as {
          enableContentEditable?: boolean;
        };
        return data.enableContentEditable;
      });

    await optionsPage.locator('[data-testid="richtext-toggle"]').click();
    await expect.poll(stored).toBe(true);
    await expect(optionsPage.locator('[data-testid="richtext-toggle"]')).toBeChecked();

    await page.waitForTimeout(500);
    await expect(page.locator("#ce-status")).toContainText("enabled in options");
    await page.locator('[contenteditable="true"]').click();
    await setCaret(3);
    await page.keyboard.press("Control+a");
    expect(await selectionState()).toEqual({ offset: 0, collapsed: true });

    await optionsPage.locator('[data-testid="richtext-toggle"]').click();
    await expect.poll(stored).toBe(false);
    await expect(optionsPage.locator('[data-testid="richtext-toggle"]')).not.toBeChecked();
    await page.waitForTimeout(500);
  });

  test("the editor stays native while the setting is off", async () => {
    expect(await optionsPage.locator('[data-testid="richtext-toggle"]').count()).toBe(1);

    await page.locator('[contenteditable="true"]').click();
    await setCaret(3);
    await page.keyboard.press("Alt+f");
    expect((await selectionState()).offset).toBe(3);

    await expect(page.locator("#ce-status")).toContainText("disabled in options");
  });

  test("the editor takes the keybindings once enabled", async () => {
    await optionsPage.evaluate(() => chrome.storage.sync.set({ enableContentEditable: true }));
    await page.waitForTimeout(500);
    await expect(page.locator("#ce-status")).toContainText("enabled in options");

    await setCaret(3);
    await page.keyboard.press("Control+e");
    expect(await selectionState()).toEqual({ offset: 10, collapsed: true });

    await page.keyboard.press("Control+a");
    expect(await selectionState()).toEqual({ offset: 0, collapsed: true });

    await setCaret(3);
    await page.keyboard.press("Control+k");
    const truncated = await page.evaluate(() =>
      document
        .querySelector('[contenteditable="true"]')!
        .textContent!.startsWith("fir\nsecond line"),
    );
    expect(truncated).toBe(true);
  });

  test("turning the setting off restores the native behaviour", async () => {
    await optionsPage.evaluate(() => chrome.storage.sync.set({ enableContentEditable: false }));
    await page.waitForTimeout(500);

    await setCaret(1);
    await page.keyboard.press("Control+a");
    expect((await selectionState()).collapsed).toBe(false);
  });
});

test.describe("settings import and export", () => {
  test("the sample config downloads and the importer accepts it @C1.8", async () => {
    const downloadPromise = optionsPage.waitForEvent("download");
    await optionsPage.locator('[data-testid="config-sample"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("config.sample.json");

    const text = fs.readFileSync((await download.path())!, "utf8");
    const parsed = parseSettings(text);
    expect(parsed.ok).toBe(true);
  });

  test("export carries the full current state @C1.8", async () => {
    await optionsPage.evaluate(() =>
      chrome.storage.sync.set({
        keymapOverrides: { move_cursor_to_the_beginning: { key: "m", ctrl: true } },
        urlPolicy: {
          defaultAction: "allow",
          rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
        },
        language: "ja",
        theme: "dark",
        enableContentEditable: true,
      }),
    );
    await optionsPage.reload();
    await optionsPage.waitForTimeout(800);

    const downloadPromise = optionsPage.waitForEvent("download");
    await optionsPage.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const exportedText = fs.readFileSync((await download.path())!, "utf8");
    const exported = JSON.parse(exportedText);

    // What was written must be importable again: the export is only a backup
    // if the parser the import path uses accepts it verbatim.
    expect(parseSettings(exportedText).ok).toBe(true);

    expect({
      version: exported.version,
      language: exported.language,
      theme: exported.theme,
      ce: exported.enableContentEditable,
      overrideKey: exported.keymapOverrides?.move_cursor_to_the_beginning?.key,
      pattern: exported.urlPolicy?.rules?.[0]?.pattern,
    }).toEqual({
      version: 1,
      language: "ja",
      theme: "dark",
      ce: true,
      overrideKey: "m",
      pattern: "https://example.com/**",
    });
  });

  test("a partial import applies only its keys", async () => {
    await optionsPage
      .locator('[data-testid="config-text"]')
      .fill('{"version":1,"language":"fr"}');
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(700);
    await expect(optionsPage.locator('[data-testid="effective-language"]')).toContainText("fr");
  });

  test("an unsupported version is rejected with the reason @C1.7", async () => {
    await optionsPage.locator('[data-testid="config-text"]').fill('{"version":2}');
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(300);
    await expect(optionsPage.locator('[data-testid="config-result"]')).toContainText("version");

    await optionsPage.evaluate(() => chrome.storage.sync.set({ language: "ja" }));
    await optionsPage.waitForTimeout(500);
  });

  /**
   * A parse failure must leave storage untouched and must not wedge the form:
   * the next well-formed document has to apply normally.
   *
   * The recovery payload is constrained to be a no-op, because this test sits
   * between blocks that assert exact settings. `enableContentEditable` is
   * already `true` here (the export test seeded it and nothing since has
   * written it), so re-applying `true` changes nothing while still exercising
   * the whole parse-and-store path. Any value differing from current state
   * would drift into the restart assertions below.
   */
  test("malformed json is rejected and the page recovers @C1.7", async () => {
    const before = await optionsPage.evaluate(() => chrome.storage.sync.get(null));

    await optionsPage.locator('[data-testid="config-text"]').fill("{nope");
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(300);
    await expect(optionsPage.locator('[data-testid="config-result"]')).toContainText("JSON");

    expect(await optionsPage.evaluate(() => chrome.storage.sync.get(null))).toEqual(before);

    await optionsPage
      .locator('[data-testid="config-text"]')
      .fill('{"version":1,"enableContentEditable":true}');
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(500);
    await expect(optionsPage.locator('[data-testid="config-result"]')).toContainText("applied");

    expect(await optionsPage.evaluate(() => chrome.storage.sync.get(null))).toEqual(before);
  });

  test("a policy past the sync quota reports the failure and is not stored @C1.7", async () => {
    const oversized = await optionsPage.evaluate(() =>
      JSON.stringify({
        version: 1,
        urlPolicy: {
          defaultAction: "allow",
          rules: Array.from({ length: 400 }, (_, i) => ({
            pattern: `https://example.com/rule-${i}/**`,
            matchType: "glob",
            action: "deny",
          })),
        },
      }),
    );
    await optionsPage.locator('[data-testid="config-text"]').fill(oversized);
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(700);

    const reported = await optionsPage.locator('[data-testid="config-result"]').innerText();
    expect(reported.toLowerCase()).toContain("quota");

    const stored = await optionsPage.evaluate(async () => {
      const data = (await chrome.storage.sync.get("urlPolicy")) as {
        urlPolicy?: { rules?: unknown[] };
      };
      return data.urlPolicy?.rules?.length ?? 0;
    });
    expect(stored).not.toBe(400);

    await optionsPage.evaluate(() =>
      chrome.storage.sync.set({
        urlPolicy: {
          defaultAction: "allow",
          rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
        },
      }),
    );
    await optionsPage.waitForTimeout(500);
  });

  /**
   * An import is one `chrome.storage.sync.set`, so a document whose policy
   * exceeds the quota must not leave its other keys behind. The language is the
   * witness: `fr` travels in the same document as the oversized policy, and the
   * stored language must still be the `ja` this block seeded.
   *
   * The state left behind is the one the restart describe asserts — language
   * `ja` and the single example.com rule — so the policy is re-seeded after the
   * refusal exactly as the quota test does.
   */
  test("a failing import applies none of its keys @C1.6", async () => {
    expect(await optionsPage.evaluate(() => chrome.storage.sync.get("language"))).toEqual({
      language: "ja",
    });
    const policyBefore = await storedPolicy();

    const oversized = await optionsPage.evaluate(() =>
      JSON.stringify({
        version: 1,
        language: "fr",
        urlPolicy: {
          defaultAction: "allow",
          rules: Array.from({ length: 400 }, (_, i) => ({
            pattern: `https://example.com/rule-${i}/**`,
            matchType: "glob",
            action: "deny",
          })),
        },
      }),
    );
    await optionsPage.locator('[data-testid="config-text"]').fill(oversized);
    await optionsPage.locator('[data-testid="config-apply"]').click();
    await optionsPage.waitForTimeout(700);

    const reported = await optionsPage.locator('[data-testid="config-result"]').innerText();
    expect(reported.toLowerCase()).toContain("quota");

    expect(await optionsPage.evaluate(() => chrome.storage.sync.get("language"))).toEqual({
      language: "ja",
    });
    expect(await storedPolicy()).toEqual(policyBefore);

    await optionsPage.evaluate(() =>
      chrome.storage.sync.set({
        urlPolicy: {
          defaultAction: "allow",
          rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
        },
        language: "ja",
      }),
    );
    await optionsPage.waitForTimeout(500);
  });
});

/**
 * What a kill does to the field beyond the text it removes.
 *
 * Removing the right characters was never the hard part; the 2026-08-17 record
 * measured the cost of doing it by assigning `.value` — the undo stack goes,
 * and the page's own `input` listeners never learn anything changed, so a
 * framework-backed editor keeps rendering the text the user just killed. These
 * tests are about that half of the contract, which only a real engine can show:
 * jsdom implements no `execCommand`, so the unit suite exercises the fallback
 * and can assert nothing about undo.
 *
 * Each test types its own text and restores what it touched, so the describe is
 * self-contained and the serial scenario's later boundary assertions still see
 * the state seeded earlier in the file.
 */
test.describe("a kill behaves like a native deletion @C1.14", () => {
  const input = () => page.locator('input[type="text"]').first();

  /**
   * Puts the caret where a kill should start, without pressing a chord.
   *
   * The motion bindings cannot be used to set up these tests: by this point in
   * the serial scenario the rebinding describe has moved Ctrl+A off
   * move-to-line-start, so pressing it reaches Chrome's native select-all and
   * leaves a selection instead of a caret — which is a different kill entirely.
   * Setting the selection directly keeps the setup independent of whatever the
   * keymap currently holds, and only Ctrl+K, the binding under test, is pressed.
   */
  async function caretTo(position: number): Promise<void> {
    await input().evaluate((el: HTMLInputElement, at: number) => {
      el.focus();
      el.setSelectionRange(at, at);
    }, position);
  }

  /**
   * Types into the field the way a user does, so a native undo stack exists.
   *
   * Clearing has to be native too: assigning `value` would wipe the very undo
   * stack these tests are about, so the selection is made through the DOM and
   * removed with a real Delete keypress.
   */
  async function typeFresh(text: string): Promise<void> {
    await input().click();
    await input().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await page.keyboard.press("Delete");
    expect((await fieldState(input())).value).toBe("");
    await page.keyboard.type(text);
    expect((await fieldState(input())).value).toBe(text);
  }

  /**
   * The import describe above ends with a deny rule in storage, which switches
   * the bindings off on every page. These tests are about what a binding does
   * when it runs, so the block seeds its own allowing policy and puts the
   * denying one back afterwards for the describes that assert on it.
   */
  test.beforeAll(async () => {
    await setPolicy({ defaultAction: "allow", rules: [] });
  });

  test.afterAll(async () => {
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
    });
    await seedTextInput("hello world new order", 0);
  });

  test("a kill can be undone", async () => {
    await typeFresh("undo me please");

    // The fixture guard: if native undo does not work in this harness at all,
    // the Ctrl+K assertion below would pass vacuously for the wrong reason.
    await page.keyboard.press("Shift+Home");
    await page.keyboard.press("Delete");
    expect((await fieldState(input())).value).toBe("");
    await page.keyboard.press("Control+z");
    expect((await fieldState(input())).value).toBe("undo me please");

    // The undo restored the selection along with the text, and a kill measured
    // from a non-collapsed selection starts at its far edge — an empty region
    // at the end of the line. Collapse to the start so Ctrl+K has a line to
    // take; Ctrl+A is move-to-line-start here, not select-all.
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await page.keyboard.press("Control+z");
    expect((await fieldState(input())).value).toBe("undo me please");
  });

  test("a kill is visible to the page", async () => {
    await typeFresh("visible kill");
    await caretTo(0);

    await input().evaluate((el: HTMLInputElement) => {
      const seen: string[] = [];
      (el as unknown as { __killLog: string[] }).__killLog = seen;
      const listener = (event: Event) => seen.push((event as InputEvent).inputType ?? "");
      (el as unknown as { __killListener: EventListener }).__killListener = listener;
      el.addEventListener("input", listener);
    });

    await page.keyboard.press("Control+k");

    const types = await input().evaluate((el: HTMLInputElement) => {
      const holder = el as unknown as { __killLog: string[]; __killListener: EventListener };
      el.removeEventListener("input", holder.__killListener);
      const seen = holder.__killLog;
      delete (el as unknown as Record<string, unknown>).__killLog;
      delete (el as unknown as Record<string, unknown>).__killListener;
      return seen;
    });

    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(types.length).toBe(1);
    expect(types[0]).toBe("deleteContentBackward");
    expect((await fieldState(input())).value).toBe("");
  });

  test("an empty kill region does nothing", async () => {
    await typeFresh("nothing to kill");
    await caretTo("nothing to kill".length);

    await input().evaluate((el: HTMLInputElement) => {
      let count = 0;
      const listener = () => (count += 1);
      (el as unknown as { __emptyCount: () => number }).__emptyCount = () => count;
      (el as unknown as { __emptyListener: EventListener }).__emptyListener = listener;
      el.addEventListener("input", listener);
    });

    await page.keyboard.press("Control+k");

    const fired = await input().evaluate((el: HTMLInputElement) => {
      const holder = el as unknown as {
        __emptyCount: () => number;
        __emptyListener: EventListener;
      };
      el.removeEventListener("input", holder.__emptyListener);
      const count = holder.__emptyCount();
      delete (el as unknown as Record<string, unknown>).__emptyCount;
      delete (el as unknown as Record<string, unknown>).__emptyListener;
      return count;
    });

    expect(fired).toBe(0);

    // The measured Backspace hazard: `execCommand("delete")` on an empty
    // selection eats the character behind the caret. Nothing may have been
    // removed, and the caret must still be where it was put.
    expect(await fieldState(input())).toEqual({
      value: "nothing to kill",
      start: "nothing to kill".length,
      end: "nothing to kill".length,
    });

    // A Backspace would also have pushed an entry onto the undo stack, so the
    // check that separates "did nothing" from "deleted a character" is whether
    // an undo has a kill to reverse. Typing is undone one character at a time
    // here, so the value alone cannot tell the two apart — the redo is what
    // does: after undo-then-redo the field must be exactly as it was left. Had
    // Ctrl+K eaten a character, the redo would replay that deletion instead.
    //
    // The redo is spelled Ctrl+Shift+Z, not Ctrl+Y: since the kill ring landed
    // (C1.15) Ctrl+Y is the yank, and pressing it here would insert ring text
    // instead of redoing. Chromium accepts both chords for redo, and this one
    // no binding claims.
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");
    expect((await fieldState(input())).value).toBe("nothing to kill");
  });

  test("a readonly field is left alone", async () => {
    await typeFresh("read only text");
    await caretTo(0);
    await input().evaluate((el: HTMLInputElement) => {
      el.readOnly = true;
    });

    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("read only text");

    await input().evaluate((el: HTMLInputElement) => {
      el.readOnly = false;
    });
  });
});

/**
 * The kill ring: what a kill leaves behind and what a yank brings back.
 *
 * The ring lives in the content script's frame and is never persisted, so every
 * test here seeds the state it needs through real keypresses rather than reading
 * it out — there is nothing to read. What can be observed is the field, and that
 * is what each assertion is written against.
 *
 * The block seeds its own allowing policy and restores the denying one the
 * surrounding scenario expects, in the manner of the C1.14 block above.
 */
test.describe("killed text can be yanked back @C1.15", () => {
  const input = () => page.locator('input[type="text"]').first();
  const password = () => page.locator('input[type="password"]');

  /** The caret, set directly — see the note in the C1.14 block on why not a chord. */
  async function caretTo(position: number): Promise<void> {
    await input().evaluate((el: HTMLInputElement, at: number) => {
      el.focus();
      el.setSelectionRange(at, at);
    }, position);
  }

  /** Types into the field natively, so the field owns a real undo stack. */
  async function typeFresh(text: string): Promise<void> {
    await input().click();
    await input().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await page.keyboard.press("Delete");
    await page.keyboard.type(text);
    expect((await fieldState(input())).value).toBe(text);
  }

  /**
   * Empties the ring the only way a page can: by reloading the frame, which
   * takes the content script's module state with it.
   */
  async function freshFrame(): Promise<void> {
    await page.goto(`${origin}/`);
    await page.waitForTimeout(1000);
  }

  /**
   * Presses a chord and reports, for each matching keydown the field saw,
   * whether the extension cancelled it.
   *
   * A binding with nothing to do must leave the native key alone, so "did
   * nothing" and "did nothing and also swallowed the key" are different
   * outcomes and only this can tell them apart. The listener is attached and
   * removed around the press so it cannot leak into the inspector's count.
   */
  async function pressAndReadPrevented(
    chord: string,
    matches: (event: KeyboardEvent) => boolean,
  ): Promise<boolean[]> {
    await input().evaluate((el: HTMLInputElement, source: string) => {
      const predicate = new Function(`return (${source})`)() as (e: KeyboardEvent) => boolean;
      const seen: boolean[] = [];
      const listener = (event: Event) => {
        const key = event as KeyboardEvent;
        if (predicate(key)) seen.push(key.defaultPrevented);
      };
      const holder = el as unknown as { __seen: boolean[]; __listener: EventListener };
      holder.__seen = seen;
      holder.__listener = listener;
      el.addEventListener("keydown", listener);
    }, matches.toString());

    // Focus without clicking: a click would move the caret, and in the tests
    // that turn on caret position that would destroy the very state under test.
    await input().evaluate((el: HTMLInputElement) => el.focus());
    await page.keyboard.press(chord);

    return input().evaluate((el: HTMLInputElement) => {
      const holder = el as unknown as { __seen: boolean[]; __listener: EventListener };
      el.removeEventListener("keydown", holder.__listener);
      const seen = holder.__seen;
      delete (el as unknown as Record<string, unknown>).__seen;
      delete (el as unknown as Record<string, unknown>).__listener;
      return seen;
    });
  }

  /**
   * The C1.14 block above kills three times in this same field at caret 0, and
   * those kills are on the ring by the time this block starts — chained into one
   * entry, since nothing there moved the caret between them. Every assertion
   * below is about what this block itself killed, so the frame is reloaded first
   * to start from an empty ring.
   */
  /**
   * The contenteditable test in this block turns the opt-in on, and the restart
   * describe near the end of the file asserts the value the import block left in
   * storage. So the setting is read here and put back as it was found rather
   * than forced to a constant, which would quietly rewrite that later claim.
   */
  let editableWasEnabled = false;

  test.beforeAll(async () => {
    await setPolicy({ defaultAction: "allow", rules: [] });
    editableWasEnabled = await optionsPage.evaluate(async () => {
      const data = (await chrome.storage.sync.get("enableContentEditable")) as {
        enableContentEditable?: boolean;
      };
      return data.enableContentEditable === true;
    });
    await freshFrame();
  });

  test.afterAll(async () => {
    await optionsPage.evaluate(
      (value) => chrome.storage.sync.set({ enableContentEditable: value }),
      editableWasEnabled,
    );
    await page.waitForTimeout(500);
    await freshFrame();
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
    });
    await seedTextInput("hello world new order", 0);
  });

  test("a kill and a yank round trip", async () => {
    await typeFresh("hello world");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await page.keyboard.press("Control+y");
    expect(await fieldState(input())).toEqual({
      value: "hello world",
      start: "hello world".length,
      end: "hello world".length,
    });
  });

  test("a backward kill then a forward kill reconstruct the line", async () => {
    await typeFresh("abcdef");
    await caretTo(3);
    await page.keyboard.press("Control+u");
    expect((await fieldState(input())).value).toBe("def");
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("abcdef");
  });

  test("two entries rotate under yank-pop", async () => {
    await typeFresh("one");
    await caretTo(0);
    await page.keyboard.press("Control+k");

    // The chain has to break between the two kills, or they accumulate into one
    // entry and there is nothing to rotate through. What breaks it is killing
    // from a caret the previous kill did not leave behind — the first kill left
    // the caret at 0, so this one runs at 1 and starts a fresh entry. Retyping
    // alone does not break it (same element, caret back at 0), and neither does
    // an arrow key that happens to land on 0 again: both were measured merging
    // into "onetwo". The caret value is the whole check.
    await typeFresh("xtwo");
    await caretTo(1);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("x");

    await caretTo(1);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("xtwo");

    await page.keyboard.press("Alt+y");
    expect((await fieldState(input())).value).toBe("xone");
  });

  test("a caret move between kills keeps them as two entries", async () => {
    await typeFresh("alpha");
    await caretTo(0);
    await page.keyboard.press("Control+k");

    await typeFresh("beta");
    await caretTo(0);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("b");

    await typeFresh("");
    await caretTo(0);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("eta");

    // Two distinct entries exist only if the arrow key broke the chain; had it
    // not, "eta" and "alpha" would be one entry and this rotation would return
    // the same text it just inserted.
    await page.keyboard.press("Alt+y");
    expect((await fieldState(input())).value).toBe("alpha");
  });

  test("a password kill is never stored", async () => {
    await freshFrame();

    await password().evaluate((el: HTMLInputElement) => {
      el.value = "hunter2 secret phrase";
      el.focus();
      el.setSelectionRange(0, 0);
    });
    await page.keyboard.press("Control+k");
    expect((await fieldState(password())).value).toBe("");

    await typeFresh("carrier");
    await caretTo("carrier".length);
    await page.keyboard.press("Control+y");

    // The ring was empty, so the yank must have inserted nothing at all, and
    // the secret must not have reached the field by any route.
    const after = (await fieldState(input())).value;
    expect(after).toBe("carrier");
    expect(after).not.toContain("hunter2");
    expect(after).not.toContain("secret");

    await password().evaluate((el: HTMLInputElement) => {
      el.value = "hunter2 secret phrase";
    });
  });

  test("an empty ring leaves Ctrl+Y to the browser", async () => {
    await freshFrame();

    await input().click();
    await caretTo(0);
    const before = (await fieldState(input())).value;
    const prevented = await pressAndReadPrevented(
      "Control+y",
      (key) => key.ctrlKey && key.key === "y",
    );

    expect(prevented).toEqual([false]);
    expect((await fieldState(input())).value).toBe(before);
  });

  test("denying the page clears the ring", async () => {
    await freshFrame();
    await typeFresh("disposable");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    // A real yank before the deny, so there is a record to leave behind. Without
    // one the assertion below would pass on any build, having nothing to catch.
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("disposable");

    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: `${origin}/**`, matchType: "glob", action: "deny" }],
    });
    await setPolicy({ defaultAction: "allow", rules: [] });

    // The ring is empty again, so Ctrl+Y has nothing to insert and the field is
    // left holding exactly what the earlier yank put there — which is the point:
    // the text half of the pop's check still verifies, so only the record's own
    // lifetime decides the outcome.
    await caretTo("disposable".length);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("disposable");

    // E-4: the yank record has to go with the ring, not just the entries. The
    // deny cleared the entries, so a pop has nothing to rotate to; if the record
    // outlived them the binding still claims Alt+Y and swallows the key while
    // doing nothing. Leaving the key alone is the same contract the empty-ring
    // Ctrl+Y test above asserts.
    const beforePop = (await fieldState(input())).value;
    const popPrevented = await pressAndReadPrevented("Alt+y", (key) => key.altKey && key.key === "y");
    expect(popPrevented).toEqual([false]);
    expect((await fieldState(input())).value).toBe(beforePop);
  });

  test("a bound motion between kills splits the chain even at the same caret", async () => {
    // E-1: the options page drives the same dispatch path as a content script,
    // through React's onKeyDown rather than the document listener. A motion
    // binding between two kills must break the chain there too, and the caret
    // returning to where the first kill left it is the case that can only pass
    // if the motion itself was reported — position alone cannot distinguish it.
    const testInput = optionsPage.locator('[data-testid="test-input"]');
    const testState = () => fieldState(testInput);
    const original = (await testState()).value;

    await testInput.click();
    await testInput.evaluate((el: HTMLInputElement) => {
      el.value = "alpha";
      el.focus();
      el.setSelectionRange(0, 0);
    });
    await optionsPage.keyboard.press("Control+k");
    expect((await testState()).value).toBe("");

    await testInput.evaluate((el: HTMLInputElement) => {
      el.value = "beta";
      el.focus();
      el.setSelectionRange(0, 0);
    });
    // Out and back: the caret ends where the first kill left it, so only the
    // bindings having been seen can keep these two kills apart.
    await optionsPage.keyboard.press("Control+f");
    await optionsPage.keyboard.press("Control+b");
    expect(await caretState(testInput)).toEqual({ start: 0, end: 0 });
    await optionsPage.keyboard.press("Control+k");
    expect((await testState()).value).toBe("");

    await optionsPage.keyboard.press("Control+y");
    expect((await testState()).value).toBe("beta");
    await optionsPage.keyboard.press("Alt+y");
    expect((await testState()).value).toBe("alpha");

    await testInput.evaluate((el: HTMLInputElement, value: string) => {
      el.value = value;
      el.blur();
    }, original);
  });

  test("typing after a yank makes yank-pop illegal", async () => {
    // E-2: yank-pop is a replacement aimed at a recorded range. Once the user
    // types, the caret no longer sits at the end of that range and the record
    // no longer describes what is on screen, so the pop must refuse and leave
    // the key to the page rather than overwrite text the user just wrote.
    await freshFrame();
    await typeFresh("abc");
    await caretTo(0);
    await page.keyboard.press("Control+k");

    await typeFresh("");
    await caretTo(0);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("abc");

    await page.keyboard.type("z");
    const seeded = await fieldState(input());
    expect(seeded.value).toBe("abcz");
    // Without this the test could pass on a build that never checks the caret:
    // the text condition alone still holds over the recorded region.
    expect(seeded.start).not.toBe("abc".length);

    const prevented = await pressAndReadPrevented("Alt+y", (key) => key.altKey && key.key === "y");
    expect(prevented).toEqual([false]);
    expect((await fieldState(input())).value).toBe("abcz");
  });

  test("a page rewrite under the record makes yank-pop illegal", async () => {
    // E-3: the caret can be exactly where the yank left it while the text under
    // it has changed — a page script rewriting the field is the realistic
    // version. Only the text half of the check can catch that, so the caret is
    // restored to the recorded end to isolate it.
    await freshFrame();
    await typeFresh("abc");
    await caretTo(0);
    await page.keyboard.press("Control+k");

    await typeFresh("");
    await caretTo(0);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("abc");

    const rewritten = await input().evaluate((el: HTMLInputElement) => {
      el.value = `X${el.value.slice(1)}`;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      return el.value;
    });
    // The guard: if the mutation did not land, the pop would refuse for the
    // wrong reason and this test would prove nothing.
    expect(rewritten).toBe("Xbc");

    const prevented = await pressAndReadPrevented("Alt+y", (key) => key.altKey && key.key === "y");
    expect(prevented).toEqual([false]);
    expect((await fieldState(input())).value).toBe("Xbc");
  });

  test("a contenteditable kill yanks back, and into a plain field as text", async () => {
    await freshFrame();
    await optionsPage.evaluate(() => chrome.storage.sync.set({ enableContentEditable: true }));
    await page.waitForTimeout(500);
    await expect(page.locator("#ce-status")).toContainText("enabled in options");

    const editorText = () =>
      page.evaluate(() => document.querySelector('[contenteditable="true"]')!.textContent ?? "");
    const setCaret = (offset: number) =>
      page.evaluate((o) => {
        const div = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
        div.focus();
        const range = document.createRange();
        range.setStart(div.firstChild!, o);
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      }, offset);

    await page.locator('[contenteditable="true"]').click();
    await setCaret(0);
    await page.keyboard.press("Control+k");
    expect(await editorText()).not.toContain("first line");

    await page.keyboard.press("Control+y");
    expect(await editorText()).toContain("first line");

    // The ring carries plain text only, so the same entry lands in an input
    // unchanged rather than as markup.
    await typeFresh("");
    await caretTo(0);
    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("first line");

    // The block's afterAll restores the setting to whatever storage held before
    // this describe ran, so nothing is forced here.
  });
});

/**
 * The word kills, the character deletes and the two undo chords.
 *
 * Three different contracts meet here and only a real engine can separate them.
 * A word kill must reach the ring, so a yank brings it back. A character delete
 * must NOT reach it, and must remove a whole grapheme — jsdom can show the
 * region arithmetic but not what an engine actually does to a field holding an
 * emoji. And undo is `execCommand` alone: there is no fallback to assert
 * against, so a suite without a real undo stack could not tell the binding
 * working from the binding doing nothing.
 *
 * Key names here are measured, not assumed (2026-09-05, see the record in
 * docs/assurance.md). The one that bites: Playwright's `press("Control+_")`
 * shorthand fabricates `_` with `shiftKey` FALSE, which no physical keyboard
 * produces — a US layout makes that character with Shift+Minus and reports
 * `shiftKey` true. The binding is written for the keyboard, so the chord is
 * pressed here in its down/up form.
 *
 * The block seeds its own allowing policy and restores the denying one the
 * surrounding scenario expects, in the manner of the C1.14 and C1.15 blocks.
 */
test.describe("word kills, character deletes and undo @C1.16", () => {
  const input = () => page.locator('input[type="text"]').first();

  /** The caret, set directly — see the note in the C1.14 block on why not a chord. */
  async function caretTo(position: number): Promise<void> {
    await input().evaluate((el: HTMLInputElement, at: number) => {
      el.focus();
      el.setSelectionRange(at, at);
    }, position);
  }

  /** Types into the field natively, so the field owns a real undo stack. */
  async function typeFresh(text: string): Promise<void> {
    await input().click();
    await input().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await page.keyboard.press("Delete");
    await page.keyboard.type(text);
    expect((await fieldState(input())).value).toBe(text);
  }

  /** Empties the ring by reloading the frame, taking the module state with it. */
  async function freshFrame(): Promise<void> {
    await page.goto(`${origin}/`);
    await page.waitForTimeout(1000);
  }

  /**
   * Ctrl+underscore as a keyboard makes it: Shift held over Minus, inside Ctrl.
   * Playwright's `Control+_` shorthand reports no Shift and would not match the
   * shipped chord — pressing the physical keys is what tests the real binding.
   */
  async function pressCtrlUnderscore(): Promise<void> {
    await input().evaluate((el: HTMLInputElement) => el.focus());
    await page.keyboard.down("Control");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Minus");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Control");
  }

  test.beforeAll(async () => {
    await setPolicy({ defaultAction: "allow", rules: [] });
    await freshFrame();
  });

  test.afterAll(async () => {
    await freshFrame();
    await setPolicy({
      defaultAction: "allow",
      rules: [{ pattern: "https://example.com/**", matchType: "glob", action: "deny" }],
    });
    await seedTextInput("hello world new order", 0);
  });

  test("a word kill and a yank round trip", async () => {
    await freshFrame();
    await typeFresh("hello world");
    await caretTo(6);
    await page.keyboard.press("Alt+d");
    expect((await fieldState(input())).value).toBe("hello ");

    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("hello world");
  });

  /**
   * Two chained word kills, with the expected strings derived from the word
   * boundary this extension already ships rather than from readline's.
   *
   * `cursor.getEndOfWord` — what Alt+f moves over and therefore what Alt+d
   * removes — skips any separator run it starts on and then consumes to the end
   * of the following word. From caret 4 of "one two three" that takes "two",
   * leaving "one  three" with the caret still at 4. The second Alt+d now starts
   * ON a separator, so it takes that separator together with "three": " three".
   * Both kills leave the caret at 4, which is what lets the ring chain them, and
   * a forward kill appends, so the single entry reads "two three". Ctrl+Y puts
   * exactly that back.
   *
   * Characterization for the boundary flavor, specification for the ring order:
   * the concatenation direction is readline's rule and is not negotiable, while
   * which characters each kill takes follows this extension's own motion.
   */
  test("two chained word kills yank back as one entry", async () => {
    await freshFrame();
    await typeFresh("one two three");
    await caretTo(4);

    await page.keyboard.press("Alt+d");
    expect((await fieldState(input())).value).toBe("one  three");

    await page.keyboard.press("Alt+d");
    expect((await fieldState(input())).value).toBe("one ");

    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("one two three");
  });

  /**
   * Two backward word kills are one run, and the ring gives back what they took
   * in the order the line held it.
   *
   * From the end of "one two three" the first Alt+Backspace takes "three" and
   * leaves the caret at 8; the second starts there and takes "two ". A backward
   * kill prepends, so the entry reads "two three" and Ctrl+Y restores exactly
   * that. This is readline's rule for a run of kills at one place, and the
   * caret arithmetic is what decides whether the ring sees a run at all.
   *
   * Red before the fix: this returned "two " — the second kill started its own
   * entry, so the yank brought back only the newer piece.
   */
  test("two backward word kills yank back as one entry", async () => {
    await freshFrame();
    await typeFresh("one two three");
    await caretTo("one two three".length);

    await page.keyboard.press("Alt+Backspace");
    expect((await fieldState(input())).value).toBe("one two ");

    await page.keyboard.press("Alt+Backspace");
    expect((await fieldState(input())).value).toBe("one ");

    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("one two three");
  });

  /**
   * Alt+Backspace kills backward, and Ctrl+Z is the price we did NOT pay.
   *
   * On Windows Alt+Backspace is an undo alias, and binding it costs the user
   * that alias. What must survive is the real undo: if the extension had eaten
   * Ctrl+Z as well, this kill could not be undone. Asserting the undo is what
   * separates "we shadowed one chord" from "we broke undo".
   */
  test("a backward word kill goes on the ring, and Ctrl+Z still undoes", async () => {
    await freshFrame();
    await typeFresh("alpha beta");
    await caretTo("alpha beta".length);

    await page.keyboard.press("Alt+Backspace");
    expect((await fieldState(input())).value).toBe("alpha ");

    await page.keyboard.press("Control+z");
    expect((await fieldState(input())).value).toBe("alpha beta");
  });

  /**
   * A character delete takes the whole emoji or it takes nothing worth having.
   *
   * Half a surrogate pair renders as a replacement glyph and cannot be typed
   * back, so the assertion is value equality against the exact remaining string
   * — a `not.toContain` check would pass on a field holding a lone surrogate.
   */
  test("Ctrl+D removes a whole emoji rather than half of one", async () => {
    await freshFrame();
    await input().click();
    await input().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await page.keyboard.press("Delete");
    // Typed through the keyboard so the field owns the text the way a user's
    // would; the emoji is one grapheme built from a surrogate pair.
    await page.keyboard.type("a\u{1F600}b");
    expect((await fieldState(input())).value).toBe("a\u{1F600}b");

    await caretTo(1);
    await page.keyboard.press("Control+d");

    const after = (await fieldState(input())).value;
    expect(after).toBe("ab");
    expect(after.isWellFormed()).toBe(true);
  });

  test("Ctrl+H removes a whole emoji backward", async () => {
    await freshFrame();
    await input().click();
    await input().evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    });
    await page.keyboard.press("Delete");
    await page.keyboard.type("a\u{1F600}b");

    await caretTo(3);
    await page.keyboard.press("Control+h");

    const after = (await fieldState(input())).value;
    expect(after).toBe("ab");
    expect(after.isWellFormed()).toBe(true);
  });

  /**
   * The chain-breaking property, end to end.
   *
   * `delete_char` carries no `ringRole`, so the dispatcher reports it to the
   * ring as a foreign command. Two kills either side of it must stay two
   * entries: the yank brings back the second, and the rotation reaches the
   * first. Had the delete been transparent to the ring, both kills would have
   * chained into one entry and Alt+Y would return what Ctrl+Y just inserted.
   */
  test("a character delete between two kills keeps them apart", async () => {
    await freshFrame();
    await typeFresh("alpha");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await typeFresh("beta");
    await caretTo(0);
    await page.keyboard.press("Control+d");
    expect((await fieldState(input())).value).toBe("eta");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await page.keyboard.press("Control+y");
    expect((await fieldState(input())).value).toBe("eta");

    await page.keyboard.press("Alt+y");
    expect((await fieldState(input())).value).toBe("alpha");
  });

  test("Ctrl+Shift+underscore undoes a kill", async () => {
    await freshFrame();
    await typeFresh("undo by underscore");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await pressCtrlUnderscore();
    expect((await fieldState(input())).value).toBe("undo by underscore");
  });

  test("Ctrl+slash undoes a kill", async () => {
    await freshFrame();
    await typeFresh("undo by slash");
    await caretTo(0);
    await page.keyboard.press("Control+k");
    expect((await fieldState(input())).value).toBe("");

    await input().evaluate((el: HTMLInputElement) => el.focus());
    await page.keyboard.press("Control+/");
    expect((await fieldState(input())).value).toBe("undo by slash");
  });
});

/**
 * What `chrome.storage.onChanged` does about a write that changes nothing.
 *
 * This is a characterization test, not a specification: the expected value is
 * whatever real Chrome does, measured rather than chosen. Everything downstream
 * that reacts to storage — the content script's policy re-evaluation, the
 * options page re-render, the language dictionary reload in `initI18n` — is
 * driven by this event, so whether a redundant `set` wakes them is a platform
 * fact the code rests on, and the mock has to match it or the unit suite tests
 * a browser that does not exist.
 *
 * Measured on Chromium via `channel: "chromium"`: writing the key once fires
 * once, and writing a deep-equal value again fires NOT AT ALL. Chrome compares
 * the serialized old and new values and suppresses the notification when they
 * are equal, so the count stays at 1 across all three writes. A fresh object
 * that is merely deep-equal is suppressed the same way — identity does not
 * enter into it, only the serialized value.
 *
 * The consequence for the code under test: a write is not a reliable way to
 * provoke a listener. Anything that must re-run on demand needs a real value
 * change or a direct call, never a redundant `set` used as a nudge.
 *
 * Should this ever go red, Chrome's behaviour changed — reopen R1 and update
 * the mock in step rather than adjusting the number to make it pass.
 */
test.describe("storage.onChanged characterization", () => {
  test("a redundant write fires no event", async () => {
    const counts = await optionsPage.evaluate(async () => {
      const probeKey = "__razorshell_probe";
      let fired = 0;
      const listener = (changes: Record<string, unknown>, area: string) => {
        if (area === "sync" && probeKey in changes) fired += 1;
      };
      chrome.storage.onChanged.addListener(listener);
      const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

      await chrome.storage.sync.set({ [probeKey]: { tag: "x" } });
      await settle();
      const afterFirst = fired;

      await chrome.storage.sync.set({ [probeKey]: { tag: "x" } });
      await settle();
      const afterIdentical = fired;

      await chrome.storage.sync.set({ [probeKey]: { tag: "x" } });
      await settle();
      const afterDeepEqual = fired;

      chrome.storage.onChanged.removeListener(listener);
      await chrome.storage.sync.remove(probeKey);
      return { afterFirst, afterIdentical, afterDeepEqual };
    });

    console.log(`R1 storage.onChanged counts: ${JSON.stringify(counts)}`);

    expect(counts).toEqual({ afterFirst: 1, afterIdentical: 1, afterDeepEqual: 1 });
  });
});

test.describe("persistence across a browser restart @C1.5", () => {
  let restartedOptions: Page;
  let restartedPage: Page;

  test("the settings survive a restart", async () => {
    await context.close();
    context = await chromium.launchPersistentContext(userDataDir, launchOptions());

    restartedPage = await context.newPage();
    await restartedPage.goto(`${origin}/`);
    await restartedPage.waitForTimeout(1200);
    restartedOptions = await context.newPage();
    await restartedOptions.goto(optionsUrl());
    await restartedOptions.waitForTimeout(1200);

    // The page reads storage while rendering, so a one-shot read right after
    // the goto races the hydration under load; every check here retries.
    await expect(
      restartedOptions.locator('[data-testid="current-move_cursor_to_the_beginning"]'),
    ).toHaveText(/Ctrl\s*\+\s*m/);

    await expect(restartedOptions.locator("body")).toContainText("https://example.com/**");
    await expect(restartedOptions.locator('[data-testid="effective-language"]')).toContainText(
      "ja",
    );
    await expect
      .poll(() => restartedOptions.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");
    await expect(restartedOptions.locator('[data-testid="richtext-toggle"]')).toBeChecked();
  });

  test("the rebound chord still reaches the content script", async () => {
    const input2 = restartedPage.locator('input[type="text"]').first();
    await input2.evaluate((el: HTMLInputElement) => {
      el.value = "hello world";
      el.focus();
      el.setSelectionRange(11, 11);
    });
    await restartedPage.keyboard.press("Control+m");
    expect(await caretState(input2)).toEqual({ start: 0, end: 0 });
  });
});
