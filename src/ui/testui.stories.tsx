import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
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

export const CtrlAHandled: Story = {
  decorators: [seededStory()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('test-input'));
    await userEvent.keyboard('{Control>}a{/Control}');

    const status = canvas.getByTestId('last-status');
    await expect(status).toHaveTextContent('Ctrl');
    await expect(status).toHaveTextContent('handled');
    // Ctrl+a is the readline beginning-of-line, so the caret collapses to the
    // start rather than selecting the field the way the browser default would.
    await expect(canvas.getByTestId('test-input-selection')).toHaveTextContent('start=0 end=0');
  },
};
