/**
 * @file urllist.tsx
 */

/**
 * @fn saveUrl
 * @brief Save the URL to chrome.storage
 * @param string[] urls - The URL list to save
 * @return void
 */
export async function saveUrl(url: string): Promise<void> {
  const data = await chrome.storage.sync.get({ urls: [] });
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    console.debug(data);
  }
  if (data.urls.length) {
    // Merge the new URL list with the existing URL list
    const savedUrls = data.urls.concat(url);
    await chrome.storage.sync.set({ urls: savedUrls });
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      console.debug(savedUrls);
    }
  }
}

/**
 * @fn showUrls
 * @brief Show the URL list from chrome.storage
 * @return Promise<string[]>
 */
export async function showUrls(): Promise<string[]> {
  const data = await chrome.storage.sync.get({ urls: [] });
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    console.debug(data);
    return [];
  } else {
    return data.urls as string[];
  }
}

/**
 * @fn removeUrl
 * @brief Remove the URL from chrome.storage
 * @param string url - The URL to remove
 * @return Promise<void>
 */
export async function removeUrl(url: string): Promise<string[]> {
  const data = await chrome.storage.sync.get({ urls: [] }) as { urls: string[] };
  if (data.urls && data.urls.length) {
    // filter the new URL list with the existing URL list
    const savedUrls = data.urls.filter((u) => u !== url);
    await chrome.storage.sync.set({ urls: savedUrls });
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      console.debug(savedUrls);
      return [] as string[];
    }
    return savedUrls as string[];
  }
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    console.debug(data);
  }
  return [] as string[];
}

// todo: swap allowlist/denylist
// todo: zod for validation
// todo: use dictionary for allowlist/denylist