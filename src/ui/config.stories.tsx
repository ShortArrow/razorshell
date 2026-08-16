import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { failNextSet, storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { ConfigApp } from './config';

const meta: Meta<typeof ConfigApp> = {
  title: 'Options/ConfigApp',
  component: ConfigApp,
};

export default meta;

type Story = StoryObj<typeof ConfigApp>;

export const Default: Story = {
  decorators: [seededStory({})],
};

export const ImportError: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByTestId('config-text');
    await userEvent.type(textarea, '{{ not json');
    await userEvent.click(canvas.getByTestId('config-apply'));
    await expect(canvas.getByTestId('config-result')).not.toBeEmptyDOMElement();
  },
};

export const AppliedBadge: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // userEvent reads a lone `{` as the start of a key descriptor, so every
    // literal brace in the json has to be doubled.
    await userEvent.type(await canvas.findByTestId('config-text'), '{{"version":1,"language":"ja"}');
    await userEvent.click(canvas.getByTestId('config-apply'));

    await expect(await canvas.findByText('applied')).toBeInTheDocument();
    // The badge says the import succeeded; only storage says the settings will
    // still be there after a reload.
    await waitFor(() => expect(storedValue<string>('language')).toBe('ja'));
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ChooseFile: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const contents = '{"version":1}';

    await userEvent.upload(
      await canvas.findByTestId('config-file'),
      new File([contents], 'my-config.json', { type: 'application/json' }),
    );

    // Choosing a file only stages it: the text is what Apply reads, and the
    // name is how the user tells which file is staged.
    await waitFor(() => expect(canvas.getByTestId('config-text')).toHaveValue(contents));
    await expect(canvas.getByText('my-config.json')).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const SaveFailure: Story = {
  decorators: [seededStory({ language: 'auto' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(await canvas.findByTestId('config-text'), '{{"version":1,"language":"ja"}');
    failNextSet('sync write refused');
    await userEvent.click(canvas.getByTestId('config-apply'));

    await expect(await canvas.findByText('sync write refused')).toBeInTheDocument();
    // Valid json that storage refused is still not imported, so the settings
    // the page reports have to be the ones storage kept.
    await expect(canvas.queryByText('applied')).not.toBeInTheDocument();
    await expect(storedValue<string>('language')).toBe('auto');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
