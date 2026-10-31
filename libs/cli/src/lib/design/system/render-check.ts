import { AddressInfo } from 'net';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import {
  ColorScheme,
  ContrastOptions,
  schemesOf,
  CONTRAST_STATEMENTS,
  contrastExceptionsOf,
  contrastPairsOf,
} from './contrast-check';
import { controlStateGapsOf } from './complete';
import { classesOf, cssBlocksOf } from './css-source';
import { createDesignServer } from '../serve';
import { PartAddress, partFrameOf, viewportOf } from '../shot';
import { Browser, createDrawQueue, openFrame, settled, ThumbUnavailableError } from '../thumb';
import { gridReportOf } from './list-system';
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
  namespaces: string[];
  contrast: ContrastOptions;
};

type PartModule = {
  default?: {
    states?: unknown;
    controls?: unknown;
    widths?: unknown;
    grid?: unknown;
    checks?: { skip?: unknown };
    contrast?: { pairs?: unknown; exceptions?: unknown };
  };
};

/** The summary line of the `grid` of a drawn part. */
export type RenderedGrid = Pick<RenderIssue, 'product' | 'part' | 'sketch'> & { line: string };

export const renderIssueLineOf = (issue: RenderIssue) =>
  `${issue.rule} ${issue.product} ${issue.part} ${issue.state} at ${issue.size}: ${issue.path} - ${issue.detail}`;

const SCHEME_IN_DETAIL = / in the (light|dark) scheme/u;

/** The render issues as lines, one per finding that repeats across states, sizes, schemes and variants, with where it was found. */
export const groupedIssueLinesOf = (issues: RenderIssue[]) => {
  const groups = new Map<string, { first: RenderIssue; issues: RenderIssue[] }>();

  for (const issue of issues) {
    const key = JSON.stringify([
      issue.sketch?.target ?? '',
      issue.rule,
      issue.product,
      issue.part,
      issue.path,
      issue.detail.replace(SCHEME_IN_DETAIL, ''),
    ]);
    const group = groups.get(key) ?? { first: issue, issues: [] };

    group.issues.push(issue);
    groups.set(key, group);
  }

  const listOf = (values: string[]) => [...new Set(values)].join(', ');

  return [...groups.values()].map(({ first, issues: found }) => {
    const schemes = [...new Set(found.flatMap((issue) => SCHEME_IN_DETAIL.exec(issue.detail)?.[1] ?? []))];
    const detail = first.detail.replace(SCHEME_IN_DETAIL, ` in the ${schemes.join(' and ')} scheme`);
    const variants = listOf(found.map((issue) => issue.sketch?.variant ?? ''));
    const where = `${listOf(found.map((issue) => issue.state))} at ${listOf(found.map((issue) => issue.size))}`;
    const times = found.length > 1 ? ` (${found.length} times)` : '';

    return `${first.sketch?.target ?? ''} ${variants}: ${first.rule} ${first.product} ${first.part} ${where}: ${first.path} - ${detail}${times}`;
  });
};

const SINGLE_LINE =
  'button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [data-wireframe="button"], ' +
  '[data-wireframe="badge"], [data-wireframe="tabs"], [data-wireframe="segmented"], [data-wireframe="select"]';

/**
 * Reads the rule breaks in a drawn frame. A string, not a function: the build would add helpers to a
 * function that the page does not have.
 */
const ESCAPABLE = ['CLIPPED', 'WRAP'];

const WARNING_RULES = new Set(['UNDEFINED-CLASS', 'EMBED-SCALE']);

