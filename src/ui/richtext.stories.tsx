import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { failNextSet, storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { RichTextApp } from './richtext';

const meta: Meta<typeof RichTextApp> = {
  title: 'Options/RichTextApp',
  component: RichTextApp,
};

export default meta;

type Story = StoryObj<typeof RichTextApp>;

export const Off: Story = {
  decorators: [seededStory({ enableContentEditable: false })],
};

export const On: Story = {
  decorators: [seededStory({ enableContentEditable: true })],
};

export const TogglePersists: Story = {
  decorators: [seededStory({ enableContentEditable: false })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByTestId('richtext-toggle');

    await userEvent.click(toggle);

    await expect(toggle).toBeChecked();
    // The component writes through to storage without waiting for it, so the
    // opt-in has to be observed settling rather than read once.
    await waitFor(() => expect(storedValue<boolean>('enableContentEditable')).toBe(true));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const SaveFailure: Story = {
  tags: ['@C1.9'],
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByTestId('richtext-toggle');

    failNextSet('sync write refused');
    await userEvent.click(toggle);

    await waitFor(() => expect(canvas.getByTestId('richtext-save-error'))
      .toHaveTextContent('sync write refused'));
    // A toggle left on after a refused write reads as an opt-in that took
    // effect, while the content script keeps reading the stored off.
    await expect(toggle).not.toBeChecked();
    await expect(storedValue<boolean>('enableContentEditable')).toBeUndefined();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
