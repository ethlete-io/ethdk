<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import { computed, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    id: string;
    height?: string;
  }>(),
  { height: '420px' },
);

const base = import.meta.env.DEV ? 'http://localhost:4403/' : withBase('/examples/');
const { isDark } = useData();
const frame = ref<HTMLIFrameElement>();
const initialTheme = ref<'light' | 'dark'>();

onMounted(() => (initialTheme.value = isDark.value ? 'dark' : 'light'));

watch(isDark, (dark) =>
  frame.value?.contentWindow?.postMessage({ type: 'et-docs-theme', theme: dark ? 'dark' : 'light' }, '*'),
);

const src = computed(() => `${base}?id=${encodeURIComponent(props.id)}&theme=${initialTheme.value}`);
</script>

<template>
  <figure class="docs-example">
    <iframe
      v-if="initialTheme"
      ref="frame"
      :src="src"
      :style="{ height }"
      :title="`Example ${id}`"
      loading="lazy"
    ></iframe>
    <div class="docs-example-placeholder" v-else :style="{ height }"></div>
    <figcaption>
      <a :href="src" target="_blank" rel="noreferrer">Open example ↗</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.docs-example {
  margin: 16px 0;
}

.docs-example iframe,
.docs-example-placeholder {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: var(--vp-c-bg);
}

.docs-example figcaption {
  margin-top: 4px;
  text-align: right;
  font-size: 13px;
}
</style>
