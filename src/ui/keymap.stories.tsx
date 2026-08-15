import type { Meta, StoryObj } from '@storybook/react-vite';
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
