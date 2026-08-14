/**
 * @file keymapstore.ts
 * @brief chrome.storage access for the gui override layer, holding the active
 *        keymap so callers need not know how many layers compose it.
 */

import { defaultKeymap } from "./keymap";
import { Chord, mergeKeymap } from "./keymapmerge";
import { Keymap } from "./operation";

const overridesKey = "keymapOverrides";

export type KeymapOverrides = Record<string, Chord>;

let guiOverrides: KeymapOverrides = {};
const listeners: (() => void)[] = [];

/**
 * @fn getActiveKeymap
 * @brief Compose the layers currently in force.
 * @return Keymap[] - The defaults before init, the overridden keymap after
 */
export function getActiveKeymap(): Keymap[] {
  return mergeKeymap(defaultKeymap, guiOverrides);
}

/**
 * @fn getKeymapOverrides
 * @brief Read the gui override layer as stored.
 * @return KeymapOverrides - Chords by entry id, empty when nothing is overridden
 */
export function getKeymapOverrides(): KeymapOverrides {
  return guiOverrides;
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

async function loadOverrides(): Promise<void> {
  const data = await chrome.storage.sync.get({ [overridesKey]: {} }) as { keymapOverrides: KeymapOverrides };
  guiOverrides = data.keymapOverrides ?? {};
}

/**
 * @fn onKeymapChange
 * @brief Register a callback invoked whenever the active keymap is replaced.
 * @param listener - Receives no arguments
 * @return void
 */
export function onKeymapChange(listener: () => void): void {
  listeners.push(listener);
}

/**
 * @fn initKeymap
 * @brief Load the stored overrides and keep them in step with storage changes.
 * @return Promise<void>
 */
export async function initKeymap(): Promise<void> {
  await loadOverrides();
  chrome.storage.onChanged.addListener((changes) => {
    const change = changes[overridesKey];
    if (!change) return;
    guiOverrides = (change.newValue as KeymapOverrides | undefined) ?? {};
    notifyListeners();
  });
}

async function writeOverrides(overrides: KeymapOverrides): Promise<void> {
  guiOverrides = overrides;
  await chrome.storage.sync.set({ [overridesKey]: overrides });
  notifyListeners();
}

/**
 * @fn saveKeymapOverride
 * @brief Bind an entry to a chord in the gui layer.
 * @param string id - The keymap entry id
 * @param Chord chord - The chord replacing the entry's own
 * @return Promise<void>
 */
export async function saveKeymapOverride(id: string, chord: Chord): Promise<void> {
  await writeOverrides({ ...guiOverrides, [id]: chord });
}

/**
 * @fn clearKeymapOverride
 * @brief Drop one entry's gui override, restoring its default chord.
 * @param string id - The keymap entry id
 * @return Promise<void>
 */
export async function clearKeymapOverride(id: string): Promise<void> {
  const remaining = { ...guiOverrides };
  delete remaining[id];
  await writeOverrides(remaining);
}

/**
 * @fn clearAllKeymapOverrides
 * @brief Drop the whole gui layer.
 * @return Promise<void>
 */
export async function clearAllKeymapOverrides(): Promise<void> {
  await writeOverrides({});
}
