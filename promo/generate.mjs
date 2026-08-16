/**
 * Generates the Chrome Web Store assets and the README demo media.
 *
 * Everything renders through Playwright so the output is reproducible from
 * the repository alone: promo tiles from inline HTML, store screenshots from
 * the real extension loaded unpacked, the README GIF from captured frames
 * assembled with gifenc, and a webm recording suitable for a YouTube upload.
 * Store images are JPEG because the store forbids alpha and JPEG cannot
 * carry one.
 *
 * Usage: node promo/generate.mjs [tiles|shots|video|all]
 * Screenshots and video need `pnpm build` to have produced dist/ first.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(here, "store");
const mascotSvg = fs.readFileSync(path.join(root, "image", "razorshell.svg"), "utf8");
const mascot = `data:image/svg+xml;base64,${Buffer.from(mascotSvg).toString("base64")}`;

const jpeg = { type: "jpeg", quality: 95 };

const baseStyle = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    background: linear-gradient(135deg, #191026 0%, #2b1a4e 55%, #3a1f66 100%);
    color: #ffffff;
    overflow: hidden;
    width: 100vw; height: 100vh;
    display: flex; flex-direction: column;
  }
  .title { font-weight: 700; letter-spacing: 0.01em; }
  .tagline { color: #cdbfff; font-weight: 400; }
  .chips { display: flex; gap: 14px; }
  .chip {
    font-family: Consolas, monospace;
    background: #241640;
    border: 1px solid #7a5cff;
    border-bottom-width: 3px;
    border-radius: 8px;
    color: #e8e1ff;
    text-align: center;
  }
  .mascot { display: block; }
`;

function marqueeHtml() {
  return `<!doctype html><html><head><style>${baseStyle}
    body { padding: 56px 72px 0; }
    .title { font-size: 84px; line-height: 1; }
    .tagline { font-size: 32px; margin-top: 18px; }
    .chips { margin-top: 30px; }
    .chip { font-size: 24px; padding: 8px 18px; }
    .mascot { width: 1180px; margin: 38px auto 0; }
  </style></head><body>
    <div class="title">Razorshell</div>
    <div class="tagline">Bash keybindings in every text box on the web.</div>
    <div class="chips">
      <span class="chip">Ctrl+A</span><span class="chip">Ctrl+E</span>
      <span class="chip">Ctrl+K</span><span class="chip">Ctrl+U</span>
      <span class="chip">Alt+F</span><span class="chip">Alt+B</span>
    </div>
    <img class="mascot" src="${mascot}">
  </body></html>`;
}

function smallTileHtml() {
  return `<!doctype html><html><head><style>${baseStyle}
    body { padding: 28px 24px 0; align-items: center; }
    .title { font-size: 44px; line-height: 1; }
    .tagline { font-size: 17px; margin-top: 8px; }
    .mascot { width: 404px; margin-top: 26px; }
  </style></head><body>
    <div class="title">Razorshell</div>
    <div class="tagline">Bash keybindings in every text box.</div>
    <img class="mascot" src="${mascot}">
  </body></html>`;
}

async function renderTiles(browser) {
  const specs = [
    { name: "tile-marquee-1400x560.jpg", width: 1400, height: 560, html: marqueeHtml() },
    { name: "tile-small-440x280.jpg", width: 440, height: 280, html: smallTileHtml() },
  ];
  for (const spec of specs) {
    const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
    await page.setContent(spec.html, { waitUntil: "networkidle" });
    await page.screenshot({ ...jpeg, path: path.join(outDir, spec.name) });
    await page.close();
    console.log(`wrote ${spec.name}`);
  }
}

const captionBar = 72;

/** Wraps a captured UI image with the branded caption band, at store size. */
function framedHtml(shotDataUri, caption) {
  return `<!doctype html><html><head><style>${baseStyle}
    body { background: linear-gradient(90deg, #191026, #2b1a4e); }
    .bar { height: ${captionBar}px; display: flex; align-items: center; gap: 18px; padding: 0 24px; }
    .bar img { height: 40px; }
    .bar span { font-size: 26px; font-weight: 600; }
    .shot { display: block; width: 1280px; }
  </style></head><body>
    <div class="bar"><img src="${mascot}"><span>${caption}</span></div>
    <img class="shot" src="${shotDataUri}">
  </body></html>`;
}

async function frameShot(browser, rawBuffer, caption, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const uri = `data:image/png;base64,${rawBuffer.toString("base64")}`;
  await page.setContent(framedHtml(uri, caption), { waitUntil: "networkidle" });
  await page.screenshot({ ...jpeg, path: path.join(outDir, name) });
  await page.close();
  console.log(`wrote ${name}`);
}

