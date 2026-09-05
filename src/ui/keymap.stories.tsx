import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  failNextSet,
  openedTabs,
  resetStorage,
  seedCommands,
  storedValue,
} from '../../.storybook/chromemock';
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

export const EscapeCancelsCapture: Story = {
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rebind = await canvas.findByTestId('rebind-move_cursor_to_the_beginning');
    await userEvent.click(rebind);
    await userEvent.keyboard('{Escape}');

    // Escape is the way out of a capture nobody meant to start, so it has to
    // leave the binding alone rather than binding Escape itself.
    const current = canvas.getByTestId('current-move_cursor_to_the_beginning');
    await expect(current).toHaveTextContent('Ctrl');
    await expect(current).toHaveTextContent('a');
    await expect(storedValue<Record<string, Chord>>('keymapOverrides')).toBeUndefined();
    // The button carries the capture state, so a cancelled capture that leaves
    // it spinning would keep swallowing the next keystroke.
    await waitFor(() => expect(rebind).toHaveAttribute('aria-label', 'rebind'));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ModifierOnlyKeepsCapturing: Story = {
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rebind = await canvas.findByTestId('rebind-move_cursor_to_the_beginning');
    await userEvent.click(rebind);
    await userEvent.keyboard('{Control}');

    // A modifier alone is a chord half typed, not a chord. Ending the capture
    // there would bind Control by itself and swallow every later shortcut.
    await expect(rebind).toHaveAttribute('aria-label', 'press a key...');
    await expect(storedValue<Record<string, Chord>>('keymapOverrides')).toBeUndefined();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(rebind).toHaveAttribute('aria-label', 'rebind'));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ConflictThenRecover: Story = {
  tags: ['@C1.5'],
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('rebind-move_cursor_to_the_end'));
    await userEvent.keyboard('{Control>}a{/Control}');

    // Ctrl+a already belongs to the first row, so the rebind is refused and
    // named rather than quietly leaving two rows on one chord.
    await expect(await canvas.findByTestId('conflict-move_cursor_to_the_end'))
      .toHaveTextContent('conflicts with: move cursor to the beginning');
    await expect(storedValue<Record<string, Chord>>('keymapOverrides')).toBeUndefined();

    await userEvent.click(canvas.getByTestId('rebind-move_cursor_to_the_end'));
    await userEvent.keyboard('{Control>}m{/Control}');

    const current = canvas.getByTestId('current-move_cursor_to_the_end');
    await waitFor(() => expect(current).toHaveTextContent('m'));
    await expect(current).toHaveTextContent('Ctrl');
    // A refusal that outlives the correction reads as though the free chord
    // was refused too.
    await expect(canvas.getByTestId('keymap-no-conflict')).toBeEmptyDOMElement();
    await waitFor(() => expect(storedValue<Record<string, Chord>>('keymapOverrides')).toEqual({
      move_cursor_to_the_end: { key: 'm', ctrl: true, alt: false, shift: false },
    }));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const SaveFailure: Story = {
  tags: ['@C1.9'],
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    failNextSet('sync write refused');
    await userEvent.click(await canvas.findByTestId('rebind-move_cursor_to_the_end'));
    await userEvent.keyboard('{Control>}m{/Control}');

    await waitFor(() => expect(canvas.getByTestId('keymap-save-error'))
      .toHaveTextContent('sync write refused'));
    // The row is what the user reads the binding off. Storage refused the
    // rebind, so a row still showing Ctrl+m would name a chord no keystroke
    // will ever trigger.
    const current = canvas.getByTestId('current-move_cursor_to_the_end');
    await expect(current).toHaveTextContent('Ctrl');
    await expect(current).toHaveTextContent('e');
    await expect(storedValue<Record<string, Chord>>('keymapOverrides')).toBeUndefined();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

const twoOverrides: Record<string, Chord> = {
  move_cursor_to_the_beginning: { key: 'm', ctrl: true, alt: false, shift: false },
  move_cursor_to_the_end: { key: 'p', ctrl: true, alt: false, shift: false },
};

/**
 * The two rows Chrome owns, as a fresh install shows them.
 *
 * Nothing is assigned, because a reserved chord cannot be suggested by a
 * manifest, so both rows are dimmed and the current column has no chord to
 * print. The dimming is carried by `aria-disabled` rather than by a pale text
 * color alone: axe exempts disabled-marked content from `color-contrast`, and a
 * gray that only lives in the stylesheet fails the storybook spec's zero budget
 * in one theme or the other.
 */
export const ReclaimedUnassigned: Story = {
  tags: ['@C1.18'],
  loaders: [() => loadOverrides({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const command of ['unix_word_rubout', 'transpose_chars']) {
      const row = await canvas.findByTestId(`browser-row-${command}`);
      // Every cell the user READS is marked, and the cell holding the button
      // is not: marking the whole row would describe the one control an
      // unassigned row exists for as unavailable.
      await expect(row.querySelectorAll('td[aria-disabled="true"]')).toHaveLength(3);
      const current = canvas.getByTestId(`browser-current-${command}`);
      await expect(current).toHaveTextContent('—');
      await expect(current.closest('td')).toHaveAttribute('aria-disabled', 'true');
      await expect(canvas.getByTestId(`assign-${command}`)).toBeEnabled();
      await expect(canvas.getByTestId(`assign-${command}`).closest('td'))
        .not.toHaveAttribute('aria-disabled');
    }

    // The button's whole job is to open a URL a page may not link to. The mock
    // records the request rather than following it, which is as far as a story
    // can observe a `chrome://` navigation.
    await userEvent.click(canvas.getByTestId('assign-unix_word_rubout'));
    await waitFor(() => expect(openedTabs()).toEqual([{ url: 'chrome://extensions/shortcuts' }]));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

/**
 * One chord assigned, the other not, in one rendering.
 *
 * Assigning only the rubout is what separates the two states: a row that
 * brightened for any reason other than its own binding would look right here as
 * long as both rows moved together. The assigned row prints what CHROME holds,
 * not the chord the descriptor asked for, so the chips come from the shortcut
 * string rather than from `browserChords`.
 */
export const ReclaimedAssigned: Story = {
  tags: ['@C1.18'],
  loaders: [async () => {
    const context = await loadOverrides({});
    seedCommands({ unix_word_rubout: 'Ctrl+W' });
    return context;
  }],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const assignedCurrent = await canvas.findByTestId('browser-current-unix_word_rubout');
    await waitFor(() => expect(assignedCurrent).toHaveTextContent('Ctrl'));
    await expect(assignedCurrent).toHaveTextContent('W');
    await expect(assignedCurrent.querySelectorAll('kbd')).toHaveLength(2);
    const assignedRow = canvas.getByTestId('browser-row-unix_word_rubout');
    await expect(assignedRow.querySelectorAll('td[aria-disabled="true"]')).toHaveLength(0);
    // The browser owns the binding, so the row offers a way out to Chrome
    // rather than the in-page rebind the rows above it carry.
    await expect(canvas.getByTestId('manage-unix_word_rubout'))
      .toHaveAccessibleName("edit in Chrome's shortcuts page");
    await expect(canvas.queryByTestId('rebind-unix_word_rubout')).toBeNull();

    const untouched = canvas.getByTestId('browser-row-transpose_chars');
    await expect(untouched.querySelectorAll('td[aria-disabled="true"]')).toHaveLength(3);
    await expect(canvas.getByTestId('browser-current-transpose_chars')).toHaveTextContent('—');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ResetRow: Story = {
  tags: ['@C1.5'],
  loaders: [() => loadOverrides(twoOverrides)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('reset-move_cursor_to_the_beginning'));

    const reset = canvas.getByTestId('current-move_cursor_to_the_beginning');
    await waitFor(() => expect(reset).toHaveTextContent('a'));
    await expect(reset).toHaveTextContent('Ctrl');
    // A per-row reset that clears the whole layer looks identical on the row
    // that was clicked, so the second override is the only thing that tells
    // the two apart.
    const kept = canvas.getByTestId('current-move_cursor_to_the_end');
    await expect(kept).toHaveTextContent('Ctrl');
    await expect(kept).toHaveTextContent('p');
    await waitFor(() => expect(storedValue<Record<string, Chord>>('keymapOverrides')).toEqual({
      move_cursor_to_the_end: { key: 'p', ctrl: true, alt: false, shift: false },
    }));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
