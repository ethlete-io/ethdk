import { mkdirSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { contactSheetOf, SheetCell } from './contact-sheet';
import { flowLineAddressOf, flowLineOf } from './motion-flow';
import { MOTION_MODES, MotionMode, MotionPictures } from './motion-shot';
import { DesignConfig, workRootOf } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter, drawParamsOf, isSchemeFlag } from './shot';
import { shotProductOf } from './shot-command';
import { DesignFlow, FlowLine, flowStateKeyOf, listFlows } from './system/flows/flow';
import { argsOf, configOf, oneProductOf } from './system/sketch/cli-args';
import { createSystemModules, productModuleIdOf } from './system/system-modules';
import { createDrawQueue } from './thumb';

export const MOTION_USAGE = `motion shots <layer>/<name> <motion> [--variant <key>] [--mode <${MOTION_MODES.join('|')}>] [--preset <preset> | --width <px>] [--scale <1-4>] [--product <name>] [--surface <name>] [--color <name>] [--scheme <light|dark>] [--out <file>]
  motion flow <flow> <line id | part#state→part#state> [--mode <${MOTION_MODES.join('|')}>] [--preset <preset>] [--scale <1-4>] [--product <name>] [--surface <name>] [--color <name>] [--scheme <light|dark>] [--out <file>]`;

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

/** The JSON `motion flow` writes next to its sheet: the line, its ends, and per mode the end, the keyframe times and the tracks. */
export const flowReportOf = (options: {
  product: string;
  flow: DesignFlow;
  line: FlowLine;
  preset: string;
  drawn: Partial<Record<MotionMode, MotionPictures>>;
}) => ({
  product: options.product,
  flow: options.flow.name,
  line: flowLineAddressOf(options.line),
  label: options.line.label ?? null,
  from: flowStateKeyOf(options.line.from),
  to: flowStateKeyOf(options.line.to),
  preset: options.preset,
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

type DrawnModes = Partial<Record<MotionMode, MotionPictures>>;

type Sheet = { drawn: DrawnModes; out: string; report: unknown };

const MOTION_FLAGS = [
  '--product',
  '--variant',
  '--mode',
  '--preset',
  '--width',
  '--scale',
  '--surface',
  '--color',
  '--scheme',
  '--out',
];

/** Opens a design server and a shooter, lets `draw` draw each mode, and writes the contact sheet and the JSON report. */
const writeMotionSheet = async (options: {
  target: string;
  config: DesignConfig;
  system: ReturnType<typeof createSystemModules>;
  draw: (context: {
    server: Awaited<ReturnType<typeof createDesignServer>>;
    shooter: ReturnType<typeof createPartShooter>;
  }) => Promise<Sheet | string>;
}) => {
  const { target, config, system } = options;
  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const shooter = createPartShooter({ target, base: `http://localhost:${port}`, system });

    try {
      const sheet = await options.draw({ server, shooter });

      if (typeof sheet === 'string') {
        console.error(sheet);

        return 1;
      }

      const rows: SheetCell[][] = Object.entries(sheet.drawn).map(([shown, { keyframes }]) =>
        keyframes.map(({ ms, png }) => ({ label: `${shown} ${ms} ms`, png })),
      );
      const out = resolve(target, sheet.out);
      const json = out.replace(/(\.png)?$/u, '.json');
      const { png } = await queue.run((browser) => contactSheetOf({ browser, rows }));

      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      writeFileSync(json, `${JSON.stringify(sheet.report, null, 2)}\n`);

      console.log(out);
      console.log(json);
      for (const line of motionSummaryOf(sheet.drawn)) console.log(line);

      return 0;
    } finally {
      await shooter.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));

    return 1;
  } finally {
    await queue.close();
    await server.close();
  }
};

const modesOf = (mode: string | undefined) => (mode ? [mode as MotionMode] : MOTION_MODES);

/**
 * `et design motion flow <flow> <line>` draws a flow line with `"transition": "view"`: the `from` page morphs to the `to`
 * page inside a View Transition, shot in the whole preset viewport at each keyframe time, in full and reduced motion.
 */
