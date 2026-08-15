/**
 * Visual regression tests over the Storybook stories for the options UI.
 *
 * The suite serves the pre-built `storybook-static/` directory rather than
 * running `storybook dev`, so a run needs no Vite server and no port
 * negotiation with the developer's own Storybook. The build is a prerequisite,
 * not something this spec produces: a missing directory fails the run with the
 * command to run, instead of every story timing out on a connection refusal.
 *
 * Each story is opened through `iframe.html`, which renders the story alone
 * without Storybook's manager chrome, and the screenshot is taken of
 * `#storybook-root` so that the surrounding page background stays out of the
 * comparison. Stories carrying a `play` function settle asynchronously, so the
 * spec waits for the story's completion signal before capturing.
 *
 * Every story is captured under both daisyUI themes, selected through the
 * `globals=theme:<name>` URL parameter that the preview decorator reads, so a
 * regression confined to one theme cannot hide behind the other.
 *
 * The inspector toast is the exception to the `#storybook-root` rule: it is
 * injected into `document.body` at a fixed position, outside the story root
 * entirely, so those stories name the toast element as the capture target. It
 * also removes itself after eight seconds, and the capture happens well inside
 * that window.
 *
 * The light pass also spends an axe run on each story's `incomplete` results —
 * the findings axe could not decide, which the a11y addon shows but never
 * fails on, so they accumulate unnoticed. Two exemptions are allowed and both
 * are narrow; see `isAllowedIncomplete`.
 */
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

const staticDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../storybook-static",
);

const storyIds = [
  "options-configapp--default",
  "options-configapp--import-error",
  "options-keymapapp--default",
  "options-keymapapp--with-override",
  "options-keymapapp--two-modifier-override",
  "options-langapp--auto",
  "options-langapp--overridden",
  "options-richtextapp--off",
  "options-richtextapp--on",
  "options-testapp--default",
  "options-themeapp--default",
  "options-urlapp--empty",
  "options-urlapp--with-rules",
  "options-urlapp--probe-match",
  "options-urlapp--invalid-pattern",
  "inspect-toast--conflicts",
  "inspect-toast--no-conflicts",
  "inspect-toast--inspect-mode",
];

const themes = ["light", "dark"] as const;

const toastSelector = "#razorshell-inspect-toast";

/** The stories whose subject is injected into `document.body`, not the root. */
const injectedStoryIds = new Set([
  "inspect-toast--conflicts",
  "inspect-toast--no-conflicts",
  "inspect-toast--inspect-mode",
]);

function captureSelector(storyId: string): string {
  return injectedStoryIds.has(storyId) ? toastSelector : "#storybook-root";
}

/**
 * The minified axe bundle, read once for injection into every story page.
 *
 * axe-core arrives as a transitive dependency of the a11y addon, so it is not
 * hoisted into `node_modules/` and `require.resolve` finds it only when some
 * other layout puts it there. The pnpm store path is the fallback, matched by
 * glob so that a version bump does not have to be mirrored here.
 */
function readAxeSource(): string {
  const require = createRequire(import.meta.url);
  try {
    return fs.readFileSync(
      path.join(path.dirname(require.resolve("axe-core")), "axe.min.js"),
      "utf8",
    );
  } catch {
    const store = path.resolve(staticDir, "../node_modules/.pnpm");
    const owner = fs
      .readdirSync(store)
      .filter((entry) => entry.startsWith("axe-core@"))
      .sort()
      .at(-1);
    if (owner === undefined) throw new Error(`axe-core not found under ${store}`);
    return fs.readFileSync(
      path.join(store, owner, "node_modules/axe-core/axe.min.js"),
      "utf8",
    );
  }
}

/**
 * Rules switched off for this run, mirroring `.storybook/preview.tsx`.
 *
 * The preview's `a11y.config` reaches the addon only; this spec drives axe
 * directly, so the same reasoning has to be restated here. `bypass` asks a
 * whole page for a skip link, which a single rendered component cannot have.
 */
const disabledRules = ["bypass"];

type IncompleteNode = { rule: string; target: string; html: string; reason: string };

