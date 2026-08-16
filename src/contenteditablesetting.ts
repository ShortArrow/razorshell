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

/**
 * @fn subscribeContentEditableSetting
 * @brief Invoke the callback whenever the stored opt-in changes.
 * @param callback - Receives the new value
 * @return void
 */
export function subscribeContentEditableSetting(callback: (value: boolean) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const change = changes[settingKey];
    if (!change) return;
    callback(change.newValue === true);
  });
}
