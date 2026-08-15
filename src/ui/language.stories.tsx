import type { Meta, StoryObj } from '@storybook/react-vite';
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
