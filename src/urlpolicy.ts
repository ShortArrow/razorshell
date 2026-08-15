/**
 * @file urlpolicy.ts
 * @brief chrome.storage access for the url policy, including the one-shot legacy migration.
 */

import { UrlPolicy, defaultUrlPolicy, migrateLegacyUrls } from "./urlrules";

const policyKey = "urlPolicy";
const legacyKey = "urls";

async function migrateFromLegacyUrls(): Promise<UrlPolicy> {
  const legacy = await chrome.storage.sync.get({ [legacyKey]: null }) as { urls: string[] | null };
  if (!legacy.urls) return defaultUrlPolicy;
  const policy = migrateLegacyUrls(legacy.urls);
  await chrome.storage.sync.set({ [policyKey]: policy });
  await chrome.storage.sync.remove(legacyKey);
  return policy;
}

/**
 * @fn loadUrlPolicy
 * @brief Read the stored policy, migrating the legacy url list when the policy is absent.
 * @param options - migrate: false leaves the legacy list untouched, so that only one
 *        caller among concurrent readers such as every frame's content script writes it
 * @return Promise<UrlPolicy>
 */
export async function loadUrlPolicy(options: { migrate?: boolean } = {}): Promise<UrlPolicy> {
  const data = await chrome.storage.sync.get({ [policyKey]: null }) as { urlPolicy: UrlPolicy | null };
  if (data.urlPolicy) return data.urlPolicy;
  if (options.migrate === false) return defaultUrlPolicy;
  return migrateFromLegacyUrls();
}

/**
 * @fn saveUrlPolicy
 * @brief Persist the policy.
 * @param UrlPolicy policy - The policy to store
 * @return Promise<void>
 */
export async function saveUrlPolicy(policy: UrlPolicy): Promise<void> {
  await chrome.storage.sync.set({ [policyKey]: policy });
}

/**
 * @fn subscribeUrlPolicy
 * @brief Invoke the callback whenever the stored policy changes.
 * @param callback - Receives the new policy
 * @return void
 */
export function subscribeUrlPolicy(callback: (policy: UrlPolicy) => void): void {
  chrome.storage.onChanged.addListener((changes) => {
    const change = changes[policyKey];
    if (!change) return;
    callback((change.newValue as UrlPolicy | undefined) ?? defaultUrlPolicy);
  });
}
