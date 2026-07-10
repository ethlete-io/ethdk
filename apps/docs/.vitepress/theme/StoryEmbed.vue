<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Storybook story id, e.g. `components-overlay-using-openers--default`. */
    id: string;
    height?: string;
    /** Storybook base URL. Auto-detected from the docs host when omitted. */
    base?: string;
  }>(),
  { height: '480px', base: '' },
);

// Docs and Storybook deploy in branch-matched pairs (main → ethlete-sdk.web.app,
// next → next-ethlete-sdk.web.app), so pick the Storybook that belongs to the site
// being viewed. `window` is unavailable during SSG, so resolve on mount and only
// render the iframe once the base is known.
const detectedBase = ref('');

onMounted(() => {
  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    detectedBase.value = 'http://localhost:4400';
  } else if (host.includes('-next')) {
    detectedBase.value = 'https://next-ethlete-sdk.web.app';
  } else {
    detectedBase.value = 'https://ethlete-sdk.web.app';
  }
});

const resolvedBase = computed(() => props.base || detectedBase.value);
const iframeSrc = computed(() => `${resolvedBase.value}/iframe.html?viewMode=story&id=${props.id}`);
const storyUrl = computed(() => `${resolvedBase.value}/?path=/story/${props.id}`);
</script>

<template>
  <figure class="story-embed">
    <iframe v-if="resolvedBase" :src="iframeSrc" :style="{ height }" loading="lazy"></iframe>
    <div class="story-embed-placeholder" v-else :style="{ height }"></div>
    <figcaption>
      <a v-if="resolvedBase" :href="storyUrl" target="_blank" rel="noreferrer">Open in Storybook ↗</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.story-embed {
  margin: 16px 0;
}

.story-embed iframe,
.story-embed-placeholder {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: #101012;
}

.story-embed figcaption {
  margin-top: 4px;
  text-align: right;
  font-size: 13px;
}
</style>
