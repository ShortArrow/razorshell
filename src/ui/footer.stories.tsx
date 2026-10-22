import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { mockManifestVersion } from '../../.storybook/chromemock';
import { FooterApp } from './footer';

const meta: Meta<typeof FooterApp> = {
  title: 'Options/FooterApp',
  component: FooterApp,
};

export default meta;

type Story = StoryObj<typeof FooterApp>;

/**
 * The feedback links render as named links, and the problem report carries the
 * running version into the form. Nothing here touches storage.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const report = await canvas.findByRole('link', { name: 'Report a problem' });
    const url = new URL(report.getAttribute('href')!);
    await expect(url.searchParams.get('template')).toBe('site-not-working.yml');
    await expect(url.searchParams.get('version')).toBe(mockManifestVersion);
    await expect(canvas.getByRole('link', { name: 'Request a binding' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Ideas and questions' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'source code' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Chrome Web Store' })).toBeVisible();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};
