/** How many pieces one burst lays over the page. */
export const CONFETTI_PIECES = 60;

const FALL_MS = 2400;
const MAX_DELAY_MS = 400;

/** How long a burst stays in the page: the latest piece's delay and fall. */
export const CONFETTI_MS = FALL_MS + MAX_DELAY_MS;

function piece(): HTMLElement {
  const element = document.createElement("span");
  element.className = "confetti-piece";
  element.style.left = `${Math.random() * 100}%`;
  element.style.background = `hsl(${Math.floor(Math.random() * 360)} 85% 60%)`;
  element.style.animationDuration = `${FALL_MS}ms`;
  element.style.animationDelay = `${Math.random() * MAX_DELAY_MS}ms`;
  element.style.setProperty("--drift", `${(Math.random() - 0.5) * 200}px`);
  element.style.setProperty("--turn", `${(Math.random() - 0.5) * 1440}deg`);
  return element;
}

/**
 * Lays one burst of confetti over the page and takes it away once every
 * piece has fallen. The burst ignores the pointer and is hidden from screen
 * readers. A user who asks for reduced motion gets none.
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
