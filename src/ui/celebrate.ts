/** How many pieces one burst lays over the page. */
export const CONFETTI_PIECES = 80;

const FLIGHT_MS = 2800;
const MAX_DELAY_MS = 100;
const GOLDEN = (1 + Math.sqrt(5)) / 2;

/** How long a burst stays in the page: the latest piece's delay and flight. */
export const CONFETTI_MS = FLIGHT_MS + MAX_DELAY_MS;

/**
 * The ellipse the burst fills at its peak, centred on the screen: its
 * semi-axes, in pixels, are in the golden ratio, and it covers a golden share
 * (1/φ) of the screen, unless that would run past the top and bottom, where
 * it is cut down to 96% of the height.
 */
export function peakEllipse(width: number, height: number): { across: number; up: number } {
  const up = Math.min(Math.sqrt((width * height) / (GOLDEN * GOLDEN * Math.PI)), 0.48 * height);
  return { across: GOLDEN * up, up };
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function piece(ellipse: { across: number; up: number }): HTMLElement {
  const carrier = document.createElement("span");
  carrier.className = "confetti-piece";
  const paper = document.createElement("span");
  paper.className = "confetti-paper";
  const depth = between(0.5, 1.5);
  paper.style.background = `hsl(${Math.floor(between(0, 360))} ${35 + (depth - 0.5) * 50}% 60%)`;
  const delay = `${between(0, MAX_DELAY_MS)}ms`;
  for (const element of [carrier, paper]) {
    element.style.animationDuration = `${FLIGHT_MS}ms`;
    element.style.animationDelay = delay;
  }
  const reach = Math.sqrt(Math.random());
  const angle = between(0, 2 * Math.PI);
  carrier.style.setProperty("--drift", `${ellipse.across * reach * Math.cos(angle)}px`);
  paper.style.setProperty("--peak", `${window.innerHeight / 2 + ellipse.up * reach * Math.sin(angle)}px`);
  paper.style.setProperty("--turn", `${between(-2, 2) * 720}deg`);
  paper.style.setProperty("--depth", `${depth}`);
  carrier.style.zIndex = `${Math.round(depth * 100)}`;
  carrier.append(paper);
  return carrier;
}

/**
 * Lays one burst of confetti over the page and takes it away once every
 * piece has landed: each is thrown up from the bottom centre to a point of
 * `peakEllipse`, spread evenly over it, and falls back out of the viewport.
 * The burst ignores the pointer and is hidden from screen readers. A user
 * who asks for reduced motion gets none.
 */
export function fireConfetti(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ellipse = peakEllipse(window.innerWidth, window.innerHeight);
  const burst = document.createElement("div");
  burst.className = "confetti";
  burst.dataset.testid = "confetti";
  burst.setAttribute("aria-hidden", "true");
  burst.append(...Array.from({ length: CONFETTI_PIECES }, () => piece(ellipse)));
  document.body.append(burst);
  setTimeout(() => burst.remove(), CONFETTI_MS);
}
