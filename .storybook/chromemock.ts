/**
 * @file chromemock.ts
 * @brief In-memory stand-in for the subset of the chrome extension API the
 *        options UI touches, so that stories render outside an extension host.
 * @details `chrome.storage` is the only stateful part; the i18n and runtime
 *          surfaces are pure functions over the packaged english dictionary.
 *          Installed onto globalThis before any story module is imported,
 *          because `src/languages.ts` and `src/keymapstore.ts` read chrome at
 *          module init.
 *
 *          The storage areas follow real chrome.storage where the difference is
 *          observable from a story:
 *          - values cross the boundary by structured clone, so a caller that
 *            mutates what it wrote or what it read cannot reach the store;
 *          - `get` of a string or string[] omits keys that hold no value, as
 *            chrome does, rather than reporting them as undefined. Only the
 *            object form fills defaults in;
 *          - `sync` and `local` are separate stores, and a change notification
 *            carries the areaName of the area that was written.
 *
 *          Two behaviours are deliberately not modelled. A `set` that writes a
 *          key its current value still notifies listeners — real chrome's
 *          behaviour here is unverified, so the mock keeps what the stories were
 *          written against rather than guessing. And the armed-failure queue is
 *          the sync area's alone: `local` writes always succeed, which keeps the
 *          arming unambiguous for the options UI, which only writes to sync.
 */

import englishMessages from '../src/_locales/en/messages.json';

type StorageArea = typeof chrome.storage.sync;
type ChangeListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];
type AreaName = 'sync' | 'local';
type StorageQuery = string | string[] | Record<string, unknown> | null | undefined;

const defaultUiLanguage = 'en';
const defaultAcceptLanguages = ['en-US', 'en'];

let syncStore: Record<string, unknown> = {};
let localStore: Record<string, unknown> = {};
let uiLanguage = defaultUiLanguage;
let acceptLanguages = defaultAcceptLanguages;
const armedSetFailures: string[] = [];
const changeListeners: ChangeListener[] = [];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultsOf(query: unknown): Record<string, unknown> {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) return {};
  return query as Record<string, unknown>;
}

function notify(area: AreaName, changes: Record<string, chrome.storage.StorageChange>): void {
  for (const listener of changeListeners) listener(changes, area);
}

function readFrom(store: Record<string, unknown>, query: StorageQuery): Record<string, unknown> {
  if (query === null || query === undefined) return clone(store);
  const result: Record<string, unknown> = {};
  if (typeof query === 'string' || Array.isArray(query)) {
    for (const key of typeof query === 'string' ? [query] : query) {
      if (key in store) result[key] = clone(store[key]);
    }
    return result;
  }
  const defaults = defaultsOf(query);
  for (const key of Object.keys(defaults)) {
    result[key] = key in store ? clone(store[key]) : clone(defaults[key]);
  }
  return result;
}

function writeTo(
  store: Record<string, unknown>,
  area: AreaName,
  items: Record<string, unknown>,
): void {
  const changes: Record<string, chrome.storage.StorageChange> = {};
  for (const [key, value] of Object.entries(items)) {
    const stored = clone(value);
    changes[key] = { oldValue: clone(store[key]), newValue: clone(stored) };
    store[key] = stored;
  }
  notify(area, changes);
}

function deleteFrom(
  store: Record<string, unknown>,
  area: AreaName,
  keys: string | string[],
): void {
  const changes: Record<string, chrome.storage.StorageChange> = {};
  for (const key of typeof keys === 'string' ? [keys] : keys) {
    if (!(key in store)) continue;
    changes[key] = { oldValue: clone(store[key]), newValue: undefined };
    delete store[key];
  }
  notify(area, changes);
}

const syncArea = {
  get: async (query?: StorageQuery) => readFrom(syncStore, query),
  set: async (items: Record<string, unknown>) => {
    const armed = armedSetFailures.shift();
    if (armed !== undefined) throw new Error(armed);
    writeTo(syncStore, 'sync', items);
  },
  remove: async (keys: string | string[]) => deleteFrom(syncStore, 'sync', keys),
} as unknown as StorageArea;

const localArea = {
  get: async (query?: StorageQuery) => readFrom(localStore, query),
  set: async (items: Record<string, unknown>) => writeTo(localStore, 'local', items),
  remove: async (keys: string | string[]) => deleteFrom(localStore, 'local', keys),
} as unknown as StorageArea;

/**
 * @fn resetStorage
 * @brief Replace both in-memory stores, without notifying listeners.
 * @details Also disarms every pending write failure, so that a story which armed
 *          one and never spent it cannot fail the next story's first write. The
 *          seed goes to sync, which is where the options UI keeps everything;
 *          local starts empty.
 * @param seed - The sync storage contents the story starts from
 * @return void
 */
export function resetStorage(seed: Record<string, unknown> = {}): void {
  syncStore = clone(seed);
  localStore = {};
  armedSetFailures.length = 0;
}

/**
 * @fn failNextSet
 * @brief Arm one further sync write to reject.
 * @details The mock is otherwise infallible, so a component's save-failure path
 *          has no way to run. Each call adds one arming to a queue, and each
 *          rejected write spends the one at its head, so arming twice makes the
 *          next two writes fail in turn — which is what a double-fault recovery
 *          story needs. `local` writes are never armed.
 * @param string message - The Error message the rejected write carries
 * @return void
 */
export function failNextSet(message: string): void {
  armedSetFailures.push(message);
}

/**
 * @fn seedBrowserLanguages
 * @brief Fix what chrome.i18n reports about the browser's languages.
 * @param ui - The value getUILanguage returns
 * @param accept - The list getAcceptLanguages resolves to
 * @return void
 */
export function seedBrowserLanguages({ ui, accept }: { ui: string; accept: string[] }): void {
  uiLanguage = ui;
  acceptLanguages = accept;
}

/**
 * @fn resetBrowserLanguages
 * @brief Restore the packaged english defaults chrome.i18n reports.
 * @return void
 */
export function resetBrowserLanguages(): void {
  uiLanguage = defaultUiLanguage;
  acceptLanguages = defaultAcceptLanguages;
}

/**
 * @fn storedValue
 * @brief Read one key straight out of the mock's sync store, for play functions
 *        that assert a component persisted what it rendered.
 * @details The value is cloned, so an assertion cannot be satisfied by a
 *          reference the component still holds and later mutates.
 * @param key - The storage key to read
 * @return The stored value, or undefined when the key was never written
 */
export function storedValue<T = unknown>(key: string): T | undefined {
  return key in syncStore ? clone(syncStore[key]) as T : undefined;
}

/**
 * @fn installChromeMock
 * @brief Publish the mock on globalThis.chrome, idempotently.
 * @return void
 */
export function installChromeMock(): void {
  const mock = {
    storage: {
      sync: syncArea,
      local: localArea,
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
