import { DesignPreset } from '../design-config';
import { timedPhase } from '../phase-timing';
import { checkerScriptOf, pixelBoxOf, TextAmbient, viewportOf } from '../shot';
import { awaitFonts, Browser, DRAW_TIMEOUT_MS } from '../thumb';
import { forcedSelectorOf } from '../force-interactions';
import {
  ForcedElement,
  FrameLook,
  droppedPropsOf,
  HARNESS_HOST_SELECTOR,
  hostBoxScriptOf,
  OVERLAY_PANES,
} from './part-compare';
import { watchSdkErrors } from './sdk-errors';
import { PANE_COUNT_TIMEOUT_MS, settledPanesOf } from './settled-panes';
import { FrozenAnimation, freezeAnimationsScriptOf } from './frozen-animations';

export class MissingPanesError extends Error {}

/** @internal The problem of a state whose app opened fewer overlay panes than its design draws. */
export const missingPanesProblemOf = (count: { drawn: number; opened: number }) =>
  `the design draws ${count.drawn} overlay pane${count.drawn === 1 ? '' : 's'}, the app opened ${count.opened} before its panes settled or ${PANE_COUNT_TIMEOUT_MS} ms passed`;

/**
 * How compare draws a part: a page at a product preset, the asked one or the first, with the harness host filling
 * its viewport; any other part fitted to its content.
 */
export const compareFrameOf = (options: {
  presets: Record<string, DesignPreset>;
  part: string;
  preset: string | null;
}): { preset: string | null; size: DesignPreset | null; layout: 'page' | null } | string => {
  const { presets, part } = options;

  if (!part.startsWith('pages/'))
    return options.preset === null
      ? { preset: null, size: null, layout: null }
      : `--preset applies to a pages part only, ${part} is fitted to its content`;

  const preset = options.preset ?? Object.keys(presets)[0] ?? '';
  const size = Object.keys(presets).includes(preset) ? presets[preset] : undefined;

  return size
    ? { preset, size, layout: 'page' }
    : `the product has no preset "${preset}" - its presets: ${Object.keys(presets).join(', ')}`;
};

const ROOM_PX = 1024;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class HarnessError extends Error {}

export class UndrivableError extends HarnessError {}

export class DroppedPropsError extends Error {}

export class LookMissError extends Error {}

export class AppFontError extends Error {}

