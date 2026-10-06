/**
 * The permission surface the extension ships with.
 *
 * Every permission a manifest lists is shown to the user at install time and is
 * granted for the life of the extension, so a permission nothing calls is a
 * capability handed over for nothing in return. Editing runs entirely inside the
 * page through the statically declared content scripts, which need no
 * `activeTab` grant and no `scripting` API. Asserting the whole array rather
 * than the absence of two names is what makes a silently re-added permission go
 * red.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "manifest.json"), "utf8"),
) as { version: string; permissions: string[]; host_permissions: string[] };

const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { version: string };

describe("the shipped manifest", () => {
  test("the manifest asks for storage and hosts and nothing else", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(["*://*/*"]);
  });

  test("package.json and the manifest carry the same version", () => {
    expect(manifest.version).toBe(packageJson.version);
  });
});

/**
 * The store takes the listing's short description from the manifest's
 * `description`, resolved per locale, and refuses an upload whose text is
 * longer than 132 characters. The rejection arrives only at upload time, so
 * the limit is held here instead.
 */
describe("the store's short description", () => {
  const localesDir = join(__dirname, "..", "src", "_locales");
  test.each(readdirSync(localesDir))("%s fits the store's 132 characters", (locale) => {
    const messages = JSON.parse(
      readFileSync(join(localesDir, locale, "messages.json"), "utf8"),
    ) as { description: { message: string } };
    const text = messages.description.message;
    expect(text).toBe(text.trim());
    expect([...text].length).toBeLessThanOrEqual(132);
  });
});
