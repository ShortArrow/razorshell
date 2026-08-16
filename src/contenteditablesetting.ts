/**
 * @file contenteditablesetting.ts
 * @brief chrome.storage access for the contenteditable opt-in, which stays off
 *        until the user turns it on because rich editors carry their own
 *        shortcuts.
 */

const settingKey = "enableContentEditable";

/**
 * @fn loadContentEditableSetting
 * @brief Read the stored opt-in, absent meaning off.
 * @return Promise<boolean>
 */
export async function loadContentEditableSetting(): Promise<boolean> {
  const data = await chrome.storage.sync.get({ [settingKey]: false }) as { enableContentEditable: boolean };
  return data.enableContentEditable === true;
}

/**
 * @fn saveContentEditableSetting
 * @brief Persist the opt-in.
 * @param boolean value - Whether the keybindings apply inside contenteditable roots
 * @return Promise<void>
 */
export async function saveContentEditableSetting(value: boolean): Promise<void> {
  await chrome.storage.sync.set({ [settingKey]: value });
}

type SettingListener = (value: boolean) => void;

const listeners = new Set<SettingListener>();
let chromeListenerAttached = false;

function attachChromeListener(): void {
  if (chromeListenerAttached) return;
  chromeListenerAttached = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const change = changes[settingKey];
    if (!change) return;
    const value = change.newValue === true;
    for (const listener of [...listeners]) listener(value);
  });
}

/**
 * @fn subscribeContentEditableSetting
 * @brief Invoke the callback whenever the stored opt-in changes.
 * @param callback - Receives the new value
 * @return () => void - Releases this callback. The module holds one chrome
 *         listener for the page lifetime and fans out to its own list, so
 *         repeated subscribe/unsubscribe cycles add nothing to chrome.
 */
export function subscribeContentEditableSetting(callback: SettingListener): () => void {
  attachChromeListener();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
