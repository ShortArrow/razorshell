import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { failNextSet, storedValue } from '../../.storybook/chromemock';
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
    (document.activeElement as HTMLElement | null)?.blur();
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

export const RemoveRule: Story = {
  decorators: [seededStory({
    urlPolicy: {
      defaultAction: 'allow',
      rules: [{ pattern: 'https://example.com/secret', matchType: 'exact', action: 'deny' }],
    } satisfies UrlPolicy,
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pattern = 'https://example.com/secret';

    await expect(await canvas.findByText(pattern)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'delete rule 1' }));

    await waitFor(() => expect(canvas.queryByText(pattern)).not.toBeInTheDocument());
    await waitFor(() => expect(storedValue<UrlPolicy>('urlPolicy')?.rules).toEqual([]));
  },
};

export const InvalidPattern: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(
      await canvas.findByLabelText(getMessage('tooltip_match_type')()), 'regex');
    await userEvent.type(canvas.getByPlaceholderText('pattern'), '(');
    await userEvent.click(canvas.getByRole('button', { name: 'add rule' }));

    await expect(await canvas.findByText('invalid regular expression')).toBeInTheDocument();
    // A rejected pattern must not reach either the table or storage, so the
    // policy stays untouched rather than gaining a rule that cannot compile.
    await expect(storedValue<UrlPolicy>('urlPolicy')).toBeUndefined();
  },
};

const oneRule: UrlPolicy = {
  defaultAction: 'allow',
  rules: [{ pattern: 'https://example.com/secret', matchType: 'exact', action: 'deny' }],
};

export const SaveFailure: Story = {
  tags: ['@C1.9'],
  decorators: [seededStory({ urlPolicy: oneRule })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pattern = 'https://example.com/secret';

    await expect(await canvas.findByText(pattern)).toBeInTheDocument();
    failNextSet('quota exceeded');
    await userEvent.click(canvas.getByRole('button', { name: 'delete rule 1' }));

    await expect(await canvas.findByTestId('url-save-error')).toHaveTextContent('quota exceeded');
    // The deletion was shown before storage had accepted it. Storage refused,
    // so the row has to come back rather than leaving the page claiming a
    // policy the extension will not enforce.
    await waitFor(() => expect(canvas.getByText(pattern)).toBeInTheDocument());
    await expect(storedValue<UrlPolicy>('urlPolicy')?.rules).toHaveLength(1);
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const EmptyPattern: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'add rule' }));

    await expect(await canvas.findByText('pattern is empty')).toBeInTheDocument();
    // An empty pattern matches every URL under glob and regex, so admitting one
    // would silently apply its action site-wide.
    await expect(canvas.getByText('no rules')).toBeInTheDocument();
    await expect(storedValue<UrlPolicy>('urlPolicy')).toBeUndefined();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ReorderRule: Story = {
  decorators: [seededStory({
    urlPolicy: {
      defaultAction: 'allow',
      rules: [
        { pattern: 'https://a.example/**', matchType: 'glob', action: 'deny' },
        { pattern: 'https://b.example/**', matchType: 'glob', action: 'allow' },
      ],
    } satisfies UrlPolicy,
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'move rule 1 down' }));

    // First match wins, so the order is the policy: the row that moved to the
    // top is the rule that now decides.
    await waitFor(() => expect(storedValue<UrlPolicy>('urlPolicy')?.rules?.[0]?.pattern)
      .toBe('https://b.example/**'));
    const firstRow = canvas.getAllByRole('row')[1];
    await expect(within(firstRow).getByText('https://b.example/**')).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const DefaultActionChange: Story = {
  decorators: [seededStory({})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(
      await canvas.findByLabelText('Default policy for URLs matching no rule'), 'deny');

    await waitFor(() => expect(storedValue<UrlPolicy>('urlPolicy')?.defaultAction).toBe('deny'));
    // With no rules at all the default is the whole policy, so the probe is
    // where the change becomes visible as a decision rather than as a select.
    await userEvent.type(canvas.getByTestId('url-probe-input'), 'https://anything.example/');
    await expect(canvas.getByTestId('url-probe-result')).toHaveTextContent('default: deny');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const MoveRuleUp: Story = {
  decorators: [seededStory({
    urlPolicy: {
      defaultAction: 'allow',
      rules: [
        { pattern: 'https://a.example/**', matchType: 'glob', action: 'deny' },
        { pattern: 'https://b.example/**', matchType: 'glob', action: 'allow' },
      ],
    } satisfies UrlPolicy,
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Up and down are separate handlers that can disagree about which index
    // moves, and pressing only one of them cannot tell.
    await userEvent.click(await canvas.findByRole('button', { name: 'move rule 2 up' }));

    await waitFor(() => expect(storedValue<UrlPolicy>('urlPolicy')?.rules?.map((rule) => rule.pattern))
      .toEqual(['https://b.example/**', 'https://a.example/**']));
    const firstRow = canvas.getAllByRole('row')[1];
    await expect(within(firstRow).getByText('https://b.example/**')).toBeInTheDocument();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

export const ProbeDefault: Story = {
  decorators: [seededStory({
    urlPolicy: {
      defaultAction: 'allow',
      rules: [{ pattern: 'https://example.com/secret', matchType: 'exact', action: 'deny' }],
    } satisfies UrlPolicy,
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(await canvas.findByTestId('url-probe-input'), 'https://unmatched.example/');

    // No rule matched, so the badge has to name the fallback rather than
    // reading as though some rule decided.
    await expect(canvas.getByTestId('url-probe-result')).toHaveTextContent('default: allow');
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
