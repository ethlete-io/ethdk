import { defineConfig } from 'vitepress';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

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
      { text: 'Query', link: '/query/' },
      { text: 'Core', link: '/core/' },
      { text: 'CDK', link: '/cdk/' },
    ],

    sidebar: {
      '/query/': [
        {
          text: 'Query',
          items: [
            { text: 'Overview', link: '/query/' },
            { text: 'Query Creator', link: '/query/query-creator' },
            { text: 'Query Client', link: '/query/query-client' },
            { text: 'Query Features', link: '/query/query-features' },
            { text: 'Auth Provider', link: '/query/auth' },
            { text: 'Query Stack', link: '/query/query-stack' },
            { text: 'Paged Query Stack', link: '/query/paged-query-stack' },
            { text: 'GQL', link: '/query/gql' },
            { text: 'Error Reference', link: '/query/errors' },
          ],
        },
      ],
      '/core/': [
        {
          text: 'Core',
          items: [
            { text: 'Overview', link: '/core/' },
            { text: 'RuntimeError', link: '/core/runtime-error' },
          ],
        },
      ],
      '/cdk/': [
        {
          text: 'CDK',
          items: [{ text: 'Overview', link: '/cdk/' }],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/ethlete-io/ethdk' }],

    search: {
      provider: 'local',
    },
  },
});
