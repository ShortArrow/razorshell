import confetti from "canvas-confetti";

/**
 * Fires one burst of confetti over the page. The cannon draws on the main
 * thread: the default one builds a Worker from a blob: URL, which the
 * extension-page CSP refuses. A user who asks for reduced motion gets none.
 */
export function fireConfetti(): void {
  const cannon = confetti.create(undefined, { useWorker: false, resize: true, disableForReducedMotion: true });
  void cannon({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
}