const designMotionFlow = (options: {
  target: string;
  config: DesignConfig;
  args: Exclude<ReturnType<typeof argsOf>, string>;
  usage: string;
}) => {
  const { target, config, args, usage } = options;
  const [, flowName, address, ...extra] = args.positional;
  const mode = args.values['--mode'];
  const scale = Number(args.values['--scale'] ?? 1);

  if (
    !flowName ||
    !address ||
    extra.length > 0 ||
    args.flags.size > 0 ||
    args.values['--width'] !== undefined ||
    args.values['--variant'] !== undefined ||
    (mode !== undefined && !(MOTION_MODES as readonly string[]).includes(mode)) ||
    !(Number.isInteger(scale) && scale >= 1 && scale <= 4) ||
    !isSchemeFlag(args.values['--scheme'])
  ) {
    console.error(usage);

    return Promise.resolve(2);
  }

  const resolved = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof resolved === 'string') {
    console.error(resolved);

    return Promise.resolve(1);
  }

  const product = resolved.name;
  const { flows, unreadable } = listFlows(resolved.dir);
  const flow = flows.find((found) => found.name === flowName);

  if (!flow) {
    const broken = unreadable.find((entry) => entry.file.endsWith(`/${flowName}.json`));

    console.error(
      broken
        ? `design-explore: flows/${flowName}.json ${broken.problem}`
        : `design-explore: product "${product}" has no flow "${flowName}" (flows: ${flows.map((found) => found.name).join(', ') || 'none'})`,
    );

    return Promise.resolve(1);
  }

  const line = flowLineOf(flow, address);

  if (typeof line === 'string') {
    console.error(`design-explore: ${line}`);

    return Promise.resolve(1);
  }

  const system = createSystemModules({ target, config });
  const preset = args.values['--preset'] ?? Object.keys(system.productOf(product)?.presets ?? {})[0];

  if (!preset) {
    console.error(`design-explore: product "${product}" has no preset - a flow line is drawn in a preset viewport`);

    return Promise.resolve(1);
  }

  const params = drawParamsOf(args.values);
  const name = flowLineAddressOf(line);

  return writeMotionSheet({
    target,
    config,
    system,
    draw: async ({ shooter }) => {
      const drawn: DrawnModes = {};

      for (const shown of modesOf(mode)) {
        drawn[shown] = await shooter.motionOf({
          product,
          part: line.from.part,
          state: line.from.state,
          preset,
          width: null,
          sketch: null,
          interaction: null,
          motion: name,
          flowTo: line.to,
          mode: shown,
          params,
        });
      }

      return {
        drawn,
        out:
          args.values['--out'] ??
          `${workRootOf(target)}/shots/${product}-flow-${flow.name}-${name.replace(/[^A-Za-z0-9._-]+/gu, '-')}.png`,
        report: flowReportOf({ product, flow, line, preset, drawn }),
      };
    },
  });
};

/**
 * `et design motion shots <layer>/<name> <motion>` draws a motion of a part at each keyframe time, in full and reduced
 * motion, into one contact sheet PNG with a row per mode, writes its tracks as JSON next to it, and prints both paths.
 * `et design motion flow` draws a flow line the same way.
 */
export const designMotion = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, MOTION_FLAGS);
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
  const config = configOf(target);

  if (command === 'flow') {
    if (typeof config === 'string') {
      console.error(config);

      return 1;
    }

    return designMotionFlow({ target, config, args, usage });
  }

  if (
    command !== 'shots' ||
    !part ||
    !motion ||
    extra.length > 0 ||
    args.flags.size > 0 ||
    (mode !== undefined && !(MOTION_MODES as readonly string[]).includes(mode)) ||
    (width !== null && !(Number.isInteger(width) && width > 0)) ||
    (preset && width) ||
    !(Number.isInteger(scale) && scale >= 1 && scale <= 4) ||
    !isSchemeFlag(args.values['--scheme'])
  ) {
    console.error(usage);

    return 2;
  }

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

  return writeMotionSheet({
    target,
    config,
    system,
    draw: async ({ server, shooter }) => {
      const module = (await server.ssrLoadModule(productModuleIdOf({ file: found.file, product, sketch }))) as {
        default?: unknown;
      };
      const motions = motionsOf(module.default);
      const declared = motions[motion];

      if (!declared)
        return `design-explore: ${part} has no motion "${motion}" (motions: ${Object.keys(motions).join(', ') || 'none'})`;

      const presets = system.productOf(product)?.presets ?? {};
      const chosenPreset = preset ?? (part.startsWith('pages/') ? (Object.keys(presets)[0] ?? null) : null);
      const params = drawParamsOf(args.values);
      const drawn: DrawnModes = {};

      for (const shown of modesOf(mode)) {
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

      return {
        drawn,
        out:
          args.values['--out'] ??
          `${workRootOf(target)}/shots/${product}-${part.replace('/', '-')}-motion-${motion}.png`,
        report: motionReportOf({ product, part, motion, declared, preset: chosenPreset, width, drawn }),
      };
    },
  });
};
