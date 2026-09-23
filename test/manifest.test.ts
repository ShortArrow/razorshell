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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "manifest.json"), "utf8"),
) as { permissions: string[]; host_permissions: string[] };

describe("the shipped manifest", () => {
  test("the manifest asks for storage and hosts and nothing else", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(["*://*/*"]);
  });
});
