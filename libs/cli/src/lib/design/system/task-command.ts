import { resolve } from 'path';
import { createDesignServer } from '../serve';
import { partActionFailuresOf } from './actions-command';
import { appFilesOf } from './app-files';
import { comparePart, ComparePart } from './compare-command';
import { buildReadyInputsOf } from './check-system';
import { appStylesheetOf } from './harness-config';
import { harnessStaleOf } from './harness-map';
import { StartHarnessServer, withHarnessUrl } from './harness-server';
import { BuildReadyInputs } from './part-build-ready';
import {
  allowedFilesOf,
  changesOnlySourceLines,
  designFilesOf,
  filesOutsideOf,
  gitDiffFilesOf,
  gitFileAtOf,
  gitTreeFilesOf,
  importersOf,
  gitDiffPatchOf,
  markImplemented,
  notImplementationFilesOf,
  ownerPartsOf,
  readImplemented,
  TaskPart,
  themingDirectivesOf,
  taskPartOf,
  taskStatesOf,
  verifiedTaskPartOf,
  verifyRangeOf,
  wiringFilesOf,
} from './part-task';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { THEMING_TEXT } from './theming-text';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { productModuleIdOf } from './system-modules';

export const TASK_USAGE =
  'task <layer>/<name> --product <name> [--verify [<rev>] [--url <app dev server url>]] | task <layer>/<name> <layer>/<name>... --product <name> --verify <rev> [--url <app dev server url>]';

export type PartActionFailures = typeof partActionFailuresOf;

type LoadStates = (options: { target: string; product: ResolvedProduct; file: string }) => Promise<unknown>;

type DiffFiles = (options: { root: string; range: string }) => string[];

type ReadFile = (options: { root: string; range: string; file: string }) => string | null;

type DiffPatch = (options: { root: string; range: string; file: string }) => string;

type TreeFiles = (options: { root: string; rev: string; dir: string }) => string[];

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
 * `et design task <layer>/<name> …` prints what implementing a build-ready part takes, or its blockers; `--verify [<rev>]`
 * needs a holding check record and checks the files of a commit or range against the files the task allows, runs compare and the actions check, and records the part as
 * implemented when all pass. Several parts verify one commit as one task: their allowed files join, and each part needs
 * its own green compare and actions check before any is recorded.
 */
