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

export const ResetRestoresGiven: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByTestId<HTMLInputElement>('tutorial-field');

    await userEvent.click(field);
    await userEvent.keyboard('xyz');
    await expect(field.value).not.toBe('hello world');
    await userEvent.click(canvas.getByTestId('tutorial-reset'));

    await expect(field.value).toBe('hello world');
    await expect([field.selectionStart, field.selectionEnd]).toEqual([11, 11]);
    await expect(canvas.getByTestId('tutorial-step')).toHaveTextContent('move cursor to the beginning');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const AllStepsDone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId('tutorial-field'));
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Control>}e{/Control}');
    await userEvent.keyboard('{Alt>}b{/Alt}');
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('{Control>}y{/Control}');

    await expect(canvas.getByTestId('tutorial-done')).toHaveTextContent('Done. Every step passed.');
    await expect(canvas.queryByTestId('tutorial-field')).toBeNull();
    await expect(canvas.queryByTestId('tutorial-step')).toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
