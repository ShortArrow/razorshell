import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storedValue } from '../../.storybook/chromemock';
import { seededStory } from '../../.storybook/seed';
import { getMessage } from '../languages';
import { UrlApp } from './url';
import type { UrlPolicy } from '../urlrules';

const threeRules: UrlPolicy = {
  defaultAction: 'allow',
  rules: [
    { pattern: 'https://example.com/secret', matchType: 'exact', action: 'deny' },
    { pattern: 'https://*.internal.test/**', matchType: 'glob', action: 'deny' },
    { pattern: '^https://docs\\.', matchType: 'regex', action: 'allow' },
  ],
};

const meta: Meta<typeof UrlApp> = {
  title: 'Options/UrlApp',
  component: UrlApp,
};

export default meta;

type Story = StoryObj<typeof UrlApp>;

export const Empty: Story = {
  decorators: [seededStory({})],
};

export const WithRules: Story = {
  decorators: [seededStory({ urlPolicy: threeRules })],
};

export const ProbeMatch: Story = {
  decorators: [seededStory({ urlPolicy: threeRules })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const probe = await canvas.findByTestId('url-probe-input');
    await userEvent.type(probe, 'https://app.internal.test/admin/panel');
    await expect(canvas.getByTestId('url-probe-result')).toHaveTextContent('deny');
  },
};

export const AddRule: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pattern = 'https://x.example/**';

    await userEvent.type(await canvas.findByPlaceholderText('pattern'), pattern);
    // The two selects are named by their tooltip copy, so the story reads the
    // same message the component does rather than restating the English.
    await userEvent.selectOptions(canvas.getByLabelText(getMessage('tooltip_match_type')()), 'glob');
    await userEvent.selectOptions(canvas.getByLabelText(getMessage('tooltip_rule_action')()), 'deny');
    await userEvent.click(canvas.getByRole('button', { name: 'add rule' }));

    await expect(await canvas.findByText(pattern)).toBeInTheDocument();
    // The row is only the rendered half; the policy has to have reached storage
    // too, which is what the options page reloads from.
    await waitFor(() => expect(storedValue<UrlPolicy>('urlPolicy')?.rules)
      .toEqual([{ pattern, matchType: 'glob', action: 'deny' }]));
  },
};
