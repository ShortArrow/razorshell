import type { Meta, StoryObj } from '@storybook/react-vite';
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
