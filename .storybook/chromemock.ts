/**
 * @file chromemock.ts
 * @brief In-memory stand-in for the subset of the chrome extension API the
 *        options UI touches, so that stories render outside an extension host.
 * @details `chrome.storage.sync` is the only stateful part; the i18n and
 *          runtime surfaces are pure functions over the packaged english
 *          dictionary. Installed onto globalThis before any story module is
 *          imported, because `src/languages.ts` and `src/keymapstore.ts` read
 *          chrome at module init.
 */

import englishMessages from '../src/_locales/en/messages.json';

type StorageArea = typeof chrome.storage.sync;
type ChangeListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

const uiLanguage = 'en';
const acceptLanguages = ['en-US', 'en'];

let store: Record<string, unknown> = {};
const changeListeners: ChangeListener[] = [];

function keysOf(query: string | string[] | Record<string, unknown> | null | undefined): string[] {
  if (query === null || query === undefined) return Object.keys(store);
  if (typeof query === 'string') return [query];
  if (Array.isArray(query)) return query;
  return Object.keys(query);
}

function defaultsOf(query: unknown): Record<string, unknown> {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) return {};
  return query as Record<string, unknown>;
}

function notify(changes: Record<string, chrome.storage.StorageChange>): void {
  for (const listener of changeListeners) listener(changes, 'sync');
}

async function get(query?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
  const defaults = defaultsOf(query);
  const result: Record<string, unknown> = {};
  for (const key of keysOf(query)) {
    result[key] = key in store ? store[key] : defaults[key];
  }
  return result;
}

async function set(items: Record<string, unknown>): Promise<void> {
  const changes: Record<string, chrome.storage.StorageChange> = {};
  for (const [key, value] of Object.entries(items)) {
    changes[key] = { oldValue: store[key], newValue: value };
    store[key] = value;
  }
  notify(changes);
}

async function remove(keys: string | string[]): Promise<void> {
  const list = typeof keys === 'string' ? [keys] : keys;
  const changes: Record<string, chrome.storage.StorageChange> = {};
  for (const key of list) {
    if (!(key in store)) continue;
    changes[key] = { oldValue: store[key], newValue: undefined };
    delete store[key];
  }
  notify(changes);
}

/**
 * @fn resetStorage
 * @brief Replace the whole in-memory store, without notifying listeners.
 * @param seed - The storage contents the story starts from
 * @return void
 */
export function resetStorage(seed: Record<string, unknown> = {}): void {
  store = { ...seed };
}

/**
 * @fn installChromeMock
 * @brief Publish the mock on globalThis.chrome, idempotently.
 * @return void
 */
export function installChromeMock(): void {
  const storageArea = { get, set, remove } as unknown as StorageArea;
  const mock = {
    storage: {
      sync: storageArea,
      local: storageArea,
      onChanged: {
        addListener: (listener: ChangeListener) => { changeListeners.push(listener); },
        removeListener: (listener: ChangeListener) => {
          const index = changeListeners.indexOf(listener);
          if (index !== -1) changeListeners.splice(index, 1);
        },
      },
    },
    runtime: {
      getURL: (path: string) => path,
    },
    i18n: {
      getMessage: (name: string) => englishMessages[name as keyof typeof englishMessages]?.message ?? '',
      getUILanguage: () => uiLanguage,
      getAcceptLanguages: async () => acceptLanguages,
    },
  };
  Object.assign(globalThis, { chrome: mock });
}
