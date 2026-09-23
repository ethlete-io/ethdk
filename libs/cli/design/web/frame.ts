import { calls } from 'virtual:design-explore';
import { loadEnv } from 'virtual:design-explore/env';

const params = new URLSearchParams(location.search);
const slug = params.get('call') ?? '';
const key = params.get('variant') ?? '';

await loadEnv(slug.split('/')[0] ?? '');

const root = document.querySelector('#root') as HTMLElement;

const fail = (message: string) => {
  root.textContent = message;
  root.setAttribute('style', 'padding:16px;font:14px monospace;color:#f0a0a0;background:#1a1414');
};

const call = calls[slug];
if (!call) fail(`design-explore: no call "${slug}"`);
else {
  const variant = (await call()).default.variants.find((o) => o.key === key);
  if (!variant) fail(`design-explore: call "${slug}" has no variant "${key}"`);
  else {
    const loaded = (await variant.load()).default;
    const style = document.createElement('style');

    style.textContent = loaded.styles;
    document.head.append(style);
    root.innerHTML = loaded.body;
  }
}

const report = () => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  parent.postMessage({ type: 'design-explore:height', variant: key, height }, '*');
};

new ResizeObserver(report).observe(document.documentElement);
report();
