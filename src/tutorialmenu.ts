/**
 * @file tutorialmenu.ts
 * @brief The toolbar icon's "Tutorial" menu item, which opens the tutorial
 *        page in a new tab (ADR-0018).
 *
 * Imported by the service worker alone, for the reason uninstall.ts gives.
 */

const menuItemId = "razorshell-tutorial";
const tutorialPage = "tutorial.html";

/** The parts of `chrome` the menu item needs, so a test can supply its own. */
export interface TutorialMenuChrome {
  contextMenus: {
    create: (properties: { id: string; title: string; contexts: ["action"] }) => unknown;
    onClicked: { addListener: (listener: (info: { menuItemId: string | number }) => void) => void };
  };
  runtime: {
    getURL: (path: string) => string;
    onInstalled: { addListener: (listener: () => void) => void };
  };
  tabs: { create: (properties: { url: string }) => Promise<unknown> };
  i18n: { getMessage: (key: string) => string };
}

/**
 * @fn registerTutorialMenu
 * @brief Create the menu item as the extension is installed or updated, and
 *        open the tutorial page whenever it is clicked.
 * @details Chrome keeps a menu item across worker restarts but drops it on an
 *          update, which `onInstalled` also reports. The click listener has to
 *          be added on every start, so this is called at the worker's top level.
 * @param TutorialMenuChrome api - `chrome`
 */
export function registerTutorialMenu(api: TutorialMenuChrome): void {
  api.runtime.onInstalled.addListener(() => {
    api.contextMenus.create({ id: menuItemId, title: api.i18n.getMessage("menu_tutorial"), contexts: ["action"] });
  });
  api.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== menuItemId) return;
    api.tabs.create({ url: api.runtime.getURL(tutorialPage) }).catch(() => {});
  });
}
