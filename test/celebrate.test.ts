/**
 * The tutorial's celebration: confetti fired without a Worker, since the
 * extension-page CSP admits no blob: script, and not at all for a user who
 * asks for less motion.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const { cannon, create } = vi.hoisted(() => {
  const cannon = vi.fn();
  return { cannon, create: vi.fn(() => cannon) };
});

vi.mock("canvas-confetti", () => ({ default: { create } }));

import { fireConfetti } from "../src/ui/celebrate";

describe("fireConfetti", () => {
  beforeEach(() => {
    cannon.mockClear();
    create.mockClear();
  });

  test("builds its cannon with the Worker off and reduced motion honoured", () => {
    fireConfetti();
    expect(create).toHaveBeenCalledWith(undefined, expect.objectContaining({
      useWorker: false,
      disableForReducedMotion: true,
    }));
  });

  test("fires the cannon once per call", () => {
    fireConfetti();
    expect(cannon).toHaveBeenCalledTimes(1);
  });
});
