import { writeJsonFile } from '../../json-file';
import { existsSync, readFileSync } from 'fs';
import { relative, resolve } from 'path';
import { implementationBaselineFileOf } from './implementation-baseline';
import { IMPLEMENTED_FILE } from './part-task';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const pruneFile = (options: { root: string; file: string }) => {
  const { root, file } = options;

  if (!existsSync(file)) return [];

  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

  if (!isRecord(parsed)) return [];

  const dropped: string[] = [];

  Object.entries(parsed).forEach(([part, entry]) => {
    if (!isRecord(entry)) return;

    const hashes = [entry['files'], entry['app']].filter(isRecord);
    const gone = [
      ...new Set(hashes.flatMap((map) => Object.keys(map)).filter((path) => !existsSync(resolve(root, path)))),
    ];

    gone.forEach((path) => {
      hashes.forEach((map) => delete map[path]);
      dropped.push(`${relative(root, file)}: ${part} - ${path}`);
    });
  });

  if (dropped.length > 0) writeJsonFile({ file, value: parsed });

  return dropped;
};

/**
 * Drops each file that no longer exists in `root` from the file hashes of the product's implemented.json and the app
 * pins of its implementation-baseline.json, and returns one line per dropped path and part.
 */
export const pruneDeletedAppFiles = (options: { root: string; productDir: string }) => [
  ...pruneFile({ root: options.root, file: resolve(options.productDir, IMPLEMENTED_FILE) }),
  ...pruneFile({ root: options.root, file: implementationBaselineFileOf(options.productDir) }),
];
