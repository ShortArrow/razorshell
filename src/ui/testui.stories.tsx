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

export const PassThrough: Story = {
  decorators: [seededStory()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('test-input'));
    await userEvent.keyboard('x');

    // An unbound key has to reach the field untouched. The test area is where
    // someone checks that the extension is not eating ordinary typing, so the
    // panel has to say so rather than only staying silent.
    const status = canvas.getByTestId('last-status');
    await expect(status).toHaveTextContent('pass-through');
    await expect(within(status).getByText('x')).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
