import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { seededStory } from '../../.storybook/seed';
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
