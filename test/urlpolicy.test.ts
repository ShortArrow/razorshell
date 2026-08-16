/**
 * The migration flag is what keeps concurrent readers from racing: every frame's
 * content script loads the policy, but only the top frame is allowed to rewrite
 * the legacy list. These tests pin both halves of that contract against a mocked
 * chrome, since the difference is invisible in the returned policy alone and
 * only shows in whether storage was written.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadUrlPolicy } from "../src/urlpolicy";
import { defaultUrlPolicy } from "../src/urlrules";

const legacyUrl = "https://example.com/legacy";

let get: ReturnType<typeof vi.fn>;
let set: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;

/** Storage holding no policy but carrying a legacy url list, the only state in which the flag matters. */
function stubLegacyOnlyStorage(): void {
  get = vi.fn(async (defaults: Record<string, unknown>) =>
    "urls" in defaults ? { urls: [legacyUrl] } : { urlPolicy: null },
  );
  set = vi.fn(async () => undefined);
  remove = vi.fn(async () => undefined);
  vi.stubGlobal("chrome", { storage: { sync: { get, set, remove } } });
}

describe("loadUrlPolicy legacy migration", () => {
  beforeEach(stubLegacyOnlyStorage);

  test("migrate: false leaves the legacy list alone and reports the default policy", async () => {
    expect(await loadUrlPolicy({ migrate: false })).toEqual(defaultUrlPolicy);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test("the default converts the legacy list, stores it and drops the old key", async () => {
    expect(await loadUrlPolicy()).toEqual({
      defaultAction: "allow",
      rules: [{ pattern: legacyUrl, matchType: "exact", action: "deny" }],
    });
    expect(set).toHaveBeenCalledWith({
      urlPolicy: {
        defaultAction: "allow",
        rules: [{ pattern: legacyUrl, matchType: "exact", action: "deny" }],
      },
    });
    expect(remove).toHaveBeenCalledWith("urls");
  });
});
