import { existsSync, readFileSync, realpathSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { writeDecisionFile } from '../product-lock';
import { ResolvedProduct } from '../resolve-product';
import { writeMergeChangeset } from './merge-changeset';
import { Sketch, sketchesDirOf } from './sketch';
import { PlainResult, spawnPlain } from '../../../plain-output';

type GitCall = { args: string[]; input?: string };
type GitFlow<T> = Generator<GitCall, T, PlainResult>;

const runSync = <T>(target: string, flow: GitFlow<T>) => {
  let step = flow.next();

  while (!step.done)
    step = flow.next(spawnPlain(['git', ...step.value.args], { cwd: target, input: step.value.input }));

  return step.value;
};

const dirsOf = (product: ResolvedProduct) => [product.dir, ...(product.base ? [product.base.dir] : [])];

const below = (path: string, dir: string) => path === dir || path.startsWith(`${dir}${sep}`);

function* dirtyFilesFlow(product: ResolvedProduct): GitFlow<Map<string, string> | null> {
  const root = yield { args: ['rev-parse', '--show-toplevel'] };
  const status = yield {
    args: ['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', ...dirsOf(product)],
  };

  if (root.status !== 0 || status.status !== 0) return null;

  const top = realpathSync(root.stdout.trim());
  const files = status.stdout
    .split('\0')
    .filter((line) => /^.. /.test(line))
    .map((entry) => resolve(top, entry.slice(3)));
  const present = files.filter((file) => existsSync(file));
  const hashed =
    present.length > 0 ? yield { args: ['hash-object', '-w', '--stdin-paths'], input: present.join('\n') } : null;
  const hashes = hashed?.status === 0 ? hashed.stdout.trim().split('\n') : [];

  return new Map(files.map((file) => [file, hashes[present.indexOf(file)] ?? 'deleted']));
}

type Entries = Record<string, unknown>;

const entriesOf = (text: string): Entries | null => {
  try {
    const value: unknown = JSON.parse(text);

    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Entries) : null;
  } catch {
    return null;
  }
};

/**
 * HEAD's entries of a JSON file that was already dirty before the merge, with only the entries the merge changed taken
 * from the working tree; `null` when one of the three is not a JSON object.
 */
const ownEntriesOf = (texts: { head: string; before: string; work: string }) => {
  const [head, before, work] = [entriesOf(texts.head), entriesOf(texts.before), entriesOf(texts.work)];

  if (!head || !before || !work) return null;

  const changed = (key: string) => JSON.stringify(before[key]) !== JSON.stringify(work[key]);
  const own: Entries = {};

  for (const key of Object.keys(work)) {
    if (changed(key)) own[key] = work[key];
    else if (key in head) own[key] = head[key];
  }

  for (const key of Object.keys(head)) if (!(key in own) && !changed(key) && !(key in work)) own[key] = head[key];

  return `${JSON.stringify(own, null, 2)}\n`;
};

function* commitFlow(options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  before: Map<string, string> | null;
}): GitFlow<boolean> {
  const { product, sketch, before } = options;
  const after = yield* dirtyFilesFlow(product);

  if (!before || !after) return false;

  const productDir = realpathSync(product.dir);
  const sketches = sketchesDirOf(productDir);
  const merged = resolve(productDir, relative(product.dir, sketch.dir));
  const files = [...after]
    .filter(([file, hash]) => before.get(file) !== hash)
    .map(([file]) => file)
    .filter((file) => !below(file, sketches) || below(file, merged));

  if (files.length === 0) return true;

  const restore: { file: string; text: string }[] = [];

  for (const file of files) {
    const earlier = before.get(file);

    if (!file.endsWith('.json') || !earlier || earlier === 'deleted' || !existsSync(file)) continue;

    const root = yield { args: ['rev-parse', '--show-toplevel'] };
    const path = relative(realpathSync(root.stdout.trim()), file).split(sep).join('/');
    const head = yield { args: ['show', `HEAD:${path}`] };
    const blob = yield { args: ['cat-file', 'blob', earlier] };
    const text = readFileSync(file, 'utf8');
    const own =
      head.status === 0 && blob.status === 0
        ? ownEntriesOf({ head: head.stdout, before: blob.stdout, work: text })
        : null;

    if (own === null || own === text) continue;

    restore.push({ file, text });
    writeDecisionFile(file, own);
  }

  const top = yield { args: ['rev-parse', '--show-toplevel'] };
  const changeset =
    top.status === 0
      ? writeMergeChangeset({
          top: realpathSync(top.stdout.trim()),
          files,
          slug: `${sketch.target}-${options.variant}`,
        })
      : null;

  if (changeset) files.push(changeset);

  const added = yield { args: ['add', '--all', '--', ...files] };
  const committed =
    added.status === 0
      ? yield {
          args: [
            'commit',
            '-m',
            `feat(repo): Merge ${sketch.target} variant ${options.variant} into ${product.name}`,
            '--',
            ...files,
          ],
        }
      : added;

  for (const { file, text } of restore) writeDecisionFile(file, text);

  if (committed.status !== 0)
    console.warn(`Could not commit the merge: ${(committed.stderr || committed.stdout).trim()}`);

  return committed.status === 0;
}

type CommitOptions = {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  before: Map<string, string> | null;
};

/** The dirty files of the product's folders by absolute path, each with a hash of its content; `null` outside a git checkout. */
export const dirtyFilesOfSync = (options: { target: string; product: ResolvedProduct }) =>
  runSync(options.target, dirtyFilesFlow(options.product));

/**
 * Commits what a merge wrote into the product's folders - the files dirty now that were clean or different before,
 * and the merged sketch's own deletion, never another open sketch - as one commit, with a `none` changeset for each
 * workspace package they lie in when the checkout has a `.changeset` folder. A failed commit warns and leaves the files as they are.
 */
export const commitMergeResultSync = (options: CommitOptions) => runSync(options.target, commitFlow(options));
