/**
 * @file seed.tsx
 * @brief Story-facing helper that fixes the storage contents a story renders from.
 * @details The options components read chrome.storage in a mount effect, so the
 *          seed must land before the component mounts. A decorator's body runs
 *          during render, ahead of the child's effects, which satisfies that
 *          ordering.
 */

import type { ReactElement } from 'react';
import { resetBrowserLanguages, resetStorage } from './chromemock';

/**
 * @fn seededStory
 * @brief Build a decorator that resets the mock to `seed` before each render.
 * @details The browser languages are reset alongside storage because they are
 *          the mock's other piece of global state: a story that seeds them
 *          would otherwise decide what the next story reads.
 * @param seed - The storage contents the story starts from
 * @return A Storybook decorator
 */
export function seededStory(seed: Record<string, unknown> = {}) {
  return function SeededDecorator(Story: () => ReactElement) {
    resetStorage(seed);
    resetBrowserLanguages();
    return <Story />;
  };
}
