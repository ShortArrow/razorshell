import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { seededStory } from '../../.storybook/seed';
import { ConfigApp } from './config';

const meta: Meta<typeof ConfigApp> = {
  title: 'Options/ConfigApp',
  component: ConfigApp,
};

export default meta;

type Story = StoryObj<typeof ConfigApp>;

export const Default: Story = {
  decorators: [seededStory({})],
};

export const ImportError: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByTestId('config-text');
    await userEvent.type(textarea, '{{ not json');
    await userEvent.click(canvas.getByTestId('config-apply'));
    await expect(canvas.getByTestId('config-result')).not.toBeEmptyDOMElement();
  },
};