const firstFamilyOf = (family: string) =>
  (family.split(',')[0] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();

const APP_FONTS_SCRIPT = `(() => ({
  'body': getComputedStyle(document.body).fontFamily,
  'harness host': getComputedStyle(document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)})).fontFamily,
}))()`;

/** @internal The problem of a state whose app element renders in another first font family than the design frame root. */
export const appFontProblemOf = (options: { element: string; app: string; design: string }) =>
  `the app's ${options.element} renders in ${firstFamilyOf(options.app)}, but the design's root font is ${firstFamilyOf(options.design)} - compare draws the part in the design's font, so it cannot see this`;

/** @internal The first app element whose first font family differs from the design frame root's, or null. */
export const appFontMissOf = (options: { fonts: Record<string, string>; design: string }) => {
  const design = firstFamilyOf(options.design);
  const missed = Object.entries(options.fonts).find(([, app]) => firstFamilyOf(app) !== design);

  return missed ? { element: missed[0], app: missed[1], design: options.design } : null;
};

const STYLE_RULES_WALK = `const rules = [];
  const walk = (list) => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) rules.push(rule);
      if (rule.cssRules) walk(rule.cssRules);
    }
  };

  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {}
  }`;

const STYLE_SELECTORS_SCRIPT = `(() => {
  ${STYLE_RULES_WALK}

  return rules.map((rule) => rule.selectorText);
})()`;

const forceStylesScriptOf = (changed: [number, string][]) => `(() => {
  ${STYLE_RULES_WALK}

  for (const [at, selector] of ${JSON.stringify(changed)}) if (rules[at]) rules[at].selectorText = selector;
})()`;

/** Rewrites the interaction pseudos of every style rule on `page`, so an element with `data-et-force` draws forced as in a design frame. */
const forceStylesOf = async (page: Page) => {
  const selectors = (await page.evaluate(STYLE_SELECTORS_SCRIPT)) as string[];
  const changed = selectors.flatMap((selector, at): [number, string][] => {
    const forced = forcedSelectorOf(selector);

    return forced === selector ? [] : [[at, forced]];
  });

  if (changed.length > 0) await page.evaluate(forceStylesScriptOf(changed));
};

const lookMissesScriptOf = (looks: FrameLook[]) => `(() => ${JSON.stringify(looks)}.filter(({ look, selector }) => {
  try {
    return !document.querySelector('.' + CSS.escape(look) + ' ' + selector);
  } catch {
    return false;
  }
}))()`;

/** @internal The problem of a state whose app draws no element a look of the design targets. */
export const lookMissProblemOf = ({ look, selector, part }: FrameLook) =>
  `the look "${look}" targets "${selector}" in ${part}, but no element inside the app's element with that look matches it`;

const MOUNTED_INPUTS_SCRIPT = `(() => {
  const mounted = document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)})?.firstElementChild;
  const ng = window.ng;

  if (!mounted || !ng?.getComponent || !ng.getDirectiveMetadata) return null;

  const component = ng.getComponent(mounted);
  const inputs = component ? ng.getDirectiveMetadata(component)?.inputs : null;

  return inputs ? Object.keys(inputs) : null;
})()`;

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const clickOpen = async (options: {
  page: Page;
  host: ReturnType<Page['locator']>;
  url: string;
  control: string;
  markup: string;
  timeout: number;
}) => {
  const { page, host, url, control, timeout } = options;
  const scratch = await page.context().newPage();
  let name: { label: string | null; text: string } | null;

  try {
    await scratch.setContent(options.markup);
    const trigger = scratch.locator(`[data-et-control=${JSON.stringify(control)}]`).first();

    name =
      (await trigger.count()) === 0
        ? null
        : {
            label: await trigger.getAttribute('aria-label'),
            text: ((await trigger.textContent()) ?? '').replace(/\s+/g, ' ').trim(),
          };
  } finally {
    await scratch.close();
  }

  if (name === null)
    throw new HarnessError(`the design picture has no [data-et-control="${control}"] trigger to click open`);

  const triggerIn = (scope: ReturnType<Page['locator']>) => {
    const triggers = scope.locator('[aria-expanded]');

    return name.label === null
      ? triggers.filter({ hasText: name.text })
      : triggers.and(scope.locator(`[aria-label=${JSON.stringify(name.label)}]`));
  };
  const trigger = triggerIn(host)
    .or(triggerIn(page.locator(OVERLAY_ROOTS)))
    .first();
  const named = name.label ?? name.text;

  await trigger.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new HarnessError(
      `the harness page ${url} has no [aria-expanded] trigger named "${named}" to click control ${control} open`,
    );
  });
  await trigger.click({ timeout });
  await page.mouse.move(-1, -1);
  await trigger
    .and(page.locator('[aria-expanded="true"]'))
    .waitFor({ timeout })
    .catch(() => {
      throw new HarnessError(`a click on "${named}" in ${url} did not open control ${control}`);
    });
};

const OVERLAY_ROOTS = '.et-overlay-runtime-root, .cdk-overlay-container';

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/**
 * The number of overlay panes a design picture draws: each `<et-overlay-container>`, `.et-overlay-runtime-pane`,
 * `<et-menu>` and `<et-select-panel>` mock, as the app renders each of them in a pane of its own. A mock inside a
 * `hidden` element draws none.
 */
export const drawnPaneCountOf = (markup: string) => {
  const open: { tag: string; hidden: boolean }[] = [];
  let count = 0;

  for (const [whole, closing, tag = '', attributes = ''] of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)(\s[^>]*)?>/g)) {
    if (closing) {
      const at = open.map((element) => element.tag).lastIndexOf(tag);

      if (at >= 0) open.length = at;

      continue;
    }

    const hidden =
      !!open[open.length - 1]?.hidden || /\shidden(?=[\s=/>]|$)/.test(attributes.replace(/"[^"]*"/g, '""'));

    if (
      !hidden &&
      (['et-overlay-container', 'et-menu', 'et-select-panel'].includes(tag) ||
        /\sclass="(?:[^"]*\s)?et-overlay-runtime-pane[\s"]/.test(attributes))
    )
      count++;

    if (!VOID_TAGS.has(tag.toLowerCase()) && !whole.endsWith('/>')) open.push({ tag, hidden });
  }

  return count;
};

const FORCED_POLL_MS = 50;

const escapedForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one visible app element named as the design's `forced` element: by `aria-label`, else by role or tag and whole
 * text. It looks in the harness host first and in the overlay roots only when the host has none.
 */
