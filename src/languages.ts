import { MessageDict, lookupMessage, normalizeLocale } from "./i18n";

const languageKey = "language";
const autoLanguage = "auto";

let activeDict: MessageDict | undefined;
let englishDict: MessageDict | undefined;
const listeners: (() => void)[] = [];

/**
 * @reference https://developer.chrome.com/docs/extensions/reference/i18n/
 * @returns {Promise<string[]>} - Returns a promise that resolves to an array of strings representing the accept-languages of the browser.
 */
export async function getAcceptLanguage(): Promise<string[]> {
  const languages = await chrome.i18n.getAcceptLanguages();
  return languages;
}

/**
 * @reference https://developer.chrome.com/docs/extensions/reference/i18n/
 * @returns {Promise<string>} - Returns a promise that resolves to a string representing the UI language of the browser.
 */
export function getUILanguage(): string {
  return chrome.i18n.getUILanguage();
}

export function getMessage(messageName: string): () => string {
  return () => {
    if (activeDict && englishDict) {
      return lookupMessage({ primary: activeDict, english: englishDict }, messageName);
    }
    return chrome.i18n.getMessage(messageName);
  };
}

async function fetchDict(locale: string): Promise<MessageDict> {
  const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
  if (!response.ok) throw new Error(`failed to load messages for ${locale}`);
  return await response.json() as MessageDict;
}

async function loadDicts(locale: string | null): Promise<void> {
  if (!locale) {
    activeDict = undefined;
    englishDict = undefined;
    return;
  }
  try {
    const [primary, english] = await Promise.all([fetchDict(locale), fetchDict("en")]);
    activeDict = primary;
    englishDict = english;
  } catch {
    activeDict = undefined;
    englishDict = undefined;
  }
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/**
 * @fn getLanguageSetting
 * @brief Read the stored language override.
 * @return Promise<string> - A packaged locale name, or "auto" when the browser language applies
 */
export async function getLanguageSetting(): Promise<string> {
  const data = await chrome.storage.sync.get({ [languageKey]: autoLanguage }) as { language: string };
  return data.language;
}

/**
 * @fn setLanguage
 * @brief Persist the language override.
 * @param string value - A packaged locale name, or "auto"
 * @return Promise<void>
 */
export async function setLanguage(value: string): Promise<void> {
  await chrome.storage.sync.set({ [languageKey]: value });
}

/**
 * @fn onLanguageChange
 * @brief Register a callback invoked whenever the active dictionary is replaced.
 * @param listener - Receives no arguments
 * @return void
 */
export function onLanguageChange(listener: () => void): void {
  listeners.push(listener);
}

/**
 * @fn initI18n
 * @brief Load the dictionaries for the stored override and keep them in step with storage changes.
 * @return Promise<void>
 */
export async function initI18n(): Promise<void> {
  await loadDicts(normalizeLocale(await getLanguageSetting()));
  chrome.storage.onChanged.addListener((changes) => {
    const change = changes[languageKey];
    if (!change) return;
    const locale = normalizeLocale(change.newValue as string | undefined);
    loadDicts(locale).then(notifyListeners);
  });
}
