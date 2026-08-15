import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { LangApp } from './language';

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
  },
};
