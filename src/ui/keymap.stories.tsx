import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { resetStorage } from '../../.storybook/chromemock';
import { initKeymap } from '../keymapstore';
import { KeymapApp } from './keymap';
import type { Chord } from '../keymapmerge';

const singleOverride: Record<string, Chord> = {
  move_cursor_to_the_beginning: { key: 'Home', ctrl: false, alt: false, shift: false },
};

async function loadOverrides(overrides: Record<string, Chord>) {
  resetStorage(Object.keys(overrides).length === 0 ? {} : { keymapOverrides: overrides });
  await initKeymap();
  return {};
}

const meta: Meta<typeof KeymapApp> = {
  title: 'Options/KeymapApp',
  component: KeymapApp,
};

export default meta;

type Story = StoryObj<typeof KeymapApp>;

export const Default: Story = {
  loaders: [() => loadOverrides({})],
};

export const WithOverride: Story = {
  loaders: [() => loadOverrides(singleOverride)],
};

export const RebindByKeyboard: Story = {
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('rebind-move_cursor_to_the_beginning'));
    // The capture listener sits on document, not on the button, so the chord
    // goes to the page rather than to a focused element.
    await userEvent.keyboard('{Control>}m{/Control}');

    const current = canvas.getByTestId('current-move_cursor_to_the_beginning');
    await expect(current).toHaveTextContent('Ctrl');
    await expect(current).toHaveTextContent('m');
  },
};

const twoModifierOverride: Record<string, Chord> = {
  move_cursor_to_the_beginning: { key: 'm', ctrl: true, alt: true, shift: false },
};

export const TwoModifierOverride: Story = {
  loaders: [() => loadOverrides(twoModifierOverride)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two modifiers is the case where a renderer that keeps only the last one
    // still looks right for every single-modifier row.
    const current = await canvas.findByTestId('current-move_cursor_to_the_beginning');
    await expect(current).toHaveTextContent('Ctrl');
    await expect(current).toHaveTextContent('Alt');
    await expect(current).toHaveTextContent('m');
  },
};
