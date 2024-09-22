/**
 * @reference https://developer.chrome.com/docs/extensions/reference/i18n/
 * @returns {Promise<string[]>} - Returns a promise that resolves to an array of strings representing the accept-languages of the browser.
 */
export async function getAcceptLanguage(): Promise<string[]> {
  let languages = await chrome.i18n.getAcceptLanguages();
  return languages;
}

/**
 * @reference https://developer.chrome.com/docs/extensions/reference/i18n/
 * @returns {Promise<string>} - Returns a promise that resolves to a string representing the UI language of the browser.
 */
export function getUILanguage(): string {
  return chrome.i18n.getUILanguage();
}