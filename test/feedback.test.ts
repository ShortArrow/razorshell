/**
 * The feedback links on the options page. GitHub opens an issue form from
 * `issues/new?template=<file>` and prefills a field from a query parameter
 * named after the field's `id`, so a report arrives already carrying the
 * version a user would otherwise have to look up in chrome://extensions.
 */
import { describe, expect, test } from "vitest";
import { feedbackLinks } from "../src/feedback";

describe("feedbackLinks", () => {
  const links = feedbackLinks("0.0.8");
  const byLabel = (label: string) => {
    const link = links.find((candidate) => candidate.label === label);
    expect(link, label).toBeDefined();
    return new URL(link!.href);
  };

  test("lists the report, the request and the discussions in that order", () => {
    expect(links.map((link) => link.label)).toEqual([
      "Report a problem",
      "Request a binding",
      "Ideas and questions",
    ]);
  });

  test("a problem report opens the site form with the version filled in", () => {
    const url = byLabel("Report a problem");
    expect(url.origin + url.pathname).toBe("https://github.com/ShortArrow/razorshell/issues/new");
    expect(url.searchParams.get("template")).toBe("site-not-working.yml");
    expect(url.searchParams.get("version")).toBe("0.0.8");
  });

  test("a binding request opens the binding form", () => {
    const url = byLabel("Request a binding");
    expect(url.origin + url.pathname).toBe("https://github.com/ShortArrow/razorshell/issues/new");
    expect(url.searchParams.get("template")).toBe("missing-binding.yml");
  });

  test("ideas and questions go to the discussions", () => {
    expect(byLabel("Ideas and questions").href).toBe("https://github.com/ShortArrow/razorshell/discussions");
  });

  test("a version with characters a URL reserves arrives intact", () => {
    const url = new URL(feedbackLinks("0.0.8 & beta").find((l) => l.label === "Report a problem")!.href);
    expect(url.searchParams.get("version")).toBe("0.0.8 & beta");
  });

  test("the forms the links name exist in the repository", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const template of ["site-not-working.yml", "missing-binding.yml"]) {
      expect(existsSync(join(__dirname, "..", ".github", "ISSUE_TEMPLATE", template)), template).toBe(true);
    }
  });
});
