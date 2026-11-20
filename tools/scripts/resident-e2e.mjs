#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const USAGE =
  'usage: node tools/scripts/resident-e2e.mjs --target <yarn scratch:checkout dir> [--cli <index.js>] [--save <dir>]';

const MARKER = '.scratch-checkout';
const MARKER_ASIDE = '.scratch-checkout.resident-e2e';

export const PART = 'components/zoom-chip';
export const COMPARE = ['compare', PART, '--product', 'studio', '--state', 'out'];
export const STATE = 'out';

/** The edits between two compares: each must change the picture, and undoing it must bring the first one back. */
export const EDITS = [
  {
    side: 'design',
    file: '.ethlete/design/studio/components/zoom-chip/zoom-chip.ts',
    from: "chipButton('fit', 'Fit', props)",
    to: "chipButton('fit', 'Fix', props)",
  },
  {
    side: 'app',
    file: 'apps/ethlete-studio/src/app/design-parts/zoom-chip/zoom-chip.component.ts',
    from: '{{ LABELS.fitButton }}',
    to: 'Fix',
  },
];

export const argsOf = (argv) => {
  const options = { target: null, cli: null, save: null };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--target' && value) options.target = resolve(value);
    else if (flag === '--cli' && value) options.cli = resolve(value);
    else if (flag === '--save' && value) options.save = resolve(value);
    else return { error: `unknown or incomplete flag ${flag}\n${USAGE}` };

    index += 1;
  }

  if (!options.target) return { error: USAGE };

  return { ...options, cli: options.cli ?? join(options.target, 'dist/libs/cli/src/index.js') };
};

/** What one compare run showed for `state`: its line, the `pictures:` dir, and whether the resident started. */
export const compareRunOf = (output, state = STATE) => {
  const lines = stripVTControlCharacters(output).split('\n');
  const line = lines.find((entry) => entry.startsWith(`${state} `))?.trim() ?? null;
  const pictures = lines.map((entry) => /^pictures: (.+)$/.exec(entry.trim())?.[1]).find(Boolean) ?? null;

  return {
    line,
    pictures,
    residentStart: lines.some((entry) => entry.includes('starting the resident design process')),
  };
};

/** A run's picture: the state line plus the hashes of the design and app pictures compare wrote, if any. */
export const pictureOf = (run, hashOf) =>
  run.pictures === null
    ? run.line
    : `${run.line} design ${hashOf(join(run.pictures, `${STATE}.design.png`))} app ${hashOf(join(run.pictures, `${STATE}.app.png`))}`;

/**
 * Judges the runs of one edit: `before`, `edited` and `undone` must all run in the same resident process, `edited`
 * must show another picture than `before`, and `undone` the one of `before`.
 */
export const judgeEdit = ({ side, before, edited, undone }) => {
  const failures = [
    ...[before, edited, undone].flatMap((run, index) =>
      run.line === null ? [`${['before', 'edited', 'undone'][index]}: no "${STATE}" line`] : [],
    ),
    ...(edited.pid !== before.pid || undone.pid !== before.pid
      ? [`the resident changed: pid ${before.pid}, ${edited.pid}, ${undone.pid}`]
      : []),
    ...(edited.residentStart || undone.residentStart ? ['a run after the first started a new resident'] : []),
    ...(edited.picture === before.picture ? [`the ${side} edit served the old picture: ${edited.picture}`] : []),
    ...(undone.picture !== before.picture
      ? [`undoing the ${side} edit did not bring the first picture back: ${undone.picture} vs ${before.picture}`]
      : []),
  ];

  return { pass: failures.length === 0, failures };
};

const hashOf = (path) =>
  existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12) : 'missing';

const design = ({ target, cli }, args) => {
  const start = performance.now();
  const result = spawnSync(process.execPath, [cli, 'design', ...args], {
    cwd: target,
    env: { ...process.env, NX_NO_CLOUD: 'true' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return { ms: Math.round(performance.now() - start), output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

const residentPidOf = (target) => {
  const path = join(target, 'tmp/design-resident/process.json');

  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).pid : null;
};

const compare = (options, label) => {
  const raw = design(options, COMPARE);
  const run = { ...compareRunOf(raw.output), pid: residentPidOf(options.target), ms: raw.ms };
  const picture = pictureOf(run, hashOf);

  if (options.save) writeFileSync(join(options.save, `${label}.log`), raw.output);
  console.log(`  ${label.padEnd(14)} ${(raw.ms / 1000).toFixed(1).padStart(6)} s  pid ${run.pid}  ${picture}`);

  return { ...run, picture, output: raw.output };
};

const replaceIn = (target, { file, from, to }) => {
  const path = join(target, file);
  const text = readFileSync(path, 'utf8');

  if (!text.includes(from)) throw new Error(`${file} has no ${from}`);
  writeFileSync(path, text.replace(from, to));

  return () => writeFileSync(path, text);
};

/** Runs every edit between compares of one warm resident; answers the exit code. */
export const proveResident = (options) => {
  if (!existsSync(join(options.target, MARKER))) {
    console.error(
      `resident-e2e: ${options.target} is no scratch checkout (no ${MARKER}); it edits design and app files`,
    );

    return 2;
  }

  if (!existsSync(options.cli)) {
    console.error(`resident-e2e: no CLI build at ${options.cli} - build it or copy dist/ into the scratch checkout`);

    return 2;
  }

  if (options.save) mkdirSync(options.save, { recursive: true });
  renameSync(join(options.target, MARKER), join(options.target, MARKER_ASIDE));
  const undo = [];

  try {
    design(options, ['stop']);

    const first = compare(options, 'start');

    if (!first.residentStart) console.log('  note: the first compare did not start the resident');

    const verdicts = EDITS.map((edit) => {
      console.log(`${edit.side} edit (${edit.file})`);
      const before = compare(options, `${edit.side}-before`);

      undo.push(replaceIn(options.target, edit));
      const edited = compare(options, `${edit.side}-edited`);

      undo.pop()();
      const undone = compare(options, `${edit.side}-undone`);
      const verdict = judgeEdit({ side: edit.side, before, edited, undone });

      console.log(`  ${edit.side}: ${verdict.pass ? 'pass' : `FAIL - ${verdict.failures.join('; ')}`}`);

      return verdict;
    });

    return verdicts.every((verdict) => verdict.pass) ? 0 : 1;
  } finally {
    undo.reverse().forEach((restore) => restore());
    design(options, ['stop']);
    renameSync(join(options.target, MARKER_ASIDE), join(options.target, MARKER));
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const options = argsOf(process.argv.slice(2));

  if ('error' in options) {
    console.error(options.error);
    process.exit(2);
  }

  process.exit(proveResident(options));
}
