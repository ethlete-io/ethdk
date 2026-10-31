import { CallVariant, Drawing, fitOutOfFlow, mountDrawing, placeOverlays } from '../define-call';
import { Part } from '../define-part';
import { applyEmbed, fitEmbed } from '../embed-page';
import { pinScheme } from './frame-scheme';
import { runRules, stepMotion, SteppedMotion } from '../motion-runtime';
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
const propsSketch = product ? params.get('props') : null;
const propsVariant = params.get('props-variant') ?? '';
const motionName = product ? params.get('motion') : null;
const flowTo = product ? params.get('flow-to') : null;

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

const scheme = params.get('scheme');

if (scheme === 'light' || scheme === 'dark') pinScheme(document, scheme);
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

const failMissing = (message: string) => {
  document.documentElement.setAttribute('data-et-missing', '');

  return fail(message);
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

const RETRY_DELAYS = [300, 1500];

// A part file that changes while frames load can fail its import once; Chromium fetches a failed module again.
const retried = <T>(load: () => Promise<T>, attempt = 0): Promise<T> =>
  load().catch((error: unknown) => {
    const delay = RETRY_DELAYS[attempt];
    if (delay === undefined) throw error;

    return new Promise<void>((resolve) => setTimeout(resolve, delay)).then(() => retried(load, attempt + 1));
  });

let drawnPart: { part: Part<unknown>; states: Record<string, unknown> } | null = null;

const drawCall = async (): Promise<Drawing | null> => {
  const call = calls[slug];
  if (!call) return failMissing(`design-explore: no call "${slug}"`);

  const variant: CallVariant | undefined = (await call()).default.variants.find((o) => o.key === key);
  if (!variant) return failMissing(`design-explore: call "${slug}" has no variant "${key}"`);

  return variant.load().then(
    (module) => module.default,
    (error: unknown) => fail(`design-explore: variant "${key}" failed\n${messageOf(error)}`),
  );
};

const drawPart = async (name: string): Promise<Drawing | null> => {
  const load = sketch ? sketchParts[name]?.[sketch]?.[sketchVariant]?.[partKey] : parts[name]?.[partKey];
  if (!load)
    return failMissing(
      sketch
        ? `design-explore: variant "${sketchVariant}" of the sketch on ${sketch} in product "${name}" has no part "${partKey}"`
        : `design-explore: product "${name}" has no part "${partKey}"`,
    );

  const loadProps = propsSketch ? sketchParts[name]?.[propsSketch]?.[propsVariant]?.[partKey] : load;
  if (!loadProps)
    return failMissing(
      `design-explore: variant "${propsVariant}" of the sketch on ${propsSketch} in product "${name}" has no part "${partKey}"`,
    );

  try {
    const [{ default: part }, { default: holder }] = await Promise.all([retried(load), retried(loadProps)]);

    if (!(key in holder.states)) return failMissing(`design-explore: part "${partKey}" has no state "${key}"`);

    drawnPart = { part: part as Part<unknown>, states: holder.states };

    return await part.render(holder.states[key]);
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
  if (!/:(?:hover|focus-visible|active|focus-within)/iu.test(css)) return css;

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

const stateMarkupOf = ({ part, states }: NonNullable<typeof drawnPart>, styles: string) => {
  const sheets = new Set([styles]);

  return (state: string) =>
    Promise.resolve(part.render(states[state])).then((drawn) =>
      sheets.has(drawn.styles)
        ? drawn.body
        : forced(drawn.styles).then((css) => {
            const style = document.createElement('style');

            sheets.add(drawn.styles);
            style.textContent = css;
            document.head.append(style);

            return drawn.body;
          }),
    );
};

const exposeStepped = (options: { start: () => Promise<SteppedMotion>; interrupt: number | null }) => {
  let stepped: SteppedMotion | null = null;
  const steppedOf = () => {
    if (!stepped) throw new Error('design-explore: start the motion first');

    return stepped;
  };

  Object.assign(window, {
    etMotion: {
      start: () =>
        options.start().then((started) => {
          stepped = started;

          return true;
        }),
      seek: (ms: number) => steppedOf().seek(ms),
      bounds: () => steppedOf().bounds(),
      timeline: () => ({ end: steppedOf().end(), tracks: steppedOf().tracks(), interrupt: options.interrupt }),
    },
  });
};

const exposeMotion = (options: { drawn: NonNullable<typeof drawnPart>; name: string; styles: string }) => {
  const { drawn, name, styles } = options;
  const motion = drawn.part.motions?.[name];

  if (!motion) {
    const known = Object.keys(drawn.part.motions ?? {});

    showSetupError(`design-explore: part "${partKey}" has no motion "${name}" - it has: ${known.join(', ') || 'none'}`);

    return;
  }

  const markupOf = stateMarkupOf(drawn, styles);

  exposeStepped({
    interrupt: motion.interrupt ?? null,
    start: () =>
      Promise.all([markupOf(motion.to), motion.interrupt === undefined ? null : markupOf(motion.from)]).then(
        ([markup, back]) =>
          stepMotion({
            root,
            markup,
            motion,
            ...(back === null
              ? {}
              : {
                  reverse: {
                    markup: back,
                    motion: Object.values(drawn.part.motions ?? {}).find(
                      (other) => other.from === motion.to && other.to === motion.from,
                    ),
                  },
                }),
          }),
      ),
  });
};

const exposeFlowLine = (options: { product: string; to: string; styles: string }) => {
  const [toPart = '', toState = ''] = options.to.split('#');
  const load = parts[options.product]?.[toPart];

  if (!load) {
    showSetupError(`design-explore: product "${options.product}" has no part "${toPart}"`);

    return;
  }

  exposeStepped({
    interrupt: null,
    start: () =>
      retried(load).then(({ default: part }) => {
        const states = (part as Part<unknown>).states;

        if (!(toState in states)) throw new Error(`design-explore: part "${toPart}" has no state "${toState}"`);

        // The styles of the to page ride in the markup: in <head> they would restyle the from page before the View Transition captures it.

        return Promise.resolve((part as Part<unknown>).render(states[toState]))
          .then((drawn) =>
            drawn.styles === options.styles
              ? drawn.body
              : forced(drawn.styles).then((css) => `<style>${css}</style>${drawn.body}`),
          )
          .then((markup) => stepMotion({ root, markup, motion: { from: key, to: toState, viewTransition: true } }));
      }),
  });
};

const runPartRules = (drawn: NonNullable<typeof drawnPart>, styles: string) => {
  runRules(root, {
    state: key,
    rules: drawn.part.rules ?? [],
    motions: drawn.part.motions,
    render: stateMarkupOf(drawn, styles),
    switched: () => {
      const partRoot = partRootOf(root);

      if (interaction && partRoot) force(partRoot, interaction);
    },
    failed: (error) => showSetupError(`design-explore: switch of part "${partKey}" failed\n${messageOf(error)}`),
  });
};

// macOS WebKit can loop in module evaluation when a frame with top-level await is removed.
const drawFrame = async () => {
  parent.postMessage({ type: 'design-explore:loading' }, '*');
  await (product ? loadProductEnv({ product, sketch, variant: sketchVariant }) : loadEnv(slug.split('/')[0] ?? ''));
  const tokenStyles = product ? await tokensOf(product) : null;
  const loaded = await (product ? drawPart(product) : drawCall());

  if (loaded) {
    if (tokenStyles !== null) {
      const style = document.createElement('style');

      style.textContent = tokenStyles;
      document.head.append(style);
    }

    const style = document.createElement('style');

    style.textContent = await forced(loaded.styles ?? '');
    document.head.append(style);
    const error = mountDrawing(root, loaded);
    const partRoot = partRootOf(root);

    if (interaction && partRoot) force(partRoot, interaction);

    if (error)
      showSetupError(`design-explore: setup of ${product ? 'state' : 'variant'} "${key}" failed\n${messageOf(error)}`);

    if (flowTo && product) exposeFlowLine({ product, to: flowTo, styles: loaded.styles ?? '' });
    else if (motionName && drawnPart) exposeMotion({ drawn: drawnPart, name: motionName, styles: loaded.styles ?? '' });
    else if (drawnPart?.part.rules?.length) runPartRules(drawnPart, loaded.styles ?? '');
  }

  const place = () => {
    applyEmbed(frameElement, root);
    placeOverlays(root);
    fitOutOfFlow(root, { sideways: fit });
  };

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