const forcedTargetOf = async (options: {
  page: Page;
  host: ReturnType<Page['locator']>;
  forced: ForcedElement;
  url: string;
  timeout: number;
}) => {
  const { page, host, forced, url, timeout } = options;
  const { interaction, label, role, text } = forced;

  if (label === null && text === '')
    throw new UndrivableError(
      `the design forces ${interaction} on a <${role}> without an aria-label or text - compare cannot find it in the app`,
    );

  const named = label === null ? `the ${role} "${text}"` : `the aria-label "${label}"`;
  const matchesIn = (scope: ReturnType<Page['locator']>) =>
    (label === null
      ? scope
          .locator(`[role=${JSON.stringify(role)}]${/^[a-z][\w-]*$/i.test(role) ? `, ${role}:not([role])` : ''}`)
          .filter({
            hasText: new RegExp(`^\\s*${[...text.replace(/\s+/g, '')].map(escapedForRegExp).join('\\s*')}\\s*$`),
          })
      : scope.locator(`[aria-label=${JSON.stringify(label)}]`)
    ).filter({ visible: true });
  const deadline = Date.now() + timeout;

  for (;;) {
    for (const scope of [host, page.locator(OVERLAY_ROOTS)]) {
      const matches = matchesIn(scope);
      const count = await matches.count();

      if (count === 1) return matches;
      if (count > 1)
        throw new UndrivableError(
          `the harness page ${url} has ${count} elements with ${named} to force ${interaction} on`,
        );
    }

    if (Date.now() > deadline)
      throw new UndrivableError(`the harness page ${url} has no element with ${named} to force ${interaction} on`);

    await page.waitForTimeout(FORCED_POLL_MS);
  }
};

/**
 * A PNG of the harness host element at `url`, in the viewport of `size` at device scale 1, or without `size` fitted
 * as a design frame fits its root, with its overflowing positioned descendants and rounded to whole pixels, with the
 * pointer off the page, after a pointer click on the app trigger of the design `markup`'s `[data-et-control]` named
 * `opened`, and with each `forced` element hovered, pressed or keyboard-focused as the design picture forces it.
 * With `roomAbove`, for a design picture drawn above its part root, the fitted host gets room above and before it, so
 * an overlay that opens above neither flips below nor shifts off the viewport edge, and the shot grows up as well.
 * Without `size`, a `width` sets the viewport and the host to that width, as a design frame draws a part with `widths`.
 */