const inspectFrame = (options: {
  fixed: boolean;
  fit: boolean;
  skips: Record<string, string[]>;
  namespaces: string[];
  contrast: ContrastOptions;
}) => `((options) => {
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
  const defined = new Set([...sheets.matchAll(/\\.(-?[_a-zA-Z][\\w-]*)/g)].map((match) => match[1]));
  for (const element of root.querySelectorAll('[class]')) {
    const missing = [...element.classList].filter((name) => options.namespaces.some((prefix) => name.startsWith(prefix)) && !defined.has(name));
    if (missing.length > 0) report('UNDEFINED-CLASS', element, 'class ' + missing.map((name) => '"' + name + '"').join(', ') + ' is defined by no stylesheet of the frame');
  }
  const hostScaleOf = (element) => {
    const style = getComputedStyle(element);
    const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
    if (matrix && (Math.abs(matrix.a - 1) > 0.001 || Math.abs(matrix.d - 1) > 0.001)) return 'transform ' + style.transform;
    if (style.scale && style.scale !== 'none' && style.scale !== '1') return 'scale ' + style.scale;
    if (style.zoom && style.zoom !== '1' && style.zoom !== 'normal') return 'zoom ' + style.zoom;
    return null;
  };
  for (const frame of root.querySelectorAll('iframe[data-et-embed-scale]')) {
    if (Number(frame.getAttribute('data-et-embed-scale')) === 1) continue;
    for (let at = frame.parentElement; at && at !== root.parentElement; at = at.parentElement) {
      const scale = at.hasAttribute('data-et-embed-box') ? null : hostScaleOf(at);
      if (scale) {
        report('EMBED-SCALE', at, 'scales an embedPage of scale ' + frame.getAttribute('data-et-embed-scale') + ' with ' + scale + ', so the page shrinks twice: set the scale in one place');
        break;
      }
    }
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

  const px = (value) => parseFloat(value) || 0;
  const invisible = (colour) => colour === 'transparent' || /^rgba\\(.*,\\s*0\\)$/.test(colour);
  const frameBox = () => {
    if (options.fit) return { name: 'the frame', box: root.getBoundingClientRect() };
    const bottom = options.fixed ? page.clientHeight - scrollY : Infinity;
    return { name: 'the frame', box: { left: -scrollX, right: page.clientWidth - scrollX, top: options.fixed ? -scrollY : -Infinity, bottom } };
  };
  const clipOf = (from) => {
    for (let at = from; at && at !== root; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
      const rect = at.getBoundingClientRect();
      const left = rect.left + at.clientLeft;
      const top = rect.top + at.clientTop;
      const box = {
        left: style.overflowX === 'visible' ? -Infinity : left,
        right: style.overflowX === 'visible' ? Infinity : left + at.clientWidth,
        top: style.overflowY === 'visible' ? -Infinity : top,
        bottom: style.overflowY === 'visible' ? Infinity : top + at.clientHeight,
      };
      return { name: pathOf(at), box };
    }
    return frameBox();
  };
  const pastOf = (rect, reach, box) =>
    Math.max(
      rect.left >= box.left ? box.left - (rect.left - reach.left) : 0,
      rect.right <= box.right ? rect.right + reach.right - box.right : 0,
      rect.top >= box.top ? box.top - (rect.top - reach.top) : 0,
      rect.bottom <= box.bottom ? rect.bottom + reach.bottom - box.bottom : 0,
    );
  const shadowReachOf = (value) => {
    const reach = { left: 0, right: 0, top: 0, bottom: 0 };
    if (value === 'none') return reach;
    for (const shadow of value.split(/,(?![^(]*\\))/)) {
      if (/\\binset\\b/.test(shadow)) continue;
      const colour = shadow.match(/(rgba?|oklch|oklab|lab|lch|hsla?|color)\\([^)]*\\)|transparent/)?.[0] ?? '';
      if (invisible(colour)) continue;
      const [x = 0, y = 0, blur = 0, spread = 0] = [...shadow.replace(/\\w+\\([^)]*\\)/g, '').matchAll(/-?[\\d.]+px/g)].map((match) => px(match[0]));
      if (blur > 0) continue;
      reach.left = Math.max(reach.left, spread - x);
      reach.right = Math.max(reach.right, spread + x);
      reach.top = Math.max(reach.top, spread - y);
      reach.bottom = Math.max(reach.bottom, spread + y);
    }
    return reach;
  };
  for (const element of root.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const outline = style.outlineStyle !== 'none' && !invisible(style.outlineColor) ? Math.max(0, px(style.outlineWidth) + px(style.outlineOffset)) : 0;
    const shadow = shadowReachOf(style.boxShadow);
    const clip = clipOf(element.parentElement);
    const outlinePast = outline > 0 ? pastOf(rect, { left: outline, right: outline, top: outline, bottom: outline }, clip.box) : 0;
    const shadowPast = pastOf(rect, shadow, clip.box);
    if (outlinePast > 1) report('CLIPPED', element, 'outline ' + Math.round(outlinePast) + 'px past ' + clip.name);
    else if (shadowPast > 1) report('CLIPPED', element, 'box-shadow ' + Math.round(shadowPast) + 'px past ' + clip.name);
  }

  const metrics = document.createElement('canvas').getContext('2d');
  for (const element of root.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    if (!style.textDecorationLine.includes('underline') || invisible(style.textDecorationColor)) continue;
    const fontSize = px(style.fontSize);
    const thickness = /px$/.test(style.textDecorationThickness) ? px(style.textDecorationThickness) : Math.max(1, fontSize / 16);
    const offset = /px$/.test(style.textUnderlineOffset) ? px(style.textUnderlineOffset) : fontSize / 10;
    const below = offset + thickness + (style.textDecorationStyle === 'wavy' ? 3 : 0);
    const clip = clipOf(element);
    let most = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      metrics.font = getComputedStyle(node.parentElement).font;
      const descent = metrics.measureText(node.textContent).fontBoundingBoxDescent;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const baseline = rect.bottom - descent;
        if (rect.width > 0 && baseline <= clip.box.bottom) most = Math.max(most, baseline + below - clip.box.bottom);
      }
    }
    if (most > 1) report('CLIPPED', element, 'underline ' + Math.round(most) + 'px past ' + clip.name);
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
${CONTRAST_STATEMENTS}
  return found;
})(${JSON.stringify({ ...options, escapable: ESCAPABLE })})`;

const stringsOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const SDK_PREFIX = 'et-';

const namespacesOf = (cssSources: (string | null)[]) => [
  ...new Set(
    cssSources.flatMap((source) =>
      source
        ? cssBlocksOf(source)
            .selectors.flatMap(classesOf)
            .flatMap((name) => /^[a-z]{2,}-/.exec(name)?.[0] ?? [])
            .filter((prefix) => prefix !== SDK_PREFIX)
        : [],
    ),
  ),
];

const firstOfEach = (issues: RenderIssue[]) => {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = JSON.stringify([issue.sketch, issue.rule, issue.detail]);

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
};

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
      await page.emulateMedia({ colorScheme: frame.contrast.scheme });
      await page.setViewportSize(frame.viewport);
      await openFrame(page, `${base}/frame.html?${frame.search}`);
      await page.evaluate(settled);

      const found = (await page.evaluate(
        inspectFrame({
          fixed: frame.fixed,
          fit: frame.fit,
          skips: frame.skips,
          namespaces: frame.namespaces,
          contrast: frame.contrast,
        }),
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
}): Promise<
  | { issues: RenderIssue[]; warnings: RenderIssue[]; grids: RenderedGrid[]; drawn: RenderedState[] }
  | { unavailable: string }
> => {
  const { target, config, jobs } = options;
  const resolveChromium = options.chromiumOf ?? chromiumOf;

  if (jobs.length === 0) return { issues: [], warnings: [], grids: [], drawn: [] };

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
    const grids: RenderedGrid[] = [];
    const gridWarnings: RenderIssue[] = [];
    for (const { product, sketch, parts } of jobs) {
      const skips: Record<string, string[]> = {};

      const drawn = system.drawnOf(product, sketch);

      if (!drawn) continue;

      const namespaces = namespacesOf(drawn.parts.map((part) => part.cssSource));
      const schemes = schemesOf(drawn.parts.map((part) => part.cssSource));

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
        const grid = gridReportOf(definition?.grid, states);

        for (const gap of controlStateGapsOf({ part: key, controls: definition?.controls, states }))
          issues.push({
            rule: gap.code,
            product,
            part: key,
            state: '-',
            size: '-',
            path: '-',
            detail: gap.detail,
            sketch,
          });

        if (grid) {
          grids.push({ product, part: key, sketch, line: grid.line });
          grid.problems.forEach((detail) =>
            issues.push({ rule: 'GRID', product, part: key, state: '-', size: '-', path: '-', detail, sketch }),
          );
          grid.warnings.forEach((detail) =>
            gridWarnings.push({
              rule: 'GRID-COVERAGE',
              product,
              part: key,
              state: '-',
              size: '-',
              path: '-',
              detail,
              sketch,
            }),
          );
        }

        const exceptions = contrastExceptionsOf(definition?.contrast?.exceptions);
        const pairs = contrastPairsOf(definition?.contrast?.pairs);

        exceptions.problems.forEach((detail) =>
          issues.push({ rule: 'CONTRAST', product, part: key, state: '-', size: '-', path: '-', detail, sketch }),
        );

        const widths = widthsOf(definition?.widths);
        const sizes: { preset: string | null; width: number | null }[] =
          part.layer === 'pages'
            ? Object.keys(drawn.presets).map((preset) => ({ preset, width: null }))
            : widths.length > 0
              ? widths.map((width) => ({ preset: null, width }))
              : [{ preset: null, width: null }];

        const measuresPairs = new Set<ColorScheme | null>();

        for (const state of states) {
          for (const { preset, width } of sizes) {
            for (const scheme of schemes) {
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
                namespaces,
                contrast: {
                  exceptions: exceptions.selectors,
                  pairs: measuresPairs.has(scheme) ? [] : pairs,
                  scheme,
                },
              });
              measuresPairs.add(scheme);
            }
          }
        }
      }
    }

    const inspected = await queue.run((browser) => inspect({ browser, base, frames }));

    issues.push(...inspected.filter((issue) => !WARNING_RULES.has(issue.rule)));

    return {
      issues,
      warnings: [...gridWarnings, ...firstOfEach(inspected.filter((issue) => WARNING_RULES.has(issue.rule)))],
      grids,
      drawn: frames
        .filter(({ contrast }) => contrast.scheme !== 'dark')
        .map(({ address }) => ({
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