async function launchExtension() {
  const distPath = path.join(root, "dist");
  if (!fs.existsSync(path.join(distPath, "manifest.json"))) {
    throw new Error("No dist/. Run `pnpm build` first.");
  }
  const userDataDir = path.join(root, "test-results", "promo-user-data");
  fs.rmSync(userDataDir, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 - captionBar },
    args: [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`],
  });
  const http = await import("node:http");
  const testTarget = fs.readFileSync(path.join(root, "testtarget.html"));
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(testTarget);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await context.newPage();
  await page.goto(origin);
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  return { context, server, origin, page, extensionId };
}

async function seed(optionsPage, values) {
  await optionsPage.evaluate((data) => chrome.storage.sync.set(data), values);
}

async function renderShots(browser) {
  const ext = await launchExtension();
  const { context, extensionId } = ext;
  const options = await context.newPage();
  const optionsUrl = `chrome-extension://${extensionId}/options.html`;
  await options.goto(optionsUrl);
  await options.waitForTimeout(800);

  const shoot = () => options.screenshot({ type: "png" });
  const scrollTo = async (text) => {
    await options.getByRole("heading", { name: text }).evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -24);
    });
    await options.waitForTimeout(200);
  };

  // 1. The keymap table with the default bindings, light theme.
  await scrollTo("Keymap");
  await frameShot(browser, await shoot(),
    "Emacs-style editing in every text box — Ctrl+A / E / K / U, Alt+F / B",
    "shot-1-keymap.jpg");

  // 2. Test area right after a handled chord, driven by real key presses.
  await scrollTo("Test Area");
  const input = options.locator('[data-testid="test-input"]');
  await input.click();
  await options.keyboard.press("End");
  await options.keyboard.press("Control+a");
  await options.waitForTimeout(300);
  await scrollTo("Test Area");
  await frameShot(browser, await shoot(),
    "Try every chord live — see what was handled, and where the caret went",
    "shot-2-testarea.jpg");

  // 3. URL rules with a realistic policy and a probe hit.
  await seed(options, {
    urlPolicy: {
      defaultAction: "allow",
      rules: [
        { pattern: "https://docs.google.com/**", matchType: "glob", action: "deny" },
        { pattern: "https://*.overleaf.com/**", matchType: "glob", action: "deny" },
        { pattern: "^https://github\\.com/", matchType: "regex", action: "allow" },
      ],
    },
  });
  await options.reload();
  await options.waitForTimeout(800);
  await scrollTo("URL policy");
  await options.locator('[data-testid="url-probe-input"]').fill("https://docs.google.com/document/d/1");
  await options.locator('[data-testid="url-probe-input"]').blur();
  await options.waitForTimeout(300);
  await frameShot(browser, await shoot(),
    "Allow or deny per URL — first match wins, with a live probe",
    "shot-3-urlrules.jpg");

  // 4. The inspector toast on a page whose handler owns Ctrl+K already.
  await seed(options, { urlPolicy: { defaultAction: "allow", rules: [] } });
  const target = ext.page;
  await target.reload();
  await target.waitForTimeout(600);
  await target.evaluate(() => {
    document.querySelector('input[type="text"]').addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "k") e.preventDefault();
    });
  });
  await options.evaluate(async (base) => {
    const tabs = await chrome.tabs.query({ url: `${base}/*` });
    await chrome.tabs.sendMessage(tabs[0].id, { type: "razorshell-inspect" });
  }, ext.origin);
  await target.waitForTimeout(400);
  await target.locator('input[type="text"]').first().click();
  await target.waitForTimeout(700);
  await frameShot(browser, await target.screenshot({ type: "png" }),
    "Inspect a page's own shortcuts — nothing is ever dispatched",
    "shot-4-inspector.jpg");

  // 5. Dark theme with a rebound chord.
  await seed(options, {
    theme: "dark",
    keymapOverrides: { move_cursor_to_the_beginning: { key: "m", ctrl: true, alt: false, shift: false } },
  });
  await options.reload();
  await options.waitForTimeout(800);
  await scrollTo("Keymap");
  await frameShot(browser, await shoot(),
    "Rebind any chord, in light or dark",
    "shot-5-dark.jpg");

  await context.close();
  ext.server.close();
}

/**
 * The README GIF: the test-area card only, one keyframe per chord with the
 * frame delay carrying the rhythm, assembled with gifenc from RGBA pixels
 * decoded through a canvas page (no ffmpeg dependency).
 */
