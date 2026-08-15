import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { installChromeMock } from './chromemock';
import '../src/css/options.css';

installChromeMock();

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
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
