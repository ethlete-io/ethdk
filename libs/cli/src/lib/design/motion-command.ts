import { mkdirSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { contactSheetOf, SheetCell } from './contact-sheet';
import { MOTION_MODES, MotionMode, MotionPictures } from './motion-shot';
import { workRootOf } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { shotProductOf } from './shot-command';
import { argsOf, configOf } from './system/sketch/cli-args';
import { createSystemModules, productModuleIdOf } from './system/system-modules';
import { createDrawQueue, ThumbUnavailableError } from './thumb';

export const MOTION_USAGE = `motion shots <layer>/<name> <motion> [--variant <key>] [--mode <${MOTION_MODES.join('|')}>] [--preset <preset> | --width <px>] [--scale <1-4>] [--product <name>] [--surface <name>] [--color <name>] [--out <file>]`;

type DeclaredMotion = { from: string; to: string; at?: number[]; interrupt?: number };

const motionsOf = (part: unknown): Record<string, DeclaredMotion> => {
  const motions = (part as { motions?: unknown } | undefined)?.motions;

  return motions && typeof motions === 'object' ? (motions as Record<string, DeclaredMotion>) : {};
};

/** The JSON `motion shots` writes next to its sheet: per mode the end, the keyframe times and the tracks. */
export const motionReportOf = (options: {
  product: string;
  part: string;
  motion: string;
  declared: DeclaredMotion;
  preset: string | null;
  width: number | null;
  drawn: Partial<Record<MotionMode, MotionPictures>>;
}) => ({
  product: options.product,
  part: options.part,
  motion: options.motion,
  from: options.declared.from,
  to: options.declared.to,
  interrupt: options.declared.interrupt ?? null,
  preset: options.preset,
  width: options.width,
  modes: Object.fromEntries(
    Object.entries(options.drawn).map(([mode, { end, tracks, keyframes }]) => [
      mode,
      { end, keyframes: keyframes.map((keyframe) => keyframe.ms), tracks },
    ]),
  ),
});

/** One line per mode: when the motion ends and what runs, or that it runs no animation. */
export const motionSummaryOf = (drawn: Partial<Record<MotionMode, MotionPictures>>) =>
  Object.entries(drawn).map(([mode, { end, tracks, keyframes }]) =>
    tracks.length === 0
      ? `${mode}: runs no animation`
      : `${mode}: ends at ${end} ms, ${tracks.length} track${tracks.length === 1 ? '' : 's'}, keyframes at ${keyframes.map((keyframe) => keyframe.ms).join(', ')} ms`,
  );

/**
 * `et design motion shots <layer>/<name> <motion>` draws a motion of a part at each keyframe time, in full and reduced
 * motion, into one contact sheet PNG with a row per mode, writes its tracks as JSON next to it, and prints both paths.
 */
export const designMotion = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, [
    '--product',
    '--variant',
    '--mode',
    '--preset',
    '--width',
    '--scale',
    '--surface',
    '--color',
    '--out',
  ]);
  const usage = `usage: ${invocation} ${MOTION_USAGE}`;

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const [command, part, motion, ...extra] = args.positional;
  const mode = args.values['--mode'];
  const width = args.values['--width'] === undefined ? null : Number(args.values['--width']);
  const preset = args.values['--preset'] ?? null;
  const scale = Number(args.values['--scale'] ?? 1);

  if (
    command !== 'shots' ||
    !part ||
    !motion ||
    extra.length > 0 ||
    args.flags.size > 0 ||
    (mode !== undefined && !(MOTION_MODES as readonly string[]).includes(mode)) ||
    (width !== null && !(Number.isInteger(width) && width > 0)) ||
    (preset && width) ||
    !(Number.isInteger(scale) && scale >= 1 && scale <= 4)
  ) {
    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  const resolved = shotProductOf({ target, config, asked: args.values['--product'], part });

  if (typeof resolved === 'string') {
    console.error(resolved);

    return 1;
  }

  const product = resolved.name;
  const system = createSystemModules({ target, config });
  const variant = args.values['--variant'];
  const sketch = variant === undefined ? null : { target: part, variant };
  const found = system.partOf({ product, part, sketch });

  if (!found) {
    console.error(
      sketch
        ? `design-explore: variant "${variant}" of the sketch on ${part} in product "${product}" has no part "${part}"`
        : `design-explore: product "${product}" has no part "${part}"`,
    );

    return 1;
  }

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await server.listen();

    const module = (await server.ssrLoadModule(productModuleIdOf({ file: found.file, product, sketch }))) as {
      default?: unknown;
    };
    const motions = motionsOf(module.default);
    const declared = motions[motion];

    if (!declared) {
      console.error(
        `design-explore: ${part} has no motion "${motion}" (motions: ${Object.keys(motions).join(', ') || 'none'})`,
      );

      return 1;
    }

    const presets = system.productOf(product)?.presets ?? {};
    const chosenPreset = preset ?? (part.startsWith('pages/') ? (Object.keys(presets)[0] ?? null) : null);
    const params = new URLSearchParams();

    for (const name of ['surface', 'color', 'scale']) {
      const value = args.values[`--${name}`];

      if (value) params.set(name, value);
    }

    const { port } = server.httpServer?.address() as AddressInfo;
    const shooter = createPartShooter({ target, base: `http://localhost:${port}`, system });

    try {
      const drawn: Partial<Record<MotionMode, MotionPictures>> = {};

      for (const shown of mode ? [mode as MotionMode] : MOTION_MODES) {
        drawn[shown] = await shooter.motionOf({
          product,
          part,
          state: declared.from,
          preset: chosenPreset,
          width: chosenPreset ? null : width,
          sketch,
          interaction: null,
          motion,
          at: declared.at,
          mode: shown,
          params,
        });
      }

      const rows: SheetCell[][] = Object.entries(drawn).map(([shown, { keyframes }]) =>
        keyframes.map(({ ms, png }) => ({ label: `${shown} ${ms} ms`, png })),
      );
      const out = resolve(
        target,
        args.values['--out'] ?? `${workRootOf(target)}/shots/${product}-${part.replace('/', '-')}-motion-${motion}.png`,
      );
      const json = out.replace(/(\.png)?$/u, '.json');
      const { png } = await queue.run((browser) => contactSheetOf({ browser, rows }));
      const report = motionReportOf({ product, part, motion, declared, preset: chosenPreset, width, drawn });

      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);

      console.log(out);
      console.log(json);
      for (const line of motionSummaryOf(drawn)) console.log(line);

      return 0;
    } finally {
      await shooter.close();
    }
  } catch (error) {
    if (error instanceof ThumbUnavailableError) {
      console.error(error.message);

      return 1;
    }

    console.error(error instanceof Error ? error.message : String(error));

    return 1;
  } finally {
    await queue.close();
    await server.close();
  }
};
