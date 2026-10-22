<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    id: string;
    height?: string;
  }>(),
  { height: '420px' },
);

const base = import.meta.env.DEV ? 'http://localhost:4403/' : withBase('/examples/');
const src = computed(() => `${base}?id=${encodeURIComponent(props.id)}`);
</script>

<template>
  <figure class="docs-example">
    <iframe :src="src" :style="{ height }" :title="`Example ${id}`" loading="lazy"></iframe>
    <figcaption>
      <a :href="src" target="_blank" rel="noreferrer">Open example ↗</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.docs-example {
  margin: 16px 0;
}

.docs-example iframe {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: #101012;
}

.docs-example figcaption {
  margin-top: 4px;
  text-align: right;
  font-size: 13px;
}
</style>
