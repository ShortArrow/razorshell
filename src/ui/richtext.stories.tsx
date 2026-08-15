import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storedValue } from '../../.storybook/chromemock';
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
