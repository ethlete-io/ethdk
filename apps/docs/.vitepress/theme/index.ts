import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Example from './Example.vue';
import StoryEmbed from './StoryEmbed.vue';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Example', Example);
    app.component('StoryEmbed', StoryEmbed);
  },
};

export default theme;