async function renderGif(browser) {
  const gifenc = await import("gifenc");
  const { GIFEncoder, quantize, applyPalette } = gifenc.default ?? gifenc;
  const ext = await launchExtension();
  const { context, extensionId } = ext;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.waitForTimeout(800);
  await options.getByRole("heading", { name: "Test Area" }).evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -16);
  });

  const card = await options.locator(".card").first().boundingBox();
  const clip = {
    x: card.x - 8, y: card.y - 56, width: card.width + 16, height: card.height + 72,
  };
  const input = options.locator('[data-testid="test-input"]');
  await input.click();
  await options.keyboard.press("End");

  const frames = [];
  const snap = async (delay) => {
    frames.push({ png: await options.screenshot({ type: "png", clip }), delay });
  };
  await snap(900);
  for (const chord of ["Control+a", "Control+e", "Alt+b", "Alt+b", "Control+k", "Control+a", "Control+k"]) {
    await options.keyboard.press(chord);
    await options.waitForTimeout(150);
    await snap(950);
  }
  await options.locator('[data-testid="test-textarea"]').click();
  await options.keyboard.press("Control+e");
  await options.waitForTimeout(150);
  await snap(950);
  await options.keyboard.press("Control+u");
  await options.waitForTimeout(150);
  await snap(1600);
  await context.close();
  ext.server.close();

  const decoder = await browser.newPage();
  const scale = 1;
  const width = Math.round(clip.width * scale);
  const height = Math.round(clip.height * scale);
  const encoder = GIFEncoder();
  for (const frame of frames) {
    const rgba = await decoder.evaluate(async ({ uri, width, height }) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = uri;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      let binary = "";
      for (let i = 0; i < data.length; i += 32768) {
        binary += String.fromCharCode(...data.subarray(i, i + 32768));
      }
      return btoa(binary);
    }, { uri: `data:image/png;base64,${frame.png.toString("base64")}`, width, height });
    const pixels = new Uint8ClampedArray(Buffer.from(rgba, "base64"));
    const palette = quantize(pixels, 256);
    const indexed = applyPalette(pixels, palette);
    encoder.writeFrame(indexed, width, height, { palette, delay: frame.delay });
  }
  encoder.finish();
  await decoder.close();
  const gifPath = path.join(root, "image", "demo.gif");
  fs.writeFileSync(gifPath, Buffer.from(encoder.bytes()));
  console.log(`wrote image/demo.gif (${Math.round(fs.statSync(gifPath).size / 1024)} KB, ${frames.length} frames, ${width}x${height})`);
}

/** The repository demo recording, sized and paced for a README link. */
async function renderWebm() {
  const distPath = path.join(root, "dist");
  const userDataDir = path.join(root, "test-results", "promo-video-data");
  fs.rmSync(userDataDir, { recursive: true, force: true });
  const size = { width: 960, height: 600 };
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    viewport: size,
    recordVideo: { dir: path.join(outDir, "rec"), size },
    args: [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`],
  });
  const boot = await context.newPage();
  await boot.setContent("<title>razorshell</title>");
  const worker = context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 5000 }).catch(() => null));
  const extensionId = worker
    ? new URL(worker.url()).host
    : await (async () => {
        throw new Error("service worker did not start; is dist/ built?");
      })();
  const page = await context.newPage();
  await boot.close();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForTimeout(1500);

  const scrollTo = async (name) => {
    await page.getByRole("heading", { name }).evaluate((el) => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      window.scrollBy({ top: -24, behavior: "smooth" });
    });
    await page.waitForTimeout(900);
  };

  await scrollTo("Test Area");
  await page.locator('[data-testid="test-input"]').click();
  await page.keyboard.press("End");
  for (const chord of ["Control+a", "Control+e", "Alt+b", "Alt+b", "Control+k", "Control+u"]) {
    await page.waitForTimeout(750);
    await page.keyboard.press(chord);
  }
  await page.waitForTimeout(900);
  await scrollTo("URL policy");
  await page.locator('[data-testid="url-probe-input"]').pressSequentially(
    "https://docs.google.com/document/d/1", { delay: 30 });
  await page.waitForTimeout(1100);
  await scrollTo("Keymap");
  await page.locator('[data-testid="rebind-move_cursor_to_the_beginning"]').click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Control+m");
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="keymap-reset-all"]').click();
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();
  const recorded = await video.path();
  const finalPath = path.join(root, "image", "demo.webm");
  fs.copyFileSync(recorded, finalPath);
  fs.rmSync(path.join(outDir, "rec"), { recursive: true, force: true });
  console.log(`wrote image/demo.webm (${Math.round(fs.statSync(finalPath).size / 1024)} KB)`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const mode = process.argv[2] ?? "all";
  const browser = await chromium.launch();
  try {
    if (mode === "tiles" || mode === "all") await renderTiles(browser);
    if (mode === "shots" || mode === "all") await renderShots(browser);
    if (mode === "gif" || mode === "all") await renderGif(browser);
    if (mode === "video" || mode === "all") await renderWebm();
  } finally {
    await browser.close();
  }
}

await main();
