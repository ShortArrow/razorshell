/**
 * @file toast.stories.tsx
 * @brief Stories for the inspector toast, the one piece of UI the extension
 *        injects imperatively into a host page.
 * @details `showToast` writes into `document.body` rather than returning an
 *          element, so a story cannot render it as a child. The wrapper below
 *          calls it from a mount effect and tears the node down on unmount,
 *          which keeps a story switch from leaving the previous toast behind.
 *          The toast lives outside `#storybook-root`, so the spec screenshots
 *          the toast element by id instead of the story root.
 */
import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { showToast } from '../inspecttoast';

type ToastProps = {
  title: string;
  lines: string[];
};

/**
 * @fn InjectedToast
 * @brief Render nothing, and show the injected toast for as long as the story
 *        is mounted.
 * @param ToastProps props - The toast heading and body lines
 * @return An empty placeholder element
 */
function InjectedToast({ title, lines }: ToastProps) {
  useEffect(() => {
    showToast(title, lines);
    return () => document.getElementById('razorshell-inspect-toast')?.remove();
  }, [title, lines]);
  return <div data-testid='toast-anchor' />;
}

const meta: Meta<typeof InjectedToast> = {
  title: 'Inspect/Toast',
  component: InjectedToast,
};

export default meta;

type Story = StoryObj<typeof InjectedToast>;

export const Conflicts: Story = {
  args: {
    title: 'Shortcuts this page already handles',
    lines: [
      'Ctrl+k — delete to the end of the line',
      'Alt+b — move cursor back one word',
      'Ctrl+u — delete to the beginning of the line',
    ],
  },
};

export const NoConflicts: Story = {
  args: {
    title: 'Shortcuts this page already handles',
    lines: [],
  },
};
