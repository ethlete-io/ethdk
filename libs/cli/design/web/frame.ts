import { CallVariant, Drawing, mountDrawing, placeOverlays } from '../define-call';
import { fitEmbed } from '../embed-page';
import { calls } from 'virtual:design-explore';
import { loadEnv, loadProductEnv } from 'virtual:design-explore/env';
import { parts, sketchParts, sketchTokens, tokens } from 'virtual:design-explore/system';

const params = new URLSearchParams(location.search);
const slug = params.get('call') ?? '';
const product = params.get('product');
const partKey = params.get('part') ?? '';
const key = (product ? params.get('state') : params.get('variant')) ?? '';
const sketch = product ? params.get('sketch') : null;
const sketchVariant = params.get('variant') ?? '';
const fit = product !== null && params.has('fit');
const interaction = product ? params.get('interaction') : null;

// Listens before the drawing loads, so an error it throws while loading counts; `report` exists only once `reporting` is set.
let errored = false;
let reporting = false;

const reportError = () => {
  errored = true;
  if (reporting) report();
};

addEventListener('error', reportError);
addEventListener('unhandledrejection', reportError);

const root = document.querySelector('#root') as HTMLElement;
const surface = params.get('surface');
const color = params.get('color');
const fill = params.get('fill');

// On <html> a theme class ties with the `:root` defaults of the theme CSS, which come later and win.
if (surface) root.classList.add(`et-surface--${surface}`);
if (color) root.classList.add(`et-color--${color}`);
if (fill) document.body.style.background = `var(--${fill})`;
if (fit) {
  document.documentElement.style.overflow = 'hidden';
  root.style.width = 'max-content';
  root.style.padding = '16px';
}

const markFailed = (message: string) => {
  errored = true;
  document.documentElement.setAttribute('data-et-error', message);
};

const fail = (message: string) => {
  markFailed(message);

  const text = document.createElement('pre');

  text.textContent = message;
  text.style.margin = '0';
  text.style.whiteSpace = 'pre-wrap';
  root.replaceChildren(text);
  root.setAttribute('style', 'padding:16px;font:14px monospace;color:#f0a0a0;background:#1a1414');

  return null;
};

const showSetupError = (message: string) => {
  markFailed(message);

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

  const variant: CallVariant | undefined = (await call()).default.variants.find((o) => o.key === key);
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

const tokensOf = async (name: string) => {
  const load = sketch ? sketchTokens[name]?.[sketch]?.[sketchVariant] : tokens[name];

  return load ? (await load()).default : null;
};

const partRootOf = (container: HTMLElement) =>
  [...container.children].find((child) => !['STYLE', 'SCRIPT', 'LINK'].includes(child.tagName)) ?? null;

const force = (element: Element, name: string) => {
  if (name === 'disabled') {
    element.setAttribute('disabled', '');
    element.setAttribute('aria-disabled', 'true');
  } else {
    element.setAttribute('data-et-force', name);
  }
};

const forced = async (css: string) => {
  if (!/:(?:hover|focus-visible|active)/iu.test(css)) return css;

  const response = await fetch('/__design/force', { method: 'POST', body: css }).catch(() => null);

  return response?.ok ? response.text() : css;
};

const report = () => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  const width = fit ? { width: Math.ceil(root.getBoundingClientRect().width) } : {};

  fitEmbed(frameElement, height);

  parent.postMessage(
    {
      type: 'design-explore:height',
      variant: key,
      height,
      ...width,
      viewport: { width: innerWidth, height: innerHeight },
      href: location.href,
      ...(errored ? { errored: true } : {}),
    },
    '*',
  );
};

// macOS WebKit can loop in module evaluation when a frame with top-level await is removed.
const drawFrame = async () => {
  parent.postMessage({ type: 'design-explore:loading' }, '*');
  await (product ? loadProductEnv(product) : loadEnv(slug.split('/')[0] ?? ''));
  const tokenStyles = product ? await tokensOf(product) : null;
  const loaded = await (product ? drawPart(product) : drawCall());

  if (loaded) {
    if (tokenStyles !== null) {
      const style = document.createElement('style');

      style.textContent = tokenStyles;
      document.head.append(style);
    }

    const style = document.createElement('style');

    style.textContent = await forced(loaded.styles);
    document.head.append(style);
    const error = mountDrawing(root, loaded);
    const partRoot = partRootOf(root);

    if (interaction && partRoot) force(partRoot, interaction);

    if (error)
      showSetupError(`design-explore: setup of ${product ? 'state' : 'variant'} "${key}" failed\n${messageOf(error)}`);
  }

  const place = () => placeOverlays(root);

  new MutationObserver(place).observe(root, { childList: true, subtree: true });
  new ResizeObserver(place).observe(root);
  place();

  const reported = new ResizeObserver(report);

  reported.observe(document.documentElement);
  if (fit) reported.observe(root);
  reporting = true;
  report();

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') parent.postMessage({ type: 'design-explore:escape', variant: key }, '*');
  });

  addEventListener(
    'scroll',
    () => parent.postMessage({ type: 'design-explore:scroll', variant: key, y: Math.round(scrollY) }, '*'),
    { passive: true },
  );
};

void drawFrame().catch((error: unknown) => {
  fail(`design-explore: frame failed\n${messageOf(error)}`);
  reporting = true;
  report();
});
