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

  test("an input inside a closed shadow root is out of reach, so Ctrl+a stays the native select-all", async () => {
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

  test("email input keeps native select-all", async () => {
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
