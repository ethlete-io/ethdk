import { resolve } from 'path';
import { createDesignServer } from '../serve';
import { comparePart, ComparePart } from './compare-command';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import {
  allowedFilesOf,
  filesOutsideOf,
  gitDiffFilesOf,
  markImplemented,
  readImplemented,
  themingDirectivesOf,
  taskPartOf,
  taskStatesOf,
  verifyRangeOf,
} from './part-task';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { THEMING_TEXT } from './theming-text';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { productModuleIdOf } from './system-modules';

export const TASK_USAGE = 'task <layer>/<name> --product <name> [--verify [<rev>] [--url <app dev server url>]]';

type LoadStates = (options: { target: string; product: ResolvedProduct; file: string }) => Promise<unknown>;

type DiffFiles = (options: { root: string; range: string }) => string[];

const loadStates: LoadStates = async ({ target, product, file }) => {
  const config = configOf(target);

  if (typeof config === 'string') return {};

  const vite = await createDesignServer({ target, config, listen: false });

  try {
    const module = (await vite.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
      default?: { states?: unknown };
    };

    return module.default?.states;
  } finally {
    await vite.close();
  }
};

const verifyOf = (argv: string[]) => {
  const index = argv.indexOf('--verify');

  if (index === -1) return { rest: argv, rev: null };

  const next = argv[index + 1];
  const given = next !== undefined && !next.startsWith('--');

  return {
    rest: argv.filter((_, at) => at !== index && !(given && at === index + 1)),
    rev: given ? next : 'HEAD',
  };
};

/**
 * `et design task <layer>/<name> …` prints what implementing a part with a current go takes; `--verify [<rev>]`
 * checks the files of a commit or range against the files the task allows, runs compare, and records the part as
 * implemented when both pass.
 */
export const designTask = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  load?: LoadStates;
  diff?: DiffFiles;
  compare?: ComparePart;
  start?: StartHarnessServer;
}) => {
  const { target, invocation } = options;
  const { rest, rev } = verifyOf(options.argv);
  const args = argsOf(rest, ['--product', '--url']);

  if (typeof args === 'string' || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${TASK_USAGE}`);

    return 2;
  }

  const config = configOf(target);
  const parsed = parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const task = taskPartOf({ product, part: partKeyOf(parsed) });

  if (typeof task === 'string') {
    console.error(task);

    return 1;
  }

  const allowed = allowedFilesOf({
    product: product.name,
    component: task.component,
    harnessMap: product.config.harness?.map ?? null,
  });

  if (rev !== null) {
    const stale = harnessStaleOf({ target, product });

    if (stale !== null) {
      console.error(stale);

      return 1;
    }

    const range = verifyRangeOf(rev);
    let files: string[];

    try {
      files = (options.diff ?? gitDiffFilesOf)({ root: resolve(product.configFile, '../../..'), range });
    } catch (error) {
      console.error(`git diff ${range} failed: ${error instanceof Error ? error.message : String(error)}`);

      return 1;
    }

    const outside = filesOutsideOf({ files, allowed });

    if (outside.length > 0) {
      console.error(`${outside.length} file${outside.length === 1 ? '' : 's'} of ${range} outside the allowed files:`);
      outside.forEach((file) => console.error(`  ${file}`));
      console.error(`allowed: ${allowed.join(', ')}`);

      return 1;
    }

    console.log(`${files.length} file${files.length === 1 ? '' : 's'} of ${range} inside the allowed files`);

    const compared = await withHarnessUrl({
      target,
      product,
      url: args.values['--url'],
      start: options.start,
      run: (url) => (options.compare ?? comparePart)({ target, config, product, part: task.part, url, only: null }),
    });

    if (typeof compared === 'string' || !compared.green) {
      console.error(typeof compared === 'string' ? compared : 'compare is not green, so nothing was recorded');

      return 1;
    }

    const implemented = markImplemented({ product, part: task.part, states: compared.states });

    if (typeof implemented === 'string') {
      console.error(implemented);

      return 1;
    }

    console.log(
      `recorded ${task.part} as implemented at ${implemented.hash} (${implemented.at}), states: ${Object.keys(implemented.states).join(', ')}`,
    );

    return 0;
  }

  const drawn = product.parts.find((candidate) => partKeyOf(candidate) === task.part);
  const file = drawn?.file ?? '';
  const loaded = await (options.load ?? loadStates)({ target, product, file });
  const states =
    loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};
  const record = readImplemented(task.dir)[task.part];
  const since = taskStatesOf({ states, hash: task.hash, record });

  console.log(`part ${task.part} in ${product.name}`);
  console.log(`go ${task.hash}`);
  console.log(`implements ${task.component}`);
  console.log('states:');
  Object.entries(states).forEach(([state, props]) => console.log(`  ${state} ${JSON.stringify(props) ?? 'undefined'}`));
  console.log(record ? `since the implementation at ${record.at}:` : 'not implemented yet:');
  if (since.added.length > 0) console.log(`  new: ${since.added.join(', ')}`);
  if (since.changed.length > 0) console.log(`  changed: ${since.changed.join(', ')}`);
  if (since.all) console.log('  all states: render or styles changed');
  if (since.added.length === 0 && since.changed.length === 0 && !since.all) console.log('  no change');
  console.log('allowed files:');
  allowed.forEach((pattern) => console.log(`  ${pattern}`));
  const directives = themingDirectivesOf(drawn?.source ?? '');

  if (directives.length > 0) {
    console.log('theming directives (@ethlete/core):');
    directives.forEach((mapping) => console.log(`  ${mapping}`));
  }
  console.log('target: compare green');
  console.log(THEMING_TEXT);

  return 0;
};
