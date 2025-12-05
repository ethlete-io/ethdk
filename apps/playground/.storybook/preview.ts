import { type Preview } from '@storybook/angular';

const customViewports = {
  sm: {
    name: 'SM',
    styles: {
      width: '640px',
      height: '480px',
    },
  },
  md: {
    name: 'MD',
    styles: {
      width: '768px',
      height: '576px',
    },
  },
  lg: {
    name: 'LG',
    styles: {
      width: '1024px',
      height: '960px',
    },
  },
  xl: {
    name: 'XL',
    styles: {
      width: '1280px',
      height: '1024px',
    },
  },
  '2xl': {
    name: '2XL',
    styles: {
      width: '1536px',
      height: '1280px',
    },
  },
  iPhoneSE: {
    name: 'iPhone SE',
    styles: {
      width: '375px',
      height: '667px',
    },
  },
  iPhone12Pro: {
    name: 'iPhone 12 Pro',
    styles: {
      width: '390px',
      height: '844px',
    },
  },
  iPadMini: {
    name: 'iPad Mini',
    styles: {
      width: '768px',
      height: '1024px',
    },
  },
  iPadAir: {
    name: 'iPad Air',
    styles: {
      width: '820px',
      height: '1180px',
    },
  },
};

const preview: Preview = {
  parameters: {
    options: {
      // @ts-expect-error cant use types here
      storySort: (a, b) => {
        // Always put "Overview" first in any folder
        if (a.title.endsWith('/Overview')) return -1;
        if (b.title.endsWith('/Overview')) return 1;

        // Otherwise sort alphabetically
        return a.title.localeCompare(b.title);
      },
    },
    viewport: { viewports: customViewports },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#333',
        },
      ],
    },
  },

  decorators: [
    (story) => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = 'rgb(27, 28, 29)';
        document.documentElement.style.colorScheme = 'dark';
      }

      return story();
    },
  ],
  tags: ['autodocs'],
};

export default preview;
