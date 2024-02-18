/**
 * @file urllist.tsx
 */

/**
 * @fn saveUrl
 * @brief Save the URL to chrome.storage
 * @param string[] urls - The URL list to save
 * @return void
 */
export function saveUrl(urls: string[]): void {
  chrome.storage.sync.get({ urls: [] }, function (data) {
    // Merge the new URL list with the existing URL list
    const savedUrls = data.urls.concat(urls);
    chrome.storage.sync.set({ urls: savedUrls }, function () {
      console.debug('URL is set to ' + urls);
    });
  });
}

/**
 * @fn showUrls
 * @brief Show the URL list from chrome.storage
 * @return Promise<string[]>
 */
export function showUrls(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get({ urls: [] }, function (data) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(data.urls);
      }
    });
  });
}
