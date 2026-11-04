/** How many pieces one burst lays over the page. */
export const CONFETTI_PIECES = 80;

const FLIGHT_MS = 2800;
const MAX_DELAY_MS = 300;

/** How long a burst stays in the page: the latest piece's delay and flight. */
export const CONFETTI_MS = FLIGHT_MS + MAX_DELAY_MS;

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function piece(): HTMLElement {
  const carrier = document.createElement("span");
  carrier.className = "confetti-piece";
  const paper = document.createElement("span");
  paper.className = "confetti-paper";
  paper.style.background = `hsl(${Math.floor(between(0, 360))} 85% 60%)`;
  const delay = `${between(0, MAX_DELAY_MS)}ms`;
  for (const element of [carrier, paper]) {
    element.style.animationDuration = `${FLIGHT_MS}ms`;
    element.style.animationDelay = delay;
  }
  carrier.style.setProperty("--drift", `${between(-62.5, 62.5)}vw`);
  paper.style.setProperty("--peak", `${between(65, 85)}vh`);
  paper.style.setProperty("--turn", `${between(-2, 2) * 720}deg`);
  carrier.append(paper);
  return carrier;
}

/**
 * Lays one burst of confetti over the page and takes it away once every
 * piece has landed: each is thrown up from the bottom centre, rises to most
 * of the viewport's height and falls back out of it. The burst ignores the
 * pointer and is hidden from screen readers. A user who asks for reduced
 * motion gets none.
 */
export function fireConfetti(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const burst = document.createElement("div");
  burst.className = "confetti";
  burst.dataset.testid = "confetti";
  burst.setAttribute("aria-hidden", "true");
  burst.append(...Array.from({ length: CONFETTI_PIECES }, piece));
  document.body.append(burst);
  setTimeout(() => burst.remove(), CONFETTI_MS);
}