/**
 * The incomplete findings this suite tolerates.
 *
 * Both are the same shape: daisyUI paints something axe cannot see through, so
 * the contrast comes back undecided rather than failing, over a pair that is
 * base-100 on base-content and passes when measured by hand.
 *
 * - A `<select>`'s arrow is a `linear-gradient` background, so axe reports
 *   `bgGradient` on every select the options page renders.
 * - daisyUI's `.tooltip` and `.label` wrappers put content in a `::before`,
 *   and axe refuses to resolve a background underneath a pseudo-element,
 *   reporting `pseudoContent`. These surface only once a story gives the
 *   element visible text, because the contrast check skips elements without
 *   any — which is why an earlier sweep of these stories did not record them.
 *
 * Both are recognised by axe's own `messageKey`, not by the element's tag, so
 * a genuine contrast failure on the same element still fails. Anything else
 * undecided is a defect until someone widens this deliberately.
 */
function isAllowedIncomplete(node: IncompleteNode): boolean {
  return (
    node.rule === "color-contrast" &&
    (node.reason === "bgGradient" || node.reason === "pseudoContent")
  );
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

let server: http.Server;
let origin: string;
let axeSource: string;

function resolveRequestPath(url: string): string | null {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(staticDir, relative);
  if (resolved !== staticDir && !resolved.startsWith(staticDir + path.sep)) return null;
  return resolved;
}

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    throw new Error(
      `storybook-static/ not found at ${staticDir}. Run \`pnpm build-storybook\` first.`,
    );
  }
  axeSource = readAxeSource();
  server = http.createServer((request, response) => {
    const filePath = resolveRequestPath(request.url ?? "/");
    if (filePath === null || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

for (const storyId of storyIds) {
  for (const theme of themes) {
    test(`${storyId} (${theme})`, async ({ page }) => {
      await page.goto(
        `${origin}/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`,
      );

      await page.waitForFunction(() => document.body.classList.contains("sb-show-main"));
      await page.waitForFunction((id) => {
        const preview = (window as unknown as {
          __STORYBOOK_PREVIEW__?: { storyRenders?: { id: string; phase?: string }[] };
        }).__STORYBOOK_PREVIEW__;
        const render = preview?.storyRenders?.find((candidate) => candidate.id === id);
        return render?.phase === "finished";
      }, storyId);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
        .toBe(theme);

      const target = page.locator(captureSelector(storyId));
      await expect(target).toBeVisible();
      await expect(target).toHaveScreenshot(`${storyId}-${theme}.png`);

      // The undecided findings do not depend on the palette — they are about
      // which properties axe can read, not their values — so one theme's pass
      // is enough and the run stays at one axe execution per story.
      if (theme !== "light") return;
      await page.addScriptTag({ content: axeSource });
      const incomplete: IncompleteNode[] = await page.evaluate(async (disabled) => {
        const axe = (window as unknown as {
          axe: {
            run: (
              context: Document,
              options: { resultTypes: string[]; rules?: Record<string, { enabled: boolean }> },
            ) => Promise<{
              incomplete: {
                id: string;
                nodes: {
                  target: string[];
                  html: string;
                  any?: { data?: { messageKey?: string } }[];
                  none?: { data?: { messageKey?: string } }[];
                  all?: { data?: { messageKey?: string } }[];
                }[];
              }[];
            }>;
          };
        }).axe;
        const results = await axe.run(document, {
          resultTypes: ["incomplete"],
          rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
        });
        return results.incomplete.flatMap((entry) =>
          entry.nodes.map((node) => ({
            rule: entry.id,
            target: node.target.join(" "),
            html: node.html,
            reason:
              (node.any?.[0] ?? node.none?.[0] ?? node.all?.[0])?.data?.messageKey ?? "",
          })),
        );
      }, disabledRules);

      const unexpected = incomplete.filter((node) => !isAllowedIncomplete(node));
      expect(
        unexpected,
        `unexpected axe incomplete in ${storyId}: ${unexpected
          .map((node) => `${node.rule} @ ${node.target} (${node.reason})`)
          .join("; ")}`,
      ).toEqual([]);
    });
  }
}
