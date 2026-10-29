import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { workRootOf } from './paths';
import { assetFileOf, assetPathOf } from './system/assets';
import { argsOf, configOf, oneProductOf } from './system/sketch/cli-args';
import { TOKENS_PART } from './system/resolve-product';
import { createSystemModules } from './system/system-modules';
import { createDrawQueue, ThumbUnavailableError } from './thumb';

export const ASSET_SHOT_USAGE = 'shot --asset <file> [--product <name>] [--width <px>] [--out <file>]';

export const TOKEN_USAGE = 'token <name> [--product <name>] [--hex]';

const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

/** The file inlined as a `data:` URL, or `null` for an extension that is not an image. */
export const dataUrlOf = (options: { file: string; content: Buffer }) => {
  const type = MIME_TYPES[extname(options.file).toLowerCase()];

  return type ? `data:${type};base64,${options.content.toString('base64')}` : null;
};

/** `#rrggbb`, or `#rrggbbaa` when the colour is not opaque. */
export const hexOf = ([r, g, b, a]: readonly number[]) => {
  const part = (value: number | undefined) =>
    Math.max(0, Math.min(255, Math.round(value ?? 0)))
      .toString(16)
      .padStart(2, '0');

  return `#${part(r)}${part(g)}${part(b)}${(a ?? 255) < 255 ? part(a) : ''}`;
};

/** The custom property name with its leading dashes; `--color-x` and `color-x` both name `--color-x`. */
export const propertyOf = (name: string) => (name.startsWith('--') ? name : `--${name}`);

const assetPageOf = (url: string) =>
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}img{display:block}</style><img id="asset" src="${url}">`;

const decodeAsset = `(async () => {
  const image = document.getElementById('asset');
  await image.decode().catch(() => undefined);
  return image.naturalWidth > 0;
})()`;

const colorOf = (property: string) => `(() => {
  const property = ${JSON.stringify(property)};
  const probe = document.getElementById('probe');
  probe.style.color = 'var(' + property + ')';
  if (!getComputedStyle(document.documentElement).getPropertyValue(property).trim()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = getComputedStyle(probe).color;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
})()`;

const fail = (message: string) => {
  console.error(message);

  return 1;
};

const queueError = (error: unknown) => {
  if (error instanceof ThumbUnavailableError) return fail(error.message);

  throw error;
};

/** `et design shot --asset <file>` draws an image file, inlined, into a PNG and prints where it wrote it. */
export const designAssetShot = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--asset', '--product', '--width', '--out']);
  const usage = `usage: ${invocation} ${ASSET_SHOT_USAGE}`;

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const asked = args.values['--asset'];
  const width = args.values['--width'] === undefined ? null : Number(args.values['--width']);

  if (!asked || args.positional.length > 0 || (width !== null && !(Number.isInteger(width) && width > 0))) {
    console.error(usage);

    return 2;
  }

  let file = [resolve(asked), resolve(target, asked)].find((path) => existsSync(path) && statSync(path).isFile());

  if (!file && args.values['--product'] !== undefined) {
    const config = configOf(target);

    if (typeof config === 'string') return fail(config);

    const resolved = oneProductOf({ target, config, asked: args.values['--product'] });

    if (typeof resolved === 'string') return fail(resolved);

    file = assetFileOf({ product: resolved, path: assetPathOf(asked) ?? asked }) ?? undefined;
  }

  if (!file) return fail(`design-explore: no asset file "${asked}"`);

  const url = dataUrlOf({ file, content: readFileSync(file) });

  if (!url) return fail(`design-explore: "${file}" is not an image (${Object.keys(MIME_TYPES).join(' ')})`);

  const queue = createDrawQueue({ target });

  try {
    const png = await queue.run(async (browser) => {
      const page = await browser.newPage({ viewport: { width: width ?? 800, height: 600 } });

      try {
        await page.setContent(assetPageOf(url));

        const decoded = (await page.evaluate(decodeAsset)) as boolean;

        if (!decoded) throw new ThumbUnavailableError(`design-explore: "${file}" did not decode as an image`);

        if (width !== null) await page.evaluate(`document.getElementById('asset').style.width = '${width}px'`);

        return await page.locator('#asset').screenshot();
      } finally {
        await page.close();
      }
    });
    const out = resolve(
      target,
      args.values['--out'] ?? `${workRootOf(target)}/shots/asset-${file.split(/[\\/]/).pop()}.png`,
    );

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png);
    console.log(out);

    return 0;
  } catch (error) {
    return queueError(error);
  } finally {
    await queue.close();
  }
};

/**
 * `et design token <name> [--product <name>] --hex` prints the colour a custom property of the product's tokens
 * resolves to, so oklch and color-mix values come out as hex.
 */
export const designToken = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product']);
  const usage = `usage: ${invocation} ${TOKEN_USAGE}`;

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const [name, ...extra] = args.positional;

  if (!name || extra.length > 0) {
    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  const resolved = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof resolved === 'string') return fail(resolved);

  const css = createSystemModules({ target, config }).partOf({ product: resolved.name, part: TOKENS_PART })?.css;

  if (!css || !existsSync(css))
    return fail(`design-explore: product "${resolved.name}" has no ${TOKENS_PART} stylesheet`);

  const property = propertyOf(name);
  const queue = createDrawQueue({ target });

  try {
    const rgba = await queue.run(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setContent('<!doctype html><html><body><div id="probe"></div></body></html>');
        await page.addStyleTag({ content: readFileSync(css, 'utf8') });

        return (await page.evaluate(colorOf(property))) as number[] | null;
      } finally {
        await page.close();
      }
    });

    if (!rgba) return fail(`design-explore: product "${resolved.name}" tokens define no ${property}`);

    console.log(hexOf(rgba));

    return 0;
  } catch (error) {
    return queueError(error);
  } finally {
    await queue.close();
  }
};