export const harnessShotOf = async (options: {
  browser: Browser;
  url: string;
  size?: DesignPreset | null;
  width?: number | null;
  forced?: ForcedElement[];
  /** Draws the app's `data-et-force` elements forced, for a design that forces elements of framed drawings. */
  forcesInFrames?: boolean;
  /** Fails with the first look whose selector matches nothing inside the app's elements with that look. */
  looks?: FrameLook[];
  opened?: { control: string; markup: string };
  roomAbove?: boolean;
  panes?: number;
  frozen?: FrozenAnimation[];
  timeout?: number;
  /** The design frame root's text style, set on the host so a part that inherits its type draws in the design's, not the app body's. */
  ambient?: TextAmbient;
  /** Fails with the props the mounted component has no input for, but `designOnly`; skipped in a production build. */
  props?: { sent: unknown; designOnly: ReadonlySet<string> };
  /** Records the steps of the shot as `<phase> load|prepare|drive|settle|screenshot` timing phases. */
  phase?: string;
}) => {
  const { browser, url } = options;
  const step = <T>(name: string, run: () => Promise<T>) =>
    options.phase ? timedPhase(`${options.phase} ${name}`, run) : run();
  const timeout = options.timeout ?? DRAW_TIMEOUT_MS;
  const room = !options.size && !!options.roomAbove;
  const width = options.size ? null : (options.width ?? null);
  const viewport = { ...viewportOf(options.size ?? null), ...(width ? { width } : {}) };
  const context = await step('context', () =>
    browser.newContext({
      viewport: room ? { width: viewport.width + ROOM_PX, height: viewport.height + ROOM_PX } : viewport,
      deviceScaleFactor: 1,
    }),
  );

  try {
    const page = await context.newPage();
    const sdkErrors = watchSdkErrors(page);
    const host = page.locator(HARNESS_HOST_SELECTOR).first();

    await step('load', async () => {
      await page.goto(url, { timeout }).catch((error: unknown) => {
        throw new HarnessError(`the harness page ${url} did not load: ${messageOf(error).split('\n')[0] ?? ''}`);
      });

      await host.waitFor({ state: 'visible', timeout }).catch(() => {
        throw new HarnessError(
          `the harness page ${url} showed no ${HARNESS_HOST_SELECTOR} element within ${timeout} ms - does the app serve the design harness route?`,
        );
      });
    });

    if (width)
      await page.evaluate(
        `document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)}).style.width = '${width}px'`,
      );

    if (options.ambient) {
      const fonts = (await page.evaluate(APP_FONTS_SCRIPT)) as Record<string, string>;
      const missed = appFontMissOf({ fonts, design: options.ambient.fontFamily });

      if (missed) throw new AppFontError(appFontProblemOf(missed));
    }

    if (options.ambient)
      await page.evaluate(
        `Object.assign(document.querySelector(${JSON.stringify(HARNESS_HOST_SELECTOR)}).style, ${JSON.stringify(options.ambient)})`,
      );

    await step('fonts', () => awaitFonts(page));

    if (options.props) {
      const inputs = (await page.evaluate(MOUNTED_INPUTS_SCRIPT)) as string[] | null;
      const dropped = inputs ? droppedPropsOf({ props: options.props.sent, inputs, ...options.props }) : [];

      if (dropped.length > 0)
        throw new DroppedPropsError(
          `the design prop${dropped.length > 1 ? 's' : ''} ${dropped.join(', ')} ${dropped.length > 1 ? 'have' : 'has'} no input on the app component - the harness drops ${dropped.length > 1 ? 'them' : 'it'}, so compare cannot check this state`,
        );
    }

    if (room) await page.evaluate(`document.documentElement.style.padding = '${ROOM_PX}px 0 0 ${ROOM_PX}px'`);

    await page.mouse.move(-1, -1);

    const { opened } = options;

    if (opened) await step('open', () => clickOpen({ page, host, url, timeout, ...opened }));

    for (const forced of options.forced ?? []) {
      const { interaction } = forced;
      const element = await forcedTargetOf({ page, host, forced, url, timeout });

      if (interaction === 'hover') await element.hover({ timeout });
      else if (interaction === 'active') {
        await element.hover({ timeout });
        await page.mouse.down();
      } else if (interaction === 'focus-visible') {
        await page.keyboard.press('Shift');
        await element.focus({ timeout });
      } else
        throw new UndrivableError(`compare cannot force ${interaction} on "${forced.label ?? forced.text}" in the app`);
    }

    const panes = options.panes ?? 0;
    const { settled, opened: openedPanes } = await step('settle', () =>
      settledPanesOf({ page, count: panes, timeout }),
    );

    if (!settled)
      throw new HarnessError(`the harness page ${url} did not settle its overlay panes within ${timeout} ms`);

    if (openedPanes !== null) throw new MissingPanesError(missingPanesProblemOf({ drawn: panes, opened: openedPanes }));

    if (options.frozen?.length) await page.evaluate(freezeAnimationsScriptOf(options.frozen));

    if (options.looks?.length) {
      const [missed] = (await page.evaluate(lookMissesScriptOf(options.looks))) as FrameLook[];

      if (missed) throw new LookMissError(lookMissProblemOf(missed));
    }

    if (options.forcesInFrames) await forceStylesOf(page);

    if (options.size && (await page.locator(OVERLAY_PANES).count()) === 0) {
      const hostBox = await host.evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();

        return { x: Math.round(x + scrollX), y: Math.round(y + scrollY) };
      });

      await page.evaluate(checkerScriptOf(hostBox));

      const png = await step('screenshot', () => host.screenshot({ type: 'png', animations: 'disabled', timeout }));

      const sdkProblem = sdkErrors(`the harness page ${url}`);

      if (sdkProblem) throw new HarnessError(sdkProblem);

      return png;
    }

    // Waits for a stable host as an element screenshot does; without it an overlay a click opened is not drawn yet.
    await step('stable', () => host.scrollIntoViewIfNeeded({ timeout }));

    const box = (await page.evaluate(hostBoxScriptOf({ up: room }))) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const clip = pixelBoxOf(box);

    await page.evaluate(checkerScriptOf(clip));

    const png = await step('screenshot', () =>
      page.screenshot({
        type: 'png',
        fullPage: true,
        animations: 'disabled',
        clip,
        timeout,
      }),
    );

    const sdkProblem = sdkErrors(`the harness page ${url}`);

    if (sdkProblem) throw new HarnessError(sdkProblem);

    return png;
  } finally {
    await context.close();
  }
};
