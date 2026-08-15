import type { Meta, StoryObj } from '@storybook/react-vite';
import { seededStory } from '../../.storybook/seed';
import { TestApp } from './testui';

const meta: Meta<typeof TestApp> = {
  title: 'Options/TestApp',
  component: TestApp,
};

export default meta;

type Story = StoryObj<typeof TestApp>;

export const Default: Story = {
  decorators: [seededStory()],
};
