/**
 * @file shortcuts.ts
 * @brief Chrome's shortcuts page and what it holds for the two commands this
 *        extension declares, for the pages that point the user at it.
 */

const shortcutsUrl = "chrome://extensions/shortcuts";

/**
 * @fn openShortcutsPage
 * @brief Open Chrome's shortcuts page in a tab.
 * @details A page cannot navigate to a `chrome://` URL — the anchor does
 *          nothing — but an extension page may open one through
 *          `chrome.tabs.create`, which is why every affordance for these rows is
 *          a button rather than a link.
 * @return void
 */
export function openShortcutsPage(): void {
  void chrome.tabs.create({ url: shortcutsUrl });
}

/**
 * @fn onPageRevisit
 * @brief Call back when the page is looked at again after being away.
 * @details The browser-managed rows read a binding this page cannot change: the
 *          user assigns it on another tab, and comes back. Nothing in this
 *          document changes when they do, so the signal is the page becoming
 *          current again — visibilitychange for the tab switch,
 *          focus for the cases visibility does not cover, such as returning
 *          from another window over the same visible tab.
 *
 *          Both arms are gated on having actually been away. A bare `focus`
 *          listener also fires for same-tab focus churn — an extension page
 *          being scripted, a devtools detach — and each spurious call is a
 *          `chrome.commands.getAll()`, which WAKES THE SERVICE WORKER. That
 *          measurably delayed an unrelated content script's policy report in
 *          the e2e suite, so the read is spent only when the answer could have
 *          moved.
 * @param listener - Receives no arguments
 * @return () => void - Releases both listeners
 */
export function onPageRevisit(listener: () => void): () => void {
  let away = document.visibilityState !== "visible";
  const revisit = () => {
    if (!away) return;
    away = false;
    listener();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") revisit();
    else away = true;
  };
  window.addEventListener("focus", revisit);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("focus", revisit);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * @fn readAssignedShortcuts
 * @brief What Chrome currently has bound for each declared command.
 * @details Chrome lists every declared command whether or not it is assigned,
 *          reporting an unassigned one with an empty shortcut. Commands the
 *          descriptors do not name are dropped, and a build whose `commands`
 *          surface is missing resolves to nothing bound rather than throwing —
 *          the rows then read as unassigned, which is the honest answer.
 * @return Promise<Record<string, string>> - Shortcut by command name, absent when unassigned
 */
export async function readAssignedShortcuts(): Promise<Record<string, string>> {
  const all = await chrome.commands?.getAll?.() ?? [];
  const assigned: Record<string, string> = {};
  for (const command of all) {
    if (command.name === undefined) continue;
    if (command.shortcut === undefined || command.shortcut === "") continue;
    assigned[command.name] = command.shortcut;
  }
  return assigned;
}
