import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { chromium, type Browser, type CDPSession, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readConfig } from './design-config';
import { createDesignServer } from './serve';
import { settleFrames } from './settle-frames';
import { partKeyOf } from './system/resolve-product';
import { reachableBaseOf } from './system/served-cache';
import { createSystemModules, productModuleIdOf } from './system/system-modules';
import { openFrame, switchFrame } from './thumb';

// A worker thread cannot load the TypeScript source of the render worker, so the parts drawn by an app render need it bundled.
vi.mock('./package-root', async (importOriginal) => {
  const { buildSync } = await import('esbuild');
  const { mkdtempSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const original = await importOriginal<typeof import('./package-root')>();
  const worker = join(mkdtempSync(join(tmpdir(), 'font-proof-')), 'render-worker.js');

  buildSync({
    entryPoints: [join(__dirname, 'render-worker.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    outfile: worker,
    logLevel: 'error',
  });

  return {
    ...original,
    packageFileOf: (file: string) => (file.endsWith('render-worker.js') ? worker : original.packageFileOf(file)),
  };
});

const TARGET = resolve(__dirname, '../../../../..');
const RED_FILE = resolve(__dirname, 'font-proof-red.json');
const SHOWN_PER_ENTRY = 5;
const UNDRAWN_TEXT = new Set(['STYLE', 'SCRIPT', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);

type Property = 'faces' | 'text' | 'undrawn';
type Entry = { product: string; part: string; property: Property; count: number };
type Measured = Entry & { details: string[] };

type DomNode = {
  nodeId: number;
  nodeType: number;
  nodeName: string;
  nodeValue: string;
  attributes?: string[];
  children?: DomNode[];
  shadowRoots?: DomNode[];
  contentDocument?: DomNode;
};

type PlatformFont = { familyName: string; postScriptName?: string; isCustomFont: boolean };

const unloadedFaces = `(() => {
  const rules = [];
  const collect = (list) => {
    for (const rule of list) {
      if (rule instanceof CSSFontFaceRule) rules.push(rule);
      else if (rule instanceof CSSImportRule && rule.styleSheet) collect(rule.styleSheet.cssRules);
      else if (rule.cssRules) collect(rule.cssRules);
    }
  };
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) collect(sheet.cssRules);
  const unquoted = (family) => family.replace(/^["']|["']$/g, '');
  const seen = new Map();
  return Array.from(document.fonts).flatMap((face) => {
    const family = unquoted(face.family);
    const index = (seen.get(family) ?? -1) + 1;
    seen.set(family, index);
    if (face.status === 'loaded') return [];
    const rule = rules.filter((candidate) => unquoted(candidate.style.getPropertyValue('font-family')) === family)[index];
    const url = /url\\(["']?([^"')]+)/.exec(rule?.style.getPropertyValue('src') ?? '')?.[1] ?? 'no src';
    const src = url.startsWith('@assets') ? url : url.split('/').pop();
    return [family + ' ' + face.weight + ' ' + face.style + ': ' + face.status + ' (' + src + ')'];
  });
})()`;

const undrawnOf = `(() => {
  const root = document.documentElement;
  const why = root.getAttribute('data-et-error') ?? (root.hasAttribute('data-et-building') ? 'still building' : null);
  return why === null ? null : why.split('\\n').slice(0, 4).join(' | ');
})()`;

const segmentOf = (node: DomNode) => {
  const attributes = node.attributes ?? [];
  const classes = attributes[attributes.indexOf('class') + 1];
  const first = attributes.includes('class') ? classes?.trim().split(/\s+/)[0] : undefined;

  return `${node.nodeName.toLowerCase()}${first ? `.${first}` : ''}`;
};

const textElementsOf = (node: DomNode, path: string[] = []): { nodeId: number; path: string }[] => {
  const own = node.nodeType === 1 ? [...path, segmentOf(node)] : path;
  const children = node.children ?? [];
  const hasText =
    node.nodeType === 1 &&
    !UNDRAWN_TEXT.has(node.nodeName) &&
    children.some((child) => child.nodeType === 3 && child.nodeValue.trim() !== '');
  const nested = [...children, ...(node.shadowRoots ?? []), ...(node.contentDocument ? [node.contentDocument] : [])];

  return [
    ...(hasText ? [{ nodeId: node.nodeId, path: own.slice(-3).join(' > ') }] : []),
    ...nested.flatMap((child) => textElementsOf(child, own)),
  ];
};

const systemFontsOf = async (session: CDPSession) => {
  await session.send('DOM.enable');
  await session.send('CSS.enable');

  const { root } = (await session.send('DOM.getDocument', { depth: -1, pierce: true })) as unknown as {
    root: DomNode;
  };
  const failing = new Map<string, string>();

  for (const { nodeId, path } of textElementsOf(root)) {
    const { fonts } = (await session.send('CSS.getPlatformFontsForNode', { nodeId })) as unknown as {
      fonts: PlatformFont[];
    };
    const system = fonts.filter((font) => !font.isCustomFont).map((font) => font.familyName);

    if (system.length > 0) failing.set(path, `${path}: ${system.join(', ')}`);
  }

  return failing;
};

const facesOf = async (page: Page) =>
  (await Promise.all(page.frames().map((frame) => frame.evaluate(unloadedFaces) as Promise<string[]>))).flat();

const entryLineOf = ({ product, part, property, count }: Entry) => `${product} ${part} ${property} ${count}`;

const sortedEntries = <T extends Entry>(entries: T[]) =>
  [...entries].sort((a, b) => entryLineOf(a).localeCompare(entryLineOf(b)));

describe('fonts of every committed design part', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });
  });

  afterAll(() => browser?.close());

  it('fails exactly the parts the committed red list names', async (context) => {
    if (!browser) return context.skip('no browser');

    const cwd = process.cwd();
    const config = readConfig(TARGET) ?? {};
    const server = await createDesignServer({ target: TARGET, config, listen: true, port: 0 });
    const system = createSystemModules({ target: TARGET, config });
    const measured: Measured[] = [];
    const seconds: string[] = [];

    try {
      await server.listen();

      const address = server.httpServer?.address();

      if (!address || typeof address === 'string') throw new Error('the design server has no address');

      const base = reachableBaseOf(address);

      for (const product of system.products()) {
        const started = Date.now();
        const page = await browser.newPage();
        const session = await page.context().newCDPSession(page);

        try {
          for (const part of system.productOf(product)?.parts ?? []) {
            const key = partKeyOf(part);
            const module = (await server.ssrLoadModule(
              productModuleIdOf({ file: part.file, product, sketch: null }),
            )) as { default?: { states?: Record<string, unknown> } };
            const states = Object.keys(module.default?.states ?? {});
            const faces = new Set<string>();
            const text = new Map<string, string>();
            const undrawn = new Set<string>();

            for (const [index, state] of states.entries()) {
              if (index === 0 || !(await switchFrame(page, state)))
                await openFrame(
                  page,
                  `${base}/frame.html?${new URLSearchParams({ product, part: key, state, fit: '' })}`,
                );

              await settleFrames(page);

              const why = (await page.evaluate(undrawnOf)) as string | null;

              if (why !== null) {
                undrawn.add(`${state}: ${why}`);
                continue;
              }

              (await facesOf(page)).forEach((face) => faces.add(face));
              (await systemFontsOf(session)).forEach((line, path) => text.set(path, line));
            }

            if (states.length === 0) throw new Error(`${product} ${key} has no state to draw`);
            if (undrawn.size > 0)
              measured.push({ product, part: key, property: 'undrawn', count: undrawn.size, details: [...undrawn] });
            if (faces.size > 0)
              measured.push({ product, part: key, property: 'faces', count: faces.size, details: [...faces] });
            if (text.size > 0)
              measured.push({ product, part: key, property: 'text', count: text.size, details: [...text.values()] });
          }
        } finally {
          await page.close();
          seconds.push(`${product} ${Math.round((Date.now() - started) / 1000)} s`);
        }
      }
    } finally {
      await server.close();
      process.chdir(cwd);
    }

    console.log(`font proof: ${measured.length} red entries, ${seconds.join(', ')}`);
    if (process.env['FONT_PROOF_WRITE'])
      writeFileSync(
        RED_FILE,
        `${JSON.stringify(
          sortedEntries(measured).map(({ product, part, property, count }) => ({ product, part, property, count })),
          null,
          2,
        )}\n`,
      );

    const committed = new Set((JSON.parse(readFileSync(RED_FILE, 'utf8')) as Entry[]).map(entryLineOf));
    const seen = new Set(measured.map(entryLineOf));
    const problems = [
      ...sortedEntries(measured)
        .filter((entry) => !committed.has(entryLineOf(entry)))
        .map(
          (entry) =>
            `red, not in the list: ${entryLineOf(entry)}\n  ${entry.details.slice(0, SHOWN_PER_ENTRY).join('\n  ')}`,
        ),
      ...[...committed]
        .filter((line) => !seen.has(line))
        .sort()
        .map((line) => `in the list, not measured: ${line}`),
    ];

    expect(problems, problems.join('\n')).toEqual([]);
  }, 600_000);
});
