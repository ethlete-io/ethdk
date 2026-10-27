import { Drawing, mountDrawing, placeOverlays } from '@design-explore';
import { calls } from 'virtual:design-explore';
import { loadEnv, loadProductEnv } from 'virtual:design-explore/env';
import { parts, sketchParts } from 'virtual:design-explore/system';

const params = new URLSearchParams(location.search);
const slug = params.get('call') ?? '';
const product = params.get('product');
const partKey = params.get('part') ?? '';
const key = (product ? params.get('state') : params.get('variant')) ?? '';
const sketch = product ? params.get('sketch') : null;
const sketchVariant = params.get('variant') ?? '';

await (product ? loadProductEnv(product) : loadEnv(slug.split('/')[0] ?? ''));

const root = document.querySelector('#root') as HTMLElement;
const surface = params.get('surface');
const color = params.get('color');

// On <html> a theme class ties with the `:root` defaults of the theme CSS, which come later and win.
if (surface) root.classList.add(`et-surface--${surface}`);
if (color) root.classList.add(`et-color--${color}`);

const fail = (message: string): null => {
  const text = document.createElement('pre');

  text.textContent = message;
  text.style.margin = '0';
  text.style.whiteSpace = 'pre-wrap';
  root.replaceChildren(text);
  root.setAttribute('style', 'padding:16px;font:14px monospace;color:#f0a0a0;background:#1a1414');

  return null;
};

const showSetupError = (message: string) => {
  const banner = document.createElement('pre');

  banner.textContent = message;
  banner.setAttribute(
    'style',
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;margin:0;padding:16px;white-space:pre-wrap;font:14px monospace;color:#f0a0a0;background:#1a1414',
  );
  document.body.append(banner);
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const drawCall = async (): Promise<Drawing | null> => {
  const call = calls[slug];
  if (!call) return fail(`design-explore: no call "${slug}"`);

  const variant = (await call()).default.variants.find((o) => o.key === key);
  if (!variant) return fail(`design-explore: call "${slug}" has no variant "${key}"`);

  return variant.load().then(
    (module) => module.default,
    (error: unknown) => fail(`design-explore: variant "${key}" failed\n${messageOf(error)}`),
  );
};

const drawPart = async (name: string): Promise<Drawing | null> => {
  const load = sketch ? sketchParts[name]?.[sketch]?.[sketchVariant]?.[partKey] : parts[name]?.[partKey];
  if (!load)
    return fail(
      sketch
        ? `design-explore: variant "${sketchVariant}" of the sketch on ${sketch} in product "${name}" has no part "${partKey}"`
        : `design-explore: product "${name}" has no part "${partKey}"`,
    );

  try {
    const part = (await load()).default;

    if (!(key in part.states)) return fail(`design-explore: part "${partKey}" has no state "${key}"`);

    return await part.render(part.states[key]);
  } catch (error) {
    return fail(`design-explore: state "${key}" of "${partKey}" failed\n${messageOf(error)}`);
  }
};

const loaded = await (product ? drawPart(product) : drawCall());

if (loaded) {
  const style = document.createElement('style');

  style.textContent = loaded.styles;
  document.head.append(style);
  const error = mountDrawing(root, loaded);

  if (error)
    showSetupError(`design-explore: setup of ${product ? 'state' : 'variant'} "${key}" failed\n${messageOf(error)}`);
}

const place = () => placeOverlays(root);

new MutationObserver(place).observe(root, { childList: true, subtree: true });
new ResizeObserver(place).observe(root);
place();

const report = () => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  parent.postMessage({ type: 'design-explore:height', variant: key, height }, '*');
};

new ResizeObserver(report).observe(document.documentElement);
report();

addEventListener('keydown', (event) => {
  if (event.key === 'Escape') parent.postMessage({ type: 'design-explore:escape', variant: key }, '*');
});

addEventListener(
  'scroll',
  () => parent.postMessage({ type: 'design-explore:scroll', variant: key, y: Math.round(scrollY) }, '*'),
  { passive: true },
);
