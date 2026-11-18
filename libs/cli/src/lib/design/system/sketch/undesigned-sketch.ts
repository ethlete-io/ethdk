import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import ts from 'typescript';
import { chromiumOf } from '../../browser';
import { STATE_UNDESIGNED_RULE } from '../build-ready-contract';
import { withHarnessUrl } from '../harness-server';
import { compareFrameOf, harnessShotOf } from '../harness-shot';
import { harnessUrlOf } from '../part-compare';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { createSketch, listSketches, markSketchReady, Sketch, variantDirOf, writeSketchFile } from './sketch';

export const BUILT_VARIANT = 'built';

type Missing = NonNullable<Problem['missing']>;

/** Shoots the app component of `part` in the product's harness with `props`: the developer's build of `state`. */
export type ShootBuilt = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
  state: string;
  props: Record<string, unknown>;
}) => Promise<Buffer | string>;

const DEFAULT_EXPORT = 'export default definePart';

const partOfProblem = (product: ResolvedProduct, problem: Problem) =>
  product.parts.find(
    (part) => part.file === problem.file || problem.file.endsWith(`/${partKeyOf(part)}/${basename(part.file)}`),
  );

const openSketchesOf = (product: ResolvedProduct) =>
  listSketches({ productDir: product.dir, product: product.name }).filter(
    (sketch): sketch is Sketch => typeof sketch !== 'string' && sketch.decision === undefined,
  );

/** A `STATE-UNDESIGNED` hit on `part`: the app template branch no design state draws, or the design state it lacks. */
export type UndesignedHit = { part: string; branch?: string; state?: string };

const holdsUndesigned = (sketch: Sketch, hit: UndesignedHit) =>
  sketch.targets.includes(hit.part) &&
  ((hit.branch !== undefined && (sketch.undesigned ?? []).includes(hit.branch)) ||
    (hit.state !== undefined && sketch.target === `${hit.part}@${hit.state}`));

/**
 * Whether an open sketch holds the hit: one of its part that lists the branch in `undesigned`, or `<part>@<state>`
 * that draws the missing state. The hit waits for its pick (B251b).
 */
export const undesignedWaitOf = (product: ResolvedProduct) => {
  const sketches = openSketchesOf(product);

  return (hit: UndesignedHit) => sketches.some((sketch) => holdsUndesigned(sketch, hit));
};

const builtModuleOf = (picture: Buffer) => `export default 'data:image/png;base64,${picture.toString('base64')}';\n`;

const defaultExportOf = (source: string) => {
  const file = ts.createSourceFile('part.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const exported = file.statements.find(
    (statement): statement is ts.ExportAssignment => ts.isExportAssignment(statement) && !statement.isExportEquals,
  );

  return exported && { start: exported.expression.getStart(file), end: exported.expression.end };
};

const unusedNameOf = (source: string, name: string) => {
  let candidate = name;

  for (let index = 2; new RegExp(`\\b${candidate}\\b`, 'u').test(source); index++) candidate = `${name}${index}`;

  return candidate;
};

const wrappedPartOf = (source: string, missing: Missing) => {
  const exported = defaultExportOf(source);

  if (!exported) return source;

  const key = JSON.stringify(missing.state).replace(/^"|"$/gu, "'");
  const picture = unusedNameOf(source, 'builtPicture');

  return `import ${picture} from './${missing.state}.built';
${source.slice(0, exported.start)}((drawn) => {
  type Props = Parameters<typeof drawn.render>[0];

  const states = { ...drawn.states, ${key}: ${JSON.stringify(missing.props)} as unknown as Props };

  return {
    ...drawn,
    states,
    describe: {
      ...(drawn as { describe?: Record<string, string> }).describe,
      ${key}: 'The look the developer built for a state the design lacked; check it against the app.',
    },
    render: (props: Props, options?: Parameters<typeof drawn.render>[1]) =>
      JSON.stringify(props) === JSON.stringify(states[${key}])
        ? { body: \`<img class="et-built-look" src="\${${picture}}" alt="" />\`, styles: '.et-built-look { display: block; }' }
        : drawn.render(props, options),
  };
})(${source.slice(exported.start, exported.end)})${source.slice(exported.end)}`;
};

/**
 * Opens `<part>@<state>` for an app branch no design state draws (B251b, ADR 0048, ADR 0010): its one variant `built`
 * is the part with `state` declared and drawn as `picture`, the developer's build. The hit waits while it is open.
 */
