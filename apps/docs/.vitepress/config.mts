import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Ethlete SDK',
  description: 'Documentation for the Ethlete SDK',
  outDir: '../../dist/apps/docs',

  vite: {
    plugins: [nxViteTsPaths()],
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Components', link: '/components/' },
    ],

    sidebar: {
      '/components/': [
        {
          text: 'Components',
          items: [{ text: 'Overview', link: '/components/' }],
        },
        {
          text: 'Floating & overlays',
          items: [
            { text: 'Overlays', link: '/components/overlays' },
            { text: 'Overlay Openers', link: '/components/overlay-openers' },
            { text: 'Menu', link: '/components/menu' },
            { text: 'Tooltip', link: '/components/tooltip' },
            { text: 'Toggletip', link: '/components/toggletip' },
          ],
        },
        {
          text: 'Elements',
          items: [
            { text: 'Button', link: '/components/button' },
            { text: 'Icon', link: '/components/icon' },
            { text: 'Loaders', link: '/components/loader' },
          ],
        },
        {
          text: 'Forms',
          items: [{ text: 'Forms', link: '/components/forms' }],
        },
        {
          text: 'Layout & structure',
          items: [
            { text: 'Grid', link: '/components/grid' },
            { text: 'Scrollable', link: '/components/scrollable' },
            { text: 'Tabs', link: '/components/tabs' },
          ],
        },
        {
          text: 'Feedback & media',
          items: [
            { text: 'Notification', link: '/components/notification' },
            { text: 'Stream', link: '/components/stream' },
          ],
        },
        {
          text: 'Utilities',
          items: [
            { text: 'Focus Ring', link: '/components/focus-ring' },
            { text: 'Error codes', link: '/components/error-codes' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/ethlete-io/ethdk' }],

    search: {
      provider: 'local',
    },
  },
});