export const designTask = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  load?: LoadStates;
  diff?: DiffFiles;
  patch?: DiffPatch;
  read?: ReadFile;
  tree?: TreeFiles;
  compare?: ComparePart;
  start?: StartHarnessServer;
  actions?: PartActionFailures;
  inputs?: (product: ResolvedProduct) => BuildReadyInputs;
}) => {
  const { target, invocation } = options;
  const { rest, rev } = verifyOf(options.argv);
  const args = argsOf(rest, { values: ['--product', '--url'], switches: [] });

  if (typeof args === 'string' || args.positional.length === 0 || (rev === null && args.positional.length > 1)) {
    if (typeof args === 'string') console.error(args);
    else if (args.positional.length > 1) console.error('several parts need --verify: they verify one commit together');

    console.error(`usage: ${invocation} ${TASK_USAGE}`);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  const parts: string[] = [];

  for (const positional of args.positional) {
    const parsed = parseTarget(positional);

    if (typeof parsed === 'string') {
      console.error(parsed);

      return 1;
    }

    if (!parts.includes(partKeyOf(parsed))) parts.push(partKeyOf(parsed));
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const tasks: TaskPart[] = [];

  for (const part of parts) {
    const found =
      rev === null
        ? taskPartOf({ product, part, inputs: (options.inputs ?? buildReadyInputsOf)(product) })
        : verifiedTaskPartOf({ product, part });

    if (typeof found === 'string') {
      console.error(found);

      return 1;
    }

    tasks.push(found);
  }

  const [task] = tasks;

  if (!task) return 2;

  const allowed = [
    ...new Set(
      tasks.flatMap((each) =>
        allowedFilesOf({
          product: product.name,
          component: each.component,
          harnessMap: product.config.harness?.map ?? null,
          shared: product.config.harness?.shared ?? [],
        }),
      ),
    ),
  ];
  const harnessApp = product.config.harness?.app;
  const stylesheet = harnessApp ? appStylesheetOf({ target, app: harnessApp }) : null;
  const root = resolve(product.configFile, '../../..');
  const wiringAt = (range: string, component: string) => {
    const read = (file: string) => (options.read ?? gitFileAtOf)({ root, range, file });
    const rev = range.includes('..') ? (range.split('..').pop() ?? range) : range;

    try {
      const files = (options.tree ?? gitTreeFilesOf)({
        root,
        rev,
        dir: component.split('/').slice(0, 2).join('/'),
      });

      return wiringFilesOf({ files, component, read });
    } catch {
      return [];
    }
  };

  if (rev !== null) {
    const stale = harnessStaleOf({ target, product });

    if (stale !== null) {
      console.error(stale);

      return 1;
    }

    const range = verifyRangeOf(rev);
    let files: string[];
    let outside: string[];
    let wired: string[];

    try {
      const diffed = (options.diff ?? gitDiffFilesOf)({ root, range });
      const design = designFilesOf(diffed);

      const ignored = notImplementationFilesOf(diffed);

      files = diffed.filter((file) => !design.includes(file) && !ignored.includes(file));
      if (design.length > 0) {
        console.log(`skipped ${design.length} design file${design.length === 1 ? '' : 's'} under .ethlete/design`);
      }
      if (ignored.length > 0) {
        console.log(
          `skipped ${ignored.length} plan, docs and changeset file${ignored.length === 1 ? '' : 's'}: ${ignored.join(', ')}`,
        );
      }
      const unlisted = filesOutsideOf({ files, allowed }).filter(
        (file) =>
          file !== stylesheet || !changesOnlySourceLines((options.patch ?? gitDiffPatchOf)({ root, range, file })),
      );
      const importers = tasks.flatMap((each) =>
        importersOf({
          files: unlisted,
          component: each.component,
          read: (file) => (options.read ?? gitFileAtOf)({ root, range, file }),
        }),
      );

      const wiring = tasks.flatMap((each) => wiringAt(range, each.component));

      wired = unlisted.filter((file) => wiring.includes(file));
      outside = unlisted.filter((file) => !importers.includes(file) && !wiring.includes(file));
    } catch (error) {
      console.error(`git diff ${range} failed: ${error instanceof Error ? error.message : String(error)}`);

      return 1;
    }

    wired.forEach((file) => console.log(`WIRING ${file}`));

    if (outside.length > 0) {
      console.error(`${outside.length} file${outside.length === 1 ? '' : 's'} of ${range} outside the allowed files:`);
      outside.forEach((file) => console.error(`  ${file}`));
      console.error(
        `allowed: ${[...allowed, ...(stylesheet ? [`${stylesheet} (@source lines)`] : []), 'wiring files'].join(', ')}`,
      );

      const owners = ownerPartsOf({ product, files: outside, except: parts });

      if (owners.length > 0) {
        console.error(
          `verify together: ${invocation} task ${[...parts, ...owners].join(' ')} --product ${product.name} --verify ${rev}`,
        );
      }

      return 1;
    }

    console.log(`${files.length} file${files.length === 1 ? '' : 's'} of ${range} inside the allowed files`);

    const prefix = (each: TaskPart) => (tasks.length > 1 ? `${each.part}: ` : '');
    const passed: { task: TaskPart; states: Record<string, unknown> }[] = [];

    for (const each of tasks) {
      const compared = await withHarnessUrl({
        target,
        product,
        url: args.values['--url'],
        start: options.start,
        run: (url) => (options.compare ?? comparePart)({ target, config, product, part: each.part, url, only: null }),
      });

      if (typeof compared === 'string' || !compared.green) {
        console.error(
          `${prefix(each)}${typeof compared === 'string' ? compared : 'compare is not green, so nothing was recorded'}`,
        );

        return 1;
      }

      const failures = await (options.actions ?? partActionFailuresOf)({
        target,
        config,
        product,
        part: each.part,
        url: args.values['--url'],
        start: options.start,
        onNote: (line) => console.log(line),
      });

      if (!Array.isArray(failures)) {
        console.error(
          `${prefix(each)}the actions check could not run, so nothing was recorded: ${failures.unavailable}`,
        );

        return 1;
      }

      if (failures.length > 0) {
        failures.forEach((line) => console.error(line));
        console.error(
          `${prefix(each)}${failures.length} action${failures.length === 1 ? '' : 's'} missed, so nothing was recorded`,
        );

        return 1;
      }

      passed.push({ task: each, states: compared.states });
    }

    for (const { task: each, states } of passed) {
      const implemented = markImplemented({
        product,
        part: each.part,
        states,
        app: appFilesOf({ root: repoRootOf(product), component: each.component }),
      });

      if (typeof implemented === 'string') {
        console.error(implemented);

        return 1;
      }

      console.log(
        `recorded ${each.part} as implemented at ${implemented.hash} (${implemented.at}), states: ${Object.keys(implemented.states).join(', ')}, app files: ${Object.keys(implemented.app ?? {}).length}`,
      );
    }

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
  console.log(`design ${task.hash}`);
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
  if (stylesheet) console.log(`  ${stylesheet} (@source lines)`);
  const wiring = wiringAt('HEAD', task.component);

  console.log(wiring.length > 0 ? 'wiring files:' : 'wiring files: none yet');
  wiring.forEach((file) => console.log(`  ${file}`));
  const directives = themingDirectivesOf(drawn?.source ?? '');

  if (directives.length > 0) {
    console.log('theming directives (@ethlete/core):');
    directives.forEach((mapping) => console.log(`  ${mapping}`));
  }
  console.log('target: compare green');
  console.log(THEMING_TEXT);

  return 0;
};
