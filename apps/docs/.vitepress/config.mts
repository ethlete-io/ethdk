import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  title: 'Ethlete SDK',
  description: 'Documentation for the Ethlete SDK',
  outDir: '../../dist/apps/docs',
  cleanUrls: true,

  vite: {
    plugins: [tsconfigPaths(), llmstxt()],
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Components', link: '/components/' },
      { text: 'Query', link: '/query/' },
      { text: 'Query devtools', link: '/query-devtools/' },
      { text: 'Core', link: '/core/' },
      { text: 'Types', link: '/types/' },
      { text: 'ESLint', link: '/eslint/' },
      { text: 'Contentful', link: '/contentful/' },
      { text: 'CDK', link: '/cdk/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Agent Rules', link: '/agent-rules/' },
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
      '/query-devtools/': [
        {
          text: 'Query devtools',
          items: [{ text: 'Overview', link: '/query-devtools/' }],
        },
      ],
      '/cli/': [
        {
          text: 'CLI',
          items: [{ text: 'Overview', link: '/cli/' }],
        },
      ],
      '/agent-rules/': [
        {
          text: 'Agent rules',
          items: [{ text: 'Overview', link: '/agent-rules/' }],
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
          items: [
            { text: 'Overview', link: '/cdk/' },
            { text: 'Migrating to components', link: '/cdk/migration' },
          ],
        },
        {
          text: 'Floating & overlays',
          items: [
            { text: 'Overlays', link: '/cdk/overlays' },
            { text: 'Menu', link: '/cdk/menu' },
            { text: 'Tooltip', link: '/cdk/tooltip' },
            { text: 'Toggletip', link: '/cdk/toggletip' },
            { text: 'Filter overlay', link: '/cdk/filter-overlay' },
          ],
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
          text: 'Elements',
          items: [
            { text: 'Button', link: '/cdk/button' },
            { text: 'Icons', link: '/cdk/icons' },
            { text: 'Tabs', link: '/cdk/tabs' },
            { text: 'Progress spinner', link: '/cdk/progress-spinner' },
          ],
        },
        {
          text: 'Layout & media',
          items: [
            { text: 'Accordion', link: '/cdk/accordion' },
            { text: 'Breadcrumb', link: '/cdk/breadcrumb' },
            { text: 'Carousel', link: '/cdk/carousel' },
            { text: 'Masonry', link: '/cdk/masonry' },
            { text: 'Picture', link: '/cdk/picture' },
            { text: 'Scrollable', link: '/cdk/scrollable' },
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
            { text: 'Multi-tab sync', link: '/query/multi-tab' },
            { text: 'Persisted responses', link: '/query/persistence' },
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
            { text: 'Scroll restoration', link: '/core/scroll-restoration' },
            { text: 'Drag & resize', link: '/core/drag-resize' },
            { text: 'Directives & pipes', link: '/core/directives-pipes' },
          ],
        },
        {
          text: 'App services',
          items: [
            { text: 'Providers', link: '/core/providers' },
            { text: 'SEO', link: '/core/seo' },
            { text: 'Notifications', link: '/core/notifications' },
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
            { text: 'Avatar', link: '/components/avatar' },
            { text: 'Badge', link: '/components/badge' },
            { text: 'Button', link: '/components/button' },
            { text: 'Calendar', link: '/components/calendar' },
            { text: 'Chip', link: '/components/chip' },
            { text: 'Empty state', link: '/components/empty-state' },
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
            { text: 'Bracket rounds list', link: '/components/bracket-rounds-list' },
            { text: 'Breadcrumb', link: '/components/breadcrumb' },
            { text: 'Card', link: '/components/card' },
            { text: 'Carousel', link: '/components/carousel' },
            { text: 'Description list', link: '/components/description-list' },
            { text: 'Divider', link: '/components/divider' },
            { text: 'Grid', link: '/components/grid' },
            { text: 'Kbd', link: '/components/kbd' },
            { text: 'Masonry', link: '/components/masonry' },
            { text: 'Match', link: '/components/match' },
            { text: 'Pagination', link: '/components/pagination' },
            { text: 'Progress steps', link: '/components/progress-steps' },
            { text: 'Scheduler', link: '/components/scheduler' },
            { text: 'Scrollable', link: '/components/scrollable' },
            { text: 'Standings', link: '/components/standings' },
            { text: 'Sport UI recipes', link: '/components/sport-recipes' },
            { text: 'Table', link: '/components/table' },
            { text: 'Tabs', link: '/components/tabs' },
            { text: 'Timeline', link: '/components/timeline' },
            { text: 'Toolbar', link: '/components/toolbar' },
            { text: 'Tree', link: '/components/tree' },
          ],
        },
        {
          text: 'Feedback & media',
          items: [
            { text: 'Banner', link: '/components/banner' },
            { text: 'Notification', link: '/components/notification' },
            { text: 'Picture', link: '/components/picture' },
            { text: 'Stream', link: '/components/stream' },
          ],
        },
        {
          text: 'Utilities',
          items: [
            { text: 'Copy button', link: '/components/copy-button' },
            { text: 'Filter overlay', link: '/components/filter-overlay' },
            { text: 'Floating action', link: '/components/floating-action' },
            { text: 'Focus Ring', link: '/components/focus-ring' },
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
