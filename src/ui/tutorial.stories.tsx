import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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

async function passEveryStep(canvas: ReturnType<typeof within>): Promise<void> {
  await userEvent.click(canvas.getByTestId('tutorial-field'));
  await userEvent.keyboard('{Control>}a{/Control}');
  await userEvent.keyboard('{Control>}e{/Control}');
  await userEvent.keyboard('{Alt>}b{/Alt}');
  await userEvent.keyboard('{Control>}k{/Control}');
  await userEvent.keyboard('{Control>}y{/Control}');
}

export const AllStepsDone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await passEveryStep(canvas);

    await expect(canvas.getByTestId('tutorial-done')).toHaveTextContent('Done. Every step passed.');
    await expect(canvas.getByTestId('tutorial-done-check')).toBeVisible();
    const field = canvas.getByTestId<HTMLInputElement>('tutorial-field');
    await expect(field.value).toBe('hello world');
    await expect(field.readOnly).toBe(true);
    await expect(canvas.queryByTestId('tutorial-step')).toBeNull();
    await expect(canvas.queryByTestId('tutorial-reset')).toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const CelebratesOnceWhenDone: Story = {
  args: { celebrate: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(args.celebrate).not.toHaveBeenCalled();
    await passEveryStep(canvas);

    await expect(args.celebrate).toHaveBeenCalledTimes(1);
    (document.activeElement as HTMLElement | null)?.blur();
  },
};