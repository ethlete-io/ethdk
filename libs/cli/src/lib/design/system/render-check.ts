import { AddressInfo } from 'net';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { PartAddress, partFrameOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, openFrame, settled, ThumbUnavailableError } from '../thumb';
import { partKeyOf } from './resolve-product';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system-modules';

/** One drawing of one state that breaks a render rule. `path` is a short selector path to the element. */
export type RenderIssue = {
  rule: string;
  product: string;
  part: string;
  state: string;
  size: string;
  path: string;
  detail: string;
  sketch: SketchVariant | null;
};

/** One state of a part that was drawn, at the size it was drawn in. */
export type RenderedState = Pick<RenderIssue, 'product' | 'part' | 'state' | 'size' | 'sketch'>;

/** The parts of one product to draw, as it draws or as one sketch variant draws it; every part when `parts` is null. */
export type RenderJob = { product: string; sketch: SketchVariant | null; parts: string[] | null };

type Found = { rule: string; path: string; detail: string };

type Frame = {
  address: PartAddress;
  size: string;
  search: string;
  viewport: { width: number; height: number };
  fixed: boolean;
  fit: boolean;
  skips: Record<string, string[]>;
};

type PartModule = { default?: { states?: unknown; widths?: unknown; checks?: { skip?: unknown } } };

export const renderIssueLineOf = (issue: RenderIssue) =>
  `${issue.rule} ${issue.product} ${issue.part} ${issue.state} at ${issue.size}: ${issue.path} - ${issue.detail}`;

const SINGLE_LINE =
  'button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [data-wireframe="button"], ' +
  '[data-wireframe="badge"], [data-wireframe="tabs"], [data-wireframe="segmented"], [data-wireframe="select"]';

/**
 * Reads the rule breaks in a drawn frame. A string, not a function: the build would add helpers to a
 * function that the page does not have.
 */
const ESCAPABLE = ['CLIPPED', 'WRAP'];

const inspectFrame = (options: { fixed: boolean; fit: boolean; skips: Record<string, string[]> }) => `((options) => {
  const root = document.getElementById('root');
  const refused = root.innerText.trim();
  if (refused.startsWith('design-explore:')) return [{ rule: 'RENDER', path: '#root', detail: refused.split('\\n')[0] }];

  const found = [];
  const seen = new Set();
  const skipsOf = (element) => {
    const skipped = new Set();
    for (let at = element; at && at !== root; at = at.parentElement) {
      for (const rule of (at.getAttribute('data-et-skip') ?? '').split(' ')) skipped.add(rule);
      for (const key of (at.getAttribute('data-et-part') ?? '').split(' '))
        for (const rule of options.skips[key] ?? []) skipped.add(rule);
    }
    return skipped;
  };
  const nameOf = (element) => {
    const tag = element.tagName.toLowerCase();
    const kit = element.getAttribute('data-wireframe');
    if (kit) return tag + '[data-wireframe=' + kit + ']';
    const part = element.getAttribute('data-et-part');
    if (part) return tag + '[data-et-part=' + part.split(' ')[0] + ']';
    const named = [...element.classList].find((name) => !/^et-(surface|color)--/.test(name));
    if (named) return tag + '.' + named;
    const same = [...(element.parentElement?.children ?? [])].filter((other) => other.tagName === element.tagName);
    return same.length > 1 ? tag + ':nth-of-type(' + (same.indexOf(element) + 1) + ')' : tag;
  };
  const pathOf = (element) => {
    const names = [];
    for (let at = element; at && at !== root && names.length < 4; at = at.parentElement) names.unshift(nameOf(at));
    return names.join(' > ');
  };
  const report = (rule, element, detail) => {
    const path = pathOf(element);
    if (skipsOf(element).has(rule) || seen.has(rule + path)) return;
    seen.add(rule + path);
    const escape = '; on purpose: data-et-skip="' + rule + '" on the element, or definePart({ checks: { skip: [\\'' + rule + '\\'] } })';
    found.push({ rule, path, detail: options.escapable.includes(rule) ? detail + escape : detail });
  };
  const sizeOf = (element) =>
    element.scrollWidth + 'x' + element.scrollHeight + ' in ' + element.clientWidth + 'x' + element.clientHeight;

  const partRoot = root.querySelector('[data-et-part]') ?? root.querySelector(':scope > :not(style)');
  if (!partRoot) return found;

  const sheets = [...document.styleSheets].map((sheet) => {
    try {
      return [...sheet.cssRules].map((rule) => rule.cssText).join('\\n');
    } catch {
      return '';
    }
  }).join('\\n');
  const themes = new Set([...sheets.matchAll(/\\.et-color--([\\w-]+)/g)].map((match) => match[1]));
  for (const element of root.querySelectorAll('[class*="et-color--"]'))
    for (const name of element.classList) {
      const theme = name.startsWith('et-color--') ? name.slice(10) : '';
      // the SDK's runtime marker for keeping the parent colour, not a theme
      if (theme && theme !== 'inherited' && !themes.has(theme)) report('UNKNOWN-THEME', element, 'colour theme "' + theme + '" is defined by no stylesheet of the frame, so it draws in the fallback colour');
    }

  const box = partRoot.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) {
    report('ZERO-SIZE', partRoot, 'drawn at ' + Math.round(box.width) + 'x' + Math.round(box.height));
    return found;
  }

  const page = document.documentElement;
  const frame = options.fit ? root : page;
  const right = options.fit ? root.getBoundingClientRect().right : page.clientWidth;
  if (frame.scrollWidth > frame.clientWidth || (options.fixed && page.scrollHeight > page.clientHeight)) {
    let furthest = partRoot;
    let most = 0;
    for (const element of root.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      const past = Math.max(rect.right + scrollX - right, options.fixed ? rect.bottom + scrollY - page.clientHeight : 0);
      if (past > 0 && past >= most) [furthest, most] = [element, past];
    }
    if (most === 0)
      for (const element of root.querySelectorAll('*'))
        if (element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX === 'visible') furthest = element;
    report('OVERFLOW', furthest, 'content ' + sizeOf(frame) + ' frame');
  }

  const clips = (value) => value === 'hidden' || value === 'clip';
  const drawnSizeOf = (element) => {
    if (!element.hasAttribute('data-et-embed-box')) return { width: element.scrollWidth, height: element.scrollHeight };
    const rect = element.firstElementChild.getBoundingClientRect();
    return { width: Math.floor(rect.width), height: Math.floor(rect.height) };
  };
  for (const element of root.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    const drawn = drawnSizeOf(element);
    const cutX = clips(style.overflowX) && drawn.width > element.clientWidth;
    const cutY = clips(style.overflowY) && drawn.height > element.clientHeight;
    const cutsOnPurpose = style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
    if ((cutX || cutY) && !cutsOnPurpose) report('CLIPPED', element, 'content ' + drawn.width + 'x' + drawn.height + ' in ' + element.clientWidth + 'x' + element.clientHeight);
  }

  const singleLine = (element) => {
    for (let at = element; at && at !== root; at = at.parentElement)
      if (at.matches(${JSON.stringify(SINGLE_LINE)}) || [...at.classList].some((name) => /(^|[-_])(badge|chip|pill|tab)$/.test(name)))
        return true;
    return false;
  };
  const groups = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    let block = node.parentElement;
    while (block && block !== root && ['inline', 'contents'].includes(getComputedStyle(block).display)) block = block.parentElement;
    if (!block || block === root) continue;
    groups.set(block, [...(groups.get(block) ?? []), node]);
  }
  for (const [block, nodes] of groups) {
    const style = getComputedStyle(block);
    if (!singleLine(block) && style.whiteSpace !== 'nowrap' && style.textWrapMode !== 'nowrap') continue;
    const lines = [];
    for (const node of nodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const middle = rect.top + rect.height / 2;
        if (rect.width > 0 && rect.height > 0 && !lines.some((line) => middle >= line.top && middle <= line.bottom))
          lines.push({ top: rect.top, bottom: rect.bottom });
      }
    }
    if (lines.length > 1) {
      const text = block.textContent.trim().replace(/\\s+/g, ' ');
      report('WRAP', block, '"' + (text.length > 32 ? text.slice(0, 31) + '…' : text) + '" breaks onto ' + lines.length + ' lines');
    }
  }

  return found;
})(${JSON.stringify({ ...options, escapable: ESCAPABLE })})`;

const stringsOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const widthsOf = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((width): width is number => typeof width === 'number' && Number.isInteger(width) && width > 0)
    : [];

const inspect = async (options: { browser: Browser; base: string; frames: Frame[] }) => {
  const { browser, base, frames } = options;
  const context = await browser.newContext();
  const issues: RenderIssue[] = [];

  try {
    const page = await context.newPage();

    for (const frame of frames) {
      await page.setViewportSize(frame.viewport);
      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.evaluate(settled);

      const found = (await page.evaluate(
        inspectFrame({ fixed: frame.fixed, fit: frame.fit, skips: frame.skips }),
      )) as Found[];
      const { product, part, state, sketch } = frame.address;

      issues.push(...found.map((issue) => ({ ...issue, product, part, state, sketch, size: frame.size })));
    }
  } finally {
    await context.close();
  }

  return issues;
};

/**
 * Draws every state of the parts of each job in one headless Chromium, on one page of a design server of
 * its own: a page at each product preset, a part with `widths` at each width, any other part fitted to
 * its content. Answers the rule breaks it finds, or why it could not draw.
 */
export const renderIssuesOf = async (options: {
  target: string;
  config: DesignConfig;
  jobs: RenderJob[];
  chromiumOf?: typeof chromiumOf;
}): Promise<{ issues: RenderIssue[]; drawn: RenderedState[] } | { unavailable: string }> => {
  const { target, config, jobs } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;

  if (jobs.length === 0) return { issues: [], drawn: [] };

  if (!(await resolveChromium(target)))
    return { unavailable: 'neither the checkout nor this package resolves playwright or playwright-core' };

  const queue = createDrawQueue({ target, chromiumOf: resolveChromium });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const base = `http://localhost:${port}`;
    const system = createSystemModules({ target, config });
    const frames: Frame[] = [];
    const issues: RenderIssue[] = [];
    for (const { product, sketch, parts } of jobs) {
      const skips: Record<string, string[]> = {};

      const drawn = system.drawnOf(product, sketch);

      if (!drawn) continue;

      for (const part of drawn.parts) {
        const key = partKeyOf(part);
        const loaded = await server
          .ssrLoadModule(productModuleIdOf({ file: part.file, product, sketch }))
          .then((module) => ({ module: module as PartModule }))
          .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));

        if ('error' in loaded) {
          if (!parts || parts.includes(key))
            issues.push({
              rule: 'RENDER',
              product,
              part: key,
              state: '-',
              size: '-',
              path: '-',
              detail: loaded.error.split('\n')[0] ?? '',
              sketch,
            });

          continue;
        }

        const definition = loaded.module.default;

        skips[key] = stringsOf(definition?.checks?.skip);

        if (parts && !parts.includes(key)) continue;

        const states =
          definition?.states && typeof definition.states === 'object' ? Object.keys(definition.states) : [];
        const widths = widthsOf(definition?.widths);
        const sizes: { preset: string | null; width: number | null }[] =
          part.layer === 'pages'
            ? Object.keys(drawn.presets).map((preset) => ({ preset, width: null }))
            : widths.length > 0
              ? widths.map((width) => ({ preset: null, width }))
              : [{ preset: null, width: null }];

        for (const state of states) {
          for (const { preset, width } of sizes) {
            const address = { product, part: key, state, preset, width, sketch, interaction: null };
            const frame = partFrameOf({ system, ...address });

            if (frame instanceof Error) continue;

            frames.push({
              address,
              size: preset ?? (width ? `${width}px` : 'fitted'),
              search: frame.search.toString(),
              viewport: viewportOf(frame.size),
              fixed: frame.size?.height !== undefined,
              fit: frame.size === null,
              skips,
            });
          }
        }
      }
    }

    issues.push(...(await queue.run((browser) => inspect({ browser, base, frames }))));

    return {
      issues,
      drawn: frames.map(({ address }) => ({
        product: address.product,
        part: address.part,
        state: address.state,
        size: address.preset ?? (address.width ? `${address.width}px` : 'fitted'),
        sketch: address.sketch,
      })),
    };
  } catch (error) {
    if (error instanceof ThumbUnavailableError) return { unavailable: error.message };

    throw error;
  } finally {
    await Promise.all([queue.close(), server.close()]);
  }
};
