import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { openedTabs } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { ReclaimedApp } from './reclaimed';

const meta: Meta<typeof ReclaimedApp> = {
  title: 'Options/ReclaimedApp',
  component: ReclaimedApp,
};

export default meta;

type Story = StoryObj<typeof ReclaimedApp>;

export const Default: Story = {
  decorators: [seededStory({})],
};

/**
 * The button's whole job is to open a URL a page may not link to. The mock
 * records the request rather than following it, which is as far as a story can
 * observe a `chrome://` navigation.
 */
export const OpensShortcutsPage: Story = {
  tags: ['@C1.18'],
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('open-shortcuts');

    await userEvent.click(button);

    await waitFor(() => expect(openedTabs()).toEqual([{ url: 'chrome://extensions/shortcuts' }]));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
