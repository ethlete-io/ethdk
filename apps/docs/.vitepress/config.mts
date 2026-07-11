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
      { text: 'Query', link: '/query/' },
      { text: 'Types', link: '/types/' },
      { text: 'ESLint', link: '/eslint/' },
      { text: 'Contentful', link: '/contentful/' },
      { text: 'CLI', link: '/cli/' },
    ],

    sidebar: {
      '/eslint/': [
        {
          text: 'ESLint plugin',
          items: [
            { text: 'Overview', link: '/eslint/' },
            { text: 'Rules', link: '/eslint/rules' },
          ],
        },
      ],
      '/types/': [
        {
          text: 'Types',
          items: [{ text: 'Overview', link: '/types/' }],
        },
      ],
      '/cli/': [
        {
          text: 'CLI',
          items: [{ text: 'Overview', link: '/cli/' }],
        },
      ],
      '/contentful/': [
        {
          text: 'Contentful',
          items: [{ text: 'Overview', link: '/contentful/' }],
        },
      ],
      '/query/': [
        {
          text: 'Query',
          items: [{ text: 'Overview', link: '/query/' }],
        },
        {
          text: 'Core',
          items: [
            { text: 'Queries & creators', link: '/query/queries' },
            { text: 'Query features', link: '/query/features' },
            { text: 'Caching & deduplication', link: '/query/caching' },
            { text: 'Query stacks & pagination', link: '/query/stacks' },
            { text: 'Errors & retries', link: '/query/errors' },
          ],
        },
        {
          text: 'HTTP & auth',
          items: [
            { text: 'HTTP queries', link: '/query/http' },
            { text: 'Auth', link: '/query/auth' },
          ],
        },
        {
          text: 'GraphQL & realtime',
          items: [
            { text: 'GraphQL', link: '/query/gql' },
            { text: 'WebSockets', link: '/query/ws' },
          ],
        },
        {
          text: 'Legacy',
          items: [{ text: 'Legacy client (V2)', link: '/query/legacy' }],
        },
      ],
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
