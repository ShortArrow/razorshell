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
 * Both passes spend an axe run on the story's `violations`, because the ones
 * that matter here are `color-contrast`, and contrast is exactly the finding a
 * single theme cannot speak for: the two daisyUI palettes put different
 * foregrounds on different backgrounds, and a dimmed row that clears 4.5:1
 * against white can sit at 4.2:1 against the dark base. The budget is zero.
 *
 * The light pass additionally reads that run's `incomplete` results — the
 * findings axe could not decide, which the a11y addon shows but never fails
 * on, so they accumulate unnoticed. The budget is zero: an undecided result
 * means axe could not read the page, and the two daisyUI paint tricks that
 * used to make that unavoidable (a gradient select arrow, an always-present
 * tooltip pseudo element) are removed in `src/css/options.css`. Unlike
 * contrast, an undecided result is about which properties axe can read rather
 * than their values, so one theme's pass covers both and the run stays at one
 * axe execution per story per theme.
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

/**
 * One id per visually distinct end state. Stories whose end state repeats a
 * captured one are left out — `ReorderRule` ends as the same rule table as
 * `WithRules`, config's `SaveFailure` renders the same error line as
 * `ImportError`, and `ConflictThenRecover` ends as an override row like
 * `WithOverride` — because a second screenshot of the same rendering doubles
 * the baseline maintenance without widening what a regression can hit.
 */
const storyIds = [
  "options-configapp--default",
  "options-configapp--import-error",
  "options-configapp--applied-badge",
  "options-configapp--choose-file",
  "options-keymapapp--default",
  "options-keymapapp--with-override",
  "options-keymapapp--two-modifier-override",
  "options-langapp--auto",
  "options-langapp--overridden",
  "options-langapp--no-browser-languages",
  "options-richtextapp--off",
  "options-richtextapp--on",
  "options-testapp--default",
  "options-testapp--pass-through",
  "options-themeapp--default",
  "options-themeapp--dark-stored",
  "options-urlapp--empty",
  "options-urlapp--with-rules",
  "options-urlapp--probe-match",
  "options-urlapp--probe-default",
  "options-urlapp--invalid-pattern",
  "options-urlapp--save-failure",
  "options-urlapp--empty-pattern",
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
 * directly, so the same reasoning has to be restated here.
 *
 * All four judge a document as a whole page, and a story is not one: it is a
 * single component mounted into a bare `iframe.html` with no surrounding
 * document for it to be a part of. `bypass` asks for a skip link past the
 * navigation; `landmark-one-main` asks for a `<main>`; `region` asks that
 * every node sit inside some landmark; `page-has-heading-one` asks for an
 * `<h1>`, where these components deliberately start at `<h2>` because the
 * options page that hosts them owns the `<h1>`. Satisfying any of them inside
 * a story would mean shipping page furniture in a component, so they are
 * inapplicable here rather than failing — the real options page is where they
 * are worth asking, and `tests/e2e` is what renders it.
 */
const disabledRules = ["bypass", "landmark-one-main", "page-has-heading-one", "region"];

type AxeNode = { rule: string; target: string; html: string; reason: string };

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

      // A story's `play` function leaves focus on whatever it last drove, and
      // Testing Library's synthetic events make Chromium treat that focus as
      // keyboard-originated, so `:focus-visible` matches and daisyUI shows the
      // tooltip wrapping the control. A shown tooltip is correct behaviour —
      // a real mouse click leaves it hidden — but axe compares the bubble's
      // raw area against the wrapper's without noticing that it is positioned
      // clear of it, and reports `pseudoContent` for a bubble that overlaps
      // nothing. The budget is about the resting page, which is also what the
      // screenshot above already captured, so focus is dropped first.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.addScriptTag({ content: axeSource });
      const findings: { violations: AxeNode[]; incomplete: AxeNode[] } = await page.evaluate(
        async (disabled) => {
          type ResultNode = {
            target: string[];
            html: string;
            any?: { data?: { messageKey?: string; contrastRatio?: number } }[];
            none?: { data?: { messageKey?: string; contrastRatio?: number } }[];
            all?: { data?: { messageKey?: string; contrastRatio?: number } }[];
          };
          type ResultEntry = { id: string; nodes: ResultNode[] };
          const axe = (window as unknown as {
            axe: {
              run: (
                context: Document,
                options: { resultTypes: string[]; rules?: Record<string, { enabled: boolean }> },
              ) => Promise<{ violations: ResultEntry[]; incomplete: ResultEntry[] }>;
            };
          }).axe;
          const results = await axe.run(document, {
            resultTypes: ["violations", "incomplete"],
            rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
          });
          const shape = (entries: ResultEntry[]) =>
            entries.flatMap((entry) =>
              entry.nodes.map((node) => {
                const data = (node.any?.[0] ?? node.none?.[0] ?? node.all?.[0])?.data;
                return {
                  rule: entry.id,
                  target: node.target.join(" "),
                  html: node.html,
                  // Contrast failures carry a ratio rather than a message key,
                  // and the measured value is the whole diagnosis.
                  reason:
                    data?.messageKey ??
                    (data?.contrastRatio === undefined ? "" : `${data.contrastRatio}:1`),
                };
              }),
            );
          return { violations: shape(results.violations), incomplete: shape(results.incomplete) };
        },
        disabledRules,
      );

      const describe = (nodes: AxeNode[]) =>
        nodes.map((node) => `${node.rule} @ ${node.target} (${node.reason})`).join("; ");

      expect(
        findings.violations,
        `unexpected axe violations in ${storyId} (${theme}): ${describe(findings.violations)}`,
      ).toEqual([]);

      // Undecided findings are about which properties axe can read rather than
      // their values, so the light pass speaks for both themes.
      if (theme !== "light") return;

      expect(
        findings.incomplete,
        `unexpected axe incomplete in ${storyId}: ${describe(findings.incomplete)}`,
      ).toEqual([]);
    });
  }
}
