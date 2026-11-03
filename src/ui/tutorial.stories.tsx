import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { defaultKeymap } from '../keymap';
import { TutorialApp } from './tutorial';

const meta: Meta<typeof TutorialApp> = {
  title: 'Tutorial/TutorialApp',
  component: TutorialApp,
  args: { keymap: defaultKeymap },
};

export default meta;

type Story = StoryObj<typeof TutorialApp>;

export const FirstStep: Story = {};

export const CtrlAAdvances: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('tutorial-step')).toHaveTextContent('move cursor to the beginning');
    await userEvent.click(canvas.getByTestId('tutorial-field'));
    await userEvent.keyboard('{Control>}a{/Control}');

    const step = canvas.getByTestId('tutorial-step');
    await expect(step).toHaveTextContent('move cursor to the end');
    await expect(step).toHaveTextContent('Ctrl');
    await expect(within(step).getByText('e')).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