export const openUndesignedSketch = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
  branch: string;
  missing: Missing;
  picture: Buffer;
  author?: string;
}): Sketch | string => {
  const { target, product, part, branch, missing, picture, author } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;

  const main = readFileSync(resolved.file, 'utf8');

  if (main.split(DEFAULT_EXPORT).length !== 2)
    return `${part} does not export its part as \`${DEFAULT_EXPORT}\` once - draw ${missing.state} by hand`;

  const created = createSketch({
    product,
    sketch: { layer: resolved.layer, name: resolved.name, sketch: missing.state },
    variants: [BUILT_VARIANT],
    roundTitle: 'Fehlender Zustand',
    roundNote: `Die App zeigt ${branch}, das Design zeichnet es nicht - übernimm den gebauten Stand oder zeichne eine Variante dazu`,
    variantNotes: new Map([[BUILT_VARIANT, 'der Stand, den der Entwickler gebaut hat (Bild der App)']]),
    author,
    merge: resolved.origin === 'overridden' ? 'override' : undefined,
  });

  if (typeof created === 'string') return created;

  const dir = resolve(variantDirOf(created, BUILT_VARIANT), resolved.layer, resolved.name);
  const file = resolve(dir, basename(resolved.file));

  writeFileSync(file, wrappedPartOf(readFileSync(file, 'utf8'), missing));
  writeFileSync(resolve(dir, `${missing.state}.built.ts`), builtModuleOf(picture));

  const marked: Sketch = { ...created, undesigned: [branch] };

  writeSketchFile(marked, { base: created });

  const ready = markSketchReady({ checkout: target, sketch: marked, author });

  return typeof ready === 'string' ? marked : ready;
};

/** The problems without the `STATE-UNDESIGNED` hits an open sketch of their part holds: they wait for its pick. */
export const withoutWaitingUndesigned = (product: ResolvedProduct, problems: Problem[]) => {
  if (!problems.some((problem) => problem.rule === STATE_UNDESIGNED_RULE)) return problems;

  const waits = undesignedWaitOf(product);

  return problems.filter((problem) => {
    const part = problem.rule === STATE_UNDESIGNED_RULE ? partOfProblem(product, problem) : undefined;

    return !part || !waits({ part: partKeyOf(part), branch: problem.at ?? '' });
  });
};

/** Opens the sketch of the built look for each `STATE-UNDESIGNED` hit no open sketch holds yet, shooting the app once per hit. */
export const openUndesignedSketches = async (options: {
  target: string;
  product: ResolvedProduct;
  problems: Problem[];
  shoot: ShootBuilt;
  log: (line: string) => void;
}) => {
  const { target, product, log } = options;

  for (const problem of options.problems) {
    if (problem.rule !== STATE_UNDESIGNED_RULE) continue;

    const resolved = partOfProblem(product, problem);
    const branch = problem.at ?? '';

    if (!resolved) continue;

    const part = partKeyOf(resolved);

    if (undesignedWaitOf(product)({ part, branch })) continue;
    if (!problem.missing) {
      log(`undesigned state: ${part} ${branch} - no input props take it, draw its sketch by hand`);
      continue;
    }

    const picture = await options.shoot({
      target,
      product,
      part,
      state: problem.missing.state,
      props: problem.missing.props,
    });

    if (typeof picture === 'string') {
      log(`undesigned state: ${part} ${branch} - the app picture failed: ${picture}`);
      continue;
    }

    const opened = openUndesignedSketch({ target, product, part, branch, missing: problem.missing, picture });

    log(
      typeof opened === 'string'
        ? `undesigned state: ${part} ${branch} - ${opened}`
        : `undesigned state: opened ${opened.target} with the built look as variant ${BUILT_VARIANT}`,
    );
  }
};

export const shootBuiltState: ShootBuilt = async ({ target, product, part, state, props }) => {
  const frame = compareFrameOf({ presets: product.presets, part, preset: null });

  if (typeof frame === 'string') return frame;

  const loaded = await chromiumOf(target);

  if (!loaded) return 'the app picture needs playwright or playwright-core in the checkout';

  const browser = await loaded.chromium.launch();

  try {
    return await withHarnessUrl({
      target,
      product,
      url: undefined,
      run: (url) =>
        harnessShotOf({
          browser,
          url: harnessUrlOf({ url, part, state, props, layout: frame.layout }),
          size: frame.size,
        }),
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await browser.close();
  }
};
