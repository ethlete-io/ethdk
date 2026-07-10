import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import StoryEmbed from './StoryEmbed.vue';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StoryEmbed', StoryEmbed);
  },
};

export default theme;
