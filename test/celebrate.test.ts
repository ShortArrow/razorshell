/**
 * The tutorial's celebration: one burst of confetti laid over the page and
 * taken away once it has fallen, and none for a user who asks for less motion.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CONFETTI_PIECES, CONFETTI_MS, fireConfetti, peakEllipse } from "../src/ui/celebrate";

function prefersReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
  }));
}

function bursts(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>("[data-testid=confetti]");
}

describe("fireConfetti", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  test("lays one burst of pieces over the page, out of the way of the pointer and screen readers", () => {
    prefersReducedMotion(false);
    fireConfetti();

    const burst = bursts();
    expect(burst).toHaveLength(1);
    expect(burst[0].getAttribute("aria-hidden")).toBe("true");
    expect(burst[0].classList.contains("confetti")).toBe(true);
    expect(burst[0].children).toHaveLength(CONFETTI_PIECES);
  });

  test("takes the burst away once it has fallen", () => {
    prefersReducedMotion(false);
    fireConfetti();

    vi.advanceTimersByTime(CONFETTI_MS - 1);
    expect(bursts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(bursts()).toHaveLength(0);
  });

  test("lays nothing for a user who asks for reduced motion", () => {
    prefersReducedMotion(true);
    fireConfetti();

    expect(bursts()).toHaveLength(0);
  });
});

describe("peakEllipse", () => {
  const golden = (1 + Math.sqrt(5)) / 2;

  test("is a golden ellipse covering about a golden share of a 16:9 screen", () => {
    const { across, up } = peakEllipse(1920, 1080);
    expect(across / up).toBeCloseTo(golden, 2);
    expect((Math.PI * across * up) / (1920 * 1080)).toBeCloseTo(1 / golden, 2);
  });

  test("keeps its height inside an ultrawide screen", () => {
    const { up } = peakEllipse(3440, 1080);
    expect(2 * up).toBeLessThanOrEqual(1080);
  });
});
