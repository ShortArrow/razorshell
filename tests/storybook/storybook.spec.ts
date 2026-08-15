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
 */
import { test, expect } from "@playwright/test";
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
    });
  }
}
