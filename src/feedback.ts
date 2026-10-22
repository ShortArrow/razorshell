/**
 * @file feedback.ts
 * @brief Where the options page sends a user who has something to report.
 */

const repository = "https://github.com/ShortArrow/razorshell";

export interface FeedbackLink {
  label: string;
  href: string;
}

/**
 * @fn feedbackLinks
 * @brief The report, request and discussion links, in the order the page shows them.
 * @details A problem report opens the site form with the `version` field
 *          already filled, through GitHub's issue-form query parameters, so
 *          the reporter does not have to look the version up. The form file
 *          names must match .github/ISSUE_TEMPLATE, which a test checks.
 * @param string version - The running extension's version
 * @return FeedbackLink[]
 */
export function feedbackLinks(version: string): FeedbackLink[] {
  const report = new URL(`${repository}/issues/new`);
  report.searchParams.set("template", "site-not-working.yml");
  report.searchParams.set("version", version);
  const request = new URL(`${repository}/issues/new`);
  request.searchParams.set("template", "missing-binding.yml");
  return [
    { label: "Report a problem", href: report.href },
    { label: "Request a binding", href: request.href },
    { label: "Ideas and questions", href: `${repository}/discussions` },
  ];
}
