import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { failNextSet, storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { ThemeApp } from './theme';

/**
 * Answer the dark-scheme query as a dark-preferring browser would, for the
 * story that has no stored theme and therefore falls back to the browser.
 * Only the one query the component asks is answered; anything else keeps the
 * real implementation, so the stub cannot quietly change unrelated layout.
 */
function darkPreferringStory(Story: () => ReactElement) {
  const real = window.matchMedia.bind(window);
  window.matchMedia = ((query: string) =>
    query.includes('prefers-color-scheme: dark')
      ? { ...real(query), matches: true }
      : real(query)) as typeof window.matchMedia;
  return <Story />;
}

const meta: Meta<typeof ThemeApp> = {
  title: 'Options/ThemeApp',
  component: ThemeApp,
};

export default meta;

type Story = StoryObj<typeof ThemeApp>;

export const Default: Story = {
  decorators: [seededStory({ theme: 'light' })],
};

/**
 * Record every value written to `documentElement.dataset.theme` while the
 * story renders.
 *
 * The preview decorator reasserts the toolbar's theme global on a later turn
 * so that one story cannot repaint the page for the next, which means the
 * resting value of the attribute belongs to the toolbar rather than to
 * ThemeApp. Watching the writes is what still shows the component painting
 * what it read from storage, without the story having to pin the global and
 * lose the two-theme screenshot pass.
 */
const painted: string[] = [];

function paintedThemes(Story: () => ReactElement) {
  const root = document.documentElement;
  painted.length = 0;
  const observer = new MutationObserver(() => {
    const value = root.dataset.theme;
    if (value !== undefined) painted.push(value);
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  setTimeout(() => observer.disconnect(), 2000);
  return <Story />;
}

export const DarkStored: Story = {
  decorators: [paintedThemes, seededStory({ theme: 'dark' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The toggle is checked for light, so a stored dark theme leaves it clear.
    await waitFor(() => expect(canvas.getByTestId('theme-toggle')).not.toBeChecked());
    // The stored theme is not a label the toggle carries; it is what the page
    // gets painted with, which is the attribute daisyUI reads.
    await waitFor(() => expect(painted).toContain('dark'));
  },
};

export const SystemDefault: Story = {
  decorators: [seededStory({}), darkPreferringStory],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing stored, so the browser's preference decides, and this browser
    // prefers dark — the toggle has to follow it rather than assuming light.
    await waitFor(() => expect(canvas.getByTestId('theme-toggle')).not.toBeChecked());
  },
};

export const SaveFailure: Story = {
  decorators: [paintedThemes, seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByTestId('theme-toggle') as HTMLInputElement;

    // ThemeApp's own theme is what the toggle is checked against, and with
    // nothing stored it comes from the browser preference. The document
    // attribute cannot stand in for it here: the preview decorator repaints
    // the toolbar global over ThemeApp's paint so that one story cannot
    // recolour the next, and that repaint can be the one left standing.
    await waitFor(() => expect(painted.length).toBeGreaterThan(0));
    const before = toggle.checked ? 'light' : 'dark';
    failNextSet('sync write refused');
    await userEvent.click(toggle);

    await waitFor(() => expect(canvas.getByTestId('theme-save-error'))
      .toHaveTextContent('sync write refused'));
    // The page was repainted before storage had accepted the theme. Storage
    // refused, so both the toggle and the paint have to come back rather than
    // showing a theme the next load of the options page will not reproduce.
    await waitFor(() => expect(toggle.checked).toBe(before === 'light'));
    await expect(painted[painted.length - 1]).toBe(before);
    await expect(storedValue<string>('theme')).toBeUndefined();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
