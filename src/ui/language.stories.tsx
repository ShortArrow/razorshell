import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { ReactElement } from 'react';
import { failNextSet, seedBrowserLanguages, storedValue } from '../../.storybook/chromemock';
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

export const SaveFailure: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = await canvas.findByTestId('effective-language');

    // Nothing is stored, so the badge is showing the browser fallback; that is
    // the value the refused change has to leave standing.
    await waitFor(() => expect(badge).toHaveTextContent('auto'));
    const before = badge.textContent;
    failNextSet('sync write refused');
    await userEvent.selectOptions(canvas.getByTestId('language-select'), 'ja');

    await waitFor(() => expect(canvas.getByTestId('language-save-error'))
      .toHaveTextContent('sync write refused'));
    // The badge names the language the options page will come back up in. A
    // refused write leaves that language unchanged, so a badge reading ja
    // would be a promise storage did not make.
    await waitFor(() => expect(badge).toHaveTextContent(before ?? ''));
    await expect(badge).not.toHaveTextContent('ja');
    await expect(storedValue<string>('language')).toBeUndefined();
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
