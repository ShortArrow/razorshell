import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { installChromeMock } from './chromemock';
import '../src/css/options.css';

installChromeMock();

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // The addon's default is 'todo', which only warns. Stories are the only
    // place these components are exercised with layout, so a violation here
    // has to fail the run to mean anything.
    a11y: {
      test: 'error',
      // `bypass` asks a whole page for a skip link. A story renders one
      // component with no page around it, so the rule is inapplicable here
      // rather than failing: it reported "incomplete" on every story whose
      // component carries no heading.
      config: { rules: [{ id: 'bypass', enabled: false }] },
    },
  },
  globalTypes: {
    theme: {
      description: 'daisyUI theme applied to documentElement',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as string;
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
        // ThemeApp paints the same attribute from storage, and it does so from
        // a resolved promise, which lands after this effect. Reasserting on a
        // later turn keeps the toolbar global authoritative for every story.
        const settle = setTimeout(() => {
          document.documentElement.dataset.theme = theme;
        }, 0);
        return () => clearTimeout(settle);
      }, [theme]);
      document.documentElement.dataset.theme = theme;
      return (
        <div className='prose p-6 bg-base-100 text-base-content'>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
