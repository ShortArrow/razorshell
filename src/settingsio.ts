/**
 * @file settingsio.ts
 * @brief Pure parsing and serialization of the exported settings document. No chrome API access.
 */

import { availableLocales, normalizeLocale } from "./i18n";
import { defaultKeymap } from "./keymap";
import { Chord } from "./keymapmerge";
import { MatchType, RuleAction, UrlPolicy, UrlRule } from "./urlrules";

export interface SettingsFile {
  version: 1;
  urlPolicy?: UrlPolicy;
  keymapOverrides?: Record<string, Chord>;
  language?: string;
  theme?: "light" | "dark";
  enableContentEditable?: boolean;
}

export type ParseResult =
  | { ok: true; settings: SettingsFile }
  | { ok: false; error: string };

class SettingsError extends Error {}

const settingKeys = [
  "version",
  "urlPolicy",
  "keymapOverrides",
  "language",
  "theme",
  "enableContentEditable",
];

const matchTypes: MatchType[] = ["exact", "glob", "regex"];
const ruleActions: RuleAction[] = ["allow", "deny"];
const themes = ["light", "dark"];
const modifiers = ["ctrl", "alt", "shift"];
const autoLanguage = "auto";
const keymapIds = defaultKeymap.map((entry) => entry.id);

function reject(message: string): never {
  throw new SettingsError(message);
}

function asRecord(value: unknown, subject: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    reject(`${subject} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown, subject: string): boolean {
  if (typeof value !== "boolean") reject(`${subject} must be a boolean`);
  return value;
}

function asString(value: unknown, subject: string): string {
  if (typeof value !== "string") reject(`${subject} must be a string`);
  return value;
}

function asMember<T extends string>(value: unknown, allowed: T[], subject: string): T {
  const text = asString(value, subject);
  if (!allowed.includes(text as T)) {
    reject(`${subject} must be one of ${allowed.join(", ")}`);
  }
  return text as T;
}

function parseVersion(value: unknown): 1 {
  if (value === undefined) reject("version is required");
  if (value !== 1) reject("version must be 1");
  return 1;
}

function parseRule(value: unknown, index: number): UrlRule {
  const rule = asRecord(value, `urlPolicy.rules[${index}]`);
  return {
    pattern: asString(rule.pattern, `urlPolicy.rules[${index}].pattern`),
    matchType: asMember(rule.matchType, matchTypes, `urlPolicy.rules[${index}].matchType`),
    action: asMember(rule.action, ruleActions, `urlPolicy.rules[${index}].action`),
  };
}

function parseUrlPolicy(value: unknown): UrlPolicy {
  const policy = asRecord(value, "urlPolicy");
  if (!Array.isArray(policy.rules)) reject("urlPolicy.rules must be an array");
  return {
    defaultAction: asMember(policy.defaultAction, ruleActions, "urlPolicy.defaultAction"),
    rules: policy.rules.map(parseRule),
  };
}

function parseChord(value: unknown, id: string): Chord {
  const source = asRecord(value, `keymapOverrides.${id}`);
  const key = asString(source.key, `keymapOverrides.${id}.key`);
  if (key === "") reject(`keymapOverrides.${id}.key must not be empty`);
  const chord: Chord = { key };
  for (const modifier of modifiers) {
    if (source[modifier] === undefined) continue;
    chord[modifier as "ctrl" | "alt" | "shift"] = asBoolean(
      source[modifier],
      `keymapOverrides.${id}.${modifier}`,
    );
  }
  return chord;
}

function parseKeymapOverrides(value: unknown): Record<string, Chord> {
  const source = asRecord(value, "keymapOverrides");
  const overrides: Record<string, Chord> = {};
  for (const [id, chord] of Object.entries(source)) {
    if (!keymapIds.includes(id)) reject(`unknown keymap id ${id}`);
    overrides[id] = parseChord(chord, id);
  }
  return overrides;
}

function parseLanguage(value: unknown): string {
  const language = asString(value, "language");
  if (language === autoLanguage) return language;
  if (normalizeLocale(language) === null) {
    reject(`language must be ${autoLanguage} or one of ${availableLocales.join(", ")}`);
  }
  return language;
}

function rejectUnknownKeys(document: Record<string, unknown>): void {
  const unknown = Object.keys(document).find((key) => !settingKeys.includes(key));
  if (unknown !== undefined) reject(`unknown key ${unknown}`);
}

function parseDocument(document: Record<string, unknown>): SettingsFile {
  rejectUnknownKeys(document);
  const settings: SettingsFile = { version: parseVersion(document.version) };
  if (document.urlPolicy !== undefined) settings.urlPolicy = parseUrlPolicy(document.urlPolicy);
  if (document.keymapOverrides !== undefined) {
    settings.keymapOverrides = parseKeymapOverrides(document.keymapOverrides);
  }
  if (document.language !== undefined) settings.language = parseLanguage(document.language);
  if (document.theme !== undefined) {
    settings.theme = asMember(document.theme, themes, "theme") as "light" | "dark";
  }
  if (document.enableContentEditable !== undefined) {
    settings.enableContentEditable = asBoolean(document.enableContentEditable, "enableContentEditable");
  }
  return settings;
}

/**
 * @fn parseSettings
 * @brief Validate a settings document, accepting any subset of the keys beside the version.
 * @param string text - The document as JSON
 * @return ParseResult - The settings, or the first violation found
 */
export function parseSettings(text: string): ParseResult {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { ok: false, error: "not valid JSON" };
  }
  try {
    return { ok: true, settings: parseDocument(asRecord(document, "the settings document")) };
  } catch (error) {
    if (error instanceof SettingsError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * @fn serializeSettings
 * @brief Render settings as an indented document a user can edit by hand.
 * @param SettingsFile settings - The settings to write
 * @return string
 */
export function serializeSettings(settings: SettingsFile): string {
  return JSON.stringify(settings, null, 2);
}
