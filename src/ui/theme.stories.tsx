import type { Meta, StoryObj } from '@storybook/react-vite';
import { seededStory } from '../../.storybook/seed';
import { ThemeApp } from './theme';

const meta: Meta<typeof ThemeApp> = {
  title: 'Options/ThemeApp',
  component: ThemeApp,
};

export default meta;

type Story = StoryObj<typeof ThemeApp>;

export const Default: Story = {
  decorators: [seededStory({ theme: 'light' })],
};
