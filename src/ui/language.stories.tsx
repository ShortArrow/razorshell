import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { ReactElement } from 'react';
import { seedBrowserLanguages, storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { LangApp } from './language';

/**
 * Render with chrome.i18n reporting no browser languages at all.
 *
 * The seeding is global to the mock, so the reset that keeps it from reaching
 * the next story lives in `seededStory` alongside the storage reset, and this
 * decorator runs after it.
 */
function withoutBrowserLanguages(Story: () => ReactElement) {
  seedBrowserLanguages({ ui: '', accept: [] });
  return <Story />;
}

const meta: Meta<typeof LangApp> = {
  title: 'Options/LangApp',
  component: LangApp,
};

export default meta;

type Story = StoryObj<typeof LangApp>;

export const Auto: Story = {
  decorators: [seededStory({ language: 'auto' })],
};

export const Overridden: Story = {
  decorators: [seededStory({ language: 'ja' })],
};

export const SwitchLanguage: Story = {
  decorators: [seededStory({ language: 'auto' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(await canvas.findByTestId('language-select'), 'ja');

    // The badge is the rendered half; the setting only survives a reload of
    // the options page once it has reached storage.
    await waitFor(() => expect(storedValue<string>('language')).toBe('ja'));
    await expect(canvas.getByTestId('effective-language')).toHaveTextContent('ja');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const NoBrowserLanguages: Story = {
  // The seeding decorator has to be the inner one, because `seededStory`
  // resets the browser languages that this story then replaces.
  decorators: [withoutBrowserLanguages, seededStory({ language: 'auto' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A browser that reports no accept-languages leaves the badge row with
    // nothing to list. The row still has to lay out, which the screenshot is
    // what actually judges; the count is what keeps the story honest about
    // rendering the empty case rather than a populated one.
    await waitFor(() => expect(canvas.getByTestId('effective-language')).toHaveTextContent('auto'));
    await expect(canvas.getAllByText('accept:')).toHaveLength(1);
    await expect(canvas.queryByText('en-US')).not.toBeInTheDocument();
  },
};
