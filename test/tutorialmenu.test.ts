/**
 * The tutorial's way in: an item on the toolbar icon's context menu, created
 * when the extension is installed or updated, that opens the tutorial page in
 * a new tab. Nothing opens by itself (ADR-0018).
 */
import { describe, expect, test, vi } from "vitest";
import { registerTutorialMenu, type TutorialMenuChrome } from "../src/tutorialmenu";

function fakeChrome() {
  let installed = (): void => {};
  let clicked: (info: { menuItemId: string | number }) => void = () => {};
  const api = {
    contextMenus: {
      create: vi.fn(),
      onClicked: { addListener: (listener: typeof clicked) => { clicked = listener; } },
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://razorshell/${path}`,
      onInstalled: { addListener: (listener: typeof installed) => { installed = listener; } },
    },
    tabs: { create: vi.fn(async () => ({})) },
    i18n: { getMessage: (key: string) => (key === "menu_tutorial" ? "Tutorial" : "") },
  } satisfies TutorialMenuChrome;
  return { api, install: () => installed(), click: (menuItemId: string | number) => clicked({ menuItemId }) };
}

describe("the tutorial menu item", () => {
  test("is created on the toolbar icon's menu, with its localized title, as the extension is installed", () => {
    const chrome = fakeChrome();
    registerTutorialMenu(chrome.api);
    expect(chrome.api.contextMenus.create).not.toHaveBeenCalled();

    chrome.install();

    expect(chrome.api.contextMenus.create).toHaveBeenCalledTimes(1);
    expect(chrome.api.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tutorial", contexts: ["action"] }),
    );
  });

  test("opens the tutorial page in a new tab when clicked", () => {
    const chrome = fakeChrome();
    registerTutorialMenu(chrome.api);
    chrome.install();
    const { id } = chrome.api.contextMenus.create.mock.calls[0][0] as { id: string };

    chrome.click(id);

    expect(chrome.api.tabs.create).toHaveBeenCalledWith({ url: "chrome-extension://razorshell/tutorial.html" });
  });

  test("opens nothing for another item, nor by itself on install", () => {
    const chrome = fakeChrome();
    registerTutorialMenu(chrome.api);
    chrome.install();

    chrome.click("some-other-item");

    expect(chrome.api.tabs.create).not.toHaveBeenCalled();
  });
});
