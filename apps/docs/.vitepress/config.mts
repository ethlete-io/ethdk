import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  title: 'Ethlete SDK',
  description: 'Documentation for the Ethlete SDK',
  outDir: '../../dist/apps/docs',

  vite: {
    plugins: [tsconfigPaths(), llmstxt()],
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Components', link: '/components/' },
      { text: 'Query', link: '/query/' },
      { text: 'Core', link: '/core/' },
      { text: 'Types', link: '/types/' },
      { text: 'ESLint', link: '/eslint/' },
      { text: 'Contentful', link: '/contentful/' },
      { text: 'CDK', link: '/cdk/' },
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
      '/cdk/': [
        {
          text: 'CDK',
          items: [{ text: 'Overview', link: '/cdk/' }],
        },
        {
          text: 'Data & collections',
          items: [
            { text: 'Table & sort', link: '/cdk/table' },
            { text: 'Pagination', link: '/cdk/pagination' },
            { text: 'Rich filter', link: '/cdk/rich-filter' },
            { text: 'Query error & button', link: '/cdk/query-error' },
          ],
        },
        {
          text: 'Forms',
          items: [{ text: 'Forms', link: '/cdk/forms' }],
        },
        {
          text: 'Layout & media',
          items: [
            { text: 'Accordion', link: '/cdk/accordion' },
            { text: 'Breadcrumb', link: '/cdk/breadcrumb' },
            { text: 'Carousel', link: '/cdk/carousel' },
            { text: 'Masonry', link: '/cdk/masonry' },
            { text: 'Picture', link: '/cdk/picture' },
            { text: 'Skeleton', link: '/cdk/skeleton' },
            { text: 'Bracket', link: '/cdk/bracket' },
          ],
        },
        {
          text: 'Utilities',
          items: [{ text: 'Utilities', link: '/cdk/utilities' }],
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
            { text: 'Dependent queries', link: '/query/dependent-queries' },
            { text: 'Caching & deduplication', link: '/query/caching' },
            { text: 'Query stacks & pagination', link: '/query/stacks' },
            { text: 'Query forms', link: '/query/query-forms' },
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
          items: [
            { text: 'Legacy client (V2)', link: '/query/legacy' },
            { text: 'Migrating from V2', link: '/query/migrating-from-v2' },
          ],
        },
      ],
      '/core/': [
        {
          text: 'Core',
          items: [{ text: 'Overview', link: '/core/' }],
        },
        {
          text: 'Signals',
          items: [
            { text: 'Element signals', link: '/core/element-signals' },
            { text: 'Signal utilities', link: '/core/signal-utils' },
          ],
        },
        {
          text: 'Theming & motion',
          items: [
            { text: 'Theming', link: '/core/theming' },
            { text: 'Animations', link: '/core/animations' },
            { text: 'Overlay runtime', link: '/core/overlay-runtime' },
          ],
        },
        {
          text: 'Interaction',
          items: [
            { text: 'Scrolling', link: '/core/scrolling' },
            { text: 'Drag & resize', link: '/core/drag-resize' },
            { text: 'Directives & pipes', link: '/core/directives-pipes' },
          ],
        },
        {
          text: 'App services',
          items: [
            { text: 'Providers', link: '/core/providers' },
            { text: 'SEO', link: '/core/seo' },
          ],
        },
        {
          text: 'Foundation',
          items: [{ text: 'Utilities', link: '/core/utilities' }],
        },
      ],
      '/components/': [
        {
          text: 'Components',
          items: [
            { text: 'Overview', link: '/components/' },
            { text: 'Localization', link: '/components/localization' },
          ],
        },
        {
          text: 'Floating & overlays',
          items: [
            { text: 'Overlay Openers', link: '/components/overlay-openers' },
            { text: 'Overlays', link: '/components/overlays' },
            { text: 'Menu', link: '/components/menu' },
            { text: 'Tooltip', link: '/components/tooltip' },
            { text: 'Toggletip', link: '/components/toggletip' },
          ],
        },
        {
          text: 'Elements',
          items: [
            { text: 'Button', link: '/components/button' },
            { text: 'Calendar', link: '/components/calendar' },
            { text: 'Chip', link: '/components/chip' },
            { text: 'Icon', link: '/components/icon' },
            { text: 'Loaders', link: '/components/loader' },
            { text: 'Skeleton', link: '/components/skeleton' },
            { text: 'Time picker', link: '/components/time-picker' },
          ],
        },
        {
          text: 'Forms',
          items: [
            { text: 'Overview', link: '/components/forms' },
            { text: 'Text inputs', link: '/components/text-inputs' },
            { text: 'Date & time inputs', link: '/components/date-time-inputs' },
            { text: 'Choice & rating', link: '/components/choice-inputs' },
            { text: 'Select', link: '/components/select' },
            { text: 'Cascader', link: '/components/cascader' },
            { text: 'Slider', link: '/components/slider' },
            { text: 'Rich text editor', link: '/components/rich-text-editor' },
            { text: 'Dropzone', link: '/components/dropzone' },
            { text: 'Mixed state (bulk editing)', link: '/components/mixed-state' },
          ],
        },
        {
          text: 'Layout & structure',
          items: [
            { text: 'Accordion', link: '/components/accordion' },
            { text: 'Bracket', link: '/components/bracket' },
            { text: 'Breadcrumb', link: '/components/breadcrumb' },
            { text: 'Carousel', link: '/components/carousel' },
            { text: 'Grid', link: '/components/grid' },
            { text: 'Masonry', link: '/components/masonry' },
            { text: 'Pagination', link: '/components/pagination' },
            { text: 'Scrollable', link: '/components/scrollable' },
            { text: 'Table', link: '/components/table' },
            { text: 'Tabs', link: '/components/tabs' },
          ],
        },
        {
          text: 'Feedback & media',
          items: [
            { text: 'Notification', link: '/components/notification' },
            { text: 'Picture', link: '/components/picture' },
            { text: 'Stream', link: '/components/stream' },
          ],
        },
        {
          text: 'Utilities',
          items: [
            { text: 'Filter overlay', link: '/components/filter-overlay' },
            { text: 'Floating action', link: '/components/floating-action' },
            { text: 'Focus Ring', link: '/components/focus-ring' },
            { text: 'Query devtools', link: '/components/query-devtools' },
            { text: 'Query error', link: '/components/query-error' },
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
