/**
 * The page Chrome opens after an uninstall: an anonymous Google form asking why
 * (ADR-0015). The running version rides along in the form's version field
 * through Google Forms' prefill parameters, so an answer says which build the
 * user left.
 */
import { describe, expect, test, vi } from "vitest";
import { registerUninstallSurvey, uninstallSurveyUrl } from "../src/uninstall";

const formBase =
  "https://docs.google.com/forms/d/e/1FAIpQLSdb9kSA7TuOhYZSPMm46wBy0ANS9tyIpb3AqC9TtNdXhsDLIQ/viewform";

describe("the uninstall survey", () => {
  test("opens the form with the version prefilled", () => {
    const url = new URL(uninstallSurveyUrl("0.0.8"));
    expect(url.origin + url.pathname).toBe(formBase);
    expect(url.searchParams.get("usp")).toBe("pp_url");
    expect(url.searchParams.get("entry.965640582")).toBe("0.0.8");
  });

  test("fits the 1023 characters Chrome accepts for an uninstall URL", () => {
    expect(uninstallSurveyUrl("0.0.8").length).toBeLessThanOrEqual(1023);
  });

  test("is registered with the running version", async () => {
    const setUninstallURL = vi.fn(async () => {});
    await registerUninstallSurvey({ setUninstallURL, getManifest: () => ({ version: "1.2.3" }) });
    expect(setUninstallURL).toHaveBeenCalledTimes(1);
    expect(new URL(setUninstallURL.mock.calls[0][0] as string).searchParams.get("entry.965640582")).toBe("1.2.3");
  });
});
