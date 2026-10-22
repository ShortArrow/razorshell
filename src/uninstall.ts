/**
 * @file uninstall.ts
 * @brief The anonymous survey Chrome opens after Razorshell is uninstalled (ADR-0015).
 *
 * Imported by the service worker alone. A module shared with the options
 * bundle would be hoisted into a chunk the worker must `import`, and the
 * manifest registers the worker as a classic script, so it would load nothing.
 */

const formUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdb9kSA7TuOhYZSPMm46wBy0ANS9tyIpb3AqC9TtNdXhsDLIQ/viewform";

/** The form's "Version" question, as Google Forms names it in a prefilled link. */
const versionEntry = "entry.965640582";

/**
 * @fn uninstallSurveyUrl
 * @brief The survey address with the version question already answered.
 * @param string version - The extension version being uninstalled
 * @return string
 */
export function uninstallSurveyUrl(version: string): string {
  const url = new URL(formUrl);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(versionEntry, version);
  return url.href;
}

/** The part of `chrome.runtime` registration needs, so a test can supply its own. */
export interface UninstallRuntime {
  /** Returns a Promise in MV3; the installed type definitions still declare it void. */
  setUninstallURL: (url: string) => Promise<void> | void;
  getManifest: () => { version: string };
}

/**
 * @fn registerUninstallSurvey
 * @brief Point Chrome's uninstall page at the survey for the running version.
 * @details Chrome keeps the address across worker restarts, so registering on
 *          every start is harmless and keeps the version current after an update.
 * @param UninstallRuntime runtime - `chrome.runtime`
 * @return Promise<void>
 */
export async function registerUninstallSurvey(runtime: UninstallRuntime): Promise<void> {
  await runtime.setUninstallURL(uninstallSurveyUrl(runtime.getManifest().version));
}
