/**
 * @file seed.tsx
 * @brief Story-facing helper that fixes the storage contents a story renders from.
 * @details The options components read chrome.storage in a mount effect, so the
 *          seed must land before the component mounts. A decorator's body runs
 *          during render, ahead of the child's effects, which satisfies that
 *          ordering.
 */

import type { ReactElement } from 'react';
import { resetStorage } from './chromemock';

/**
 * @fn seededStory
 * @brief Build a decorator that resets storage to `seed` before each render.
 * @param seed - The storage contents the story starts from
 * @return A Storybook decorator
 */
export function seededStory(seed: Record<string, unknown> = {}) {
  return function SeededDecorator(Story: () => ReactElement) {
    resetStorage(seed);
    return <Story />;
  };
}
