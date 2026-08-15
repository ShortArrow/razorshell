/**
 * @file i18n.ts
 * @brief Pure locale helpers shared by the runtime language override. No chrome API access.
 */

export type MessageDict = Record<string, { message: string }>;

export const availableLocales: readonly string[] = [
  "ar", "de", "en", "es", "fr", "id", "ja", "ko", "pt_BR", "ru", "zh_CN",
];

/**
 * @fn normalizeLocale
 * @brief Match a stored setting against the packaged locale names, ignoring case and hyphens.
 * @param string|undefined value - The stored setting, "auto" or a locale name
 * @return string|null - The packaged locale name, or null when no override applies
 */
export function normalizeLocale(value: string | undefined): string | null {
  if (value === undefined) return null;
  const candidate = value.replace(/-/g, "_").toLowerCase();
  return availableLocales.find((locale) => locale.toLowerCase() === candidate) ?? null;
}

/**
 * @fn lookupMessage
 * @brief Resolve a message key through the primary dictionary, then english, then the key itself.
 * @param dicts - The active locale dictionary and the english fallback dictionary
 * @param string key - The message key
 * @return string
 */
export function lookupMessage(
  dicts: { primary?: MessageDict; english: MessageDict },
  key: string,
): string {
  return dicts.primary?.[key]?.message ?? dicts.english[key]?.message ?? key;
}
