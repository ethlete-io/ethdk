import { PrepushChange } from './prepush-changes';

const SOURCE = /\.[cm]?tsx?$/u;
const SPEC = /\.spec\.[cm]?tsx?$/u;

/**
 * The files under `root` to hand to `vitest related`: each changed or added TS file, and the existing
 * `<stem>.spec.ts` next to every other changed file (a template, a stylesheet) and next to a deleted source,
 * which no import graph reaches.
 */
export const relatedFilesOf = (options: {
  changes: PrepushChange[];
  root: string;
  exists: (file: string) => boolean;
}): string[] => {
  const { changes, root, exists } = options;
  const files = changes
    .filter(({ file }) => file.startsWith(root))
    .flatMap(({ status, file }) => {
      if (SOURCE.test(file) && status !== 'D') return [file];

      if (SPEC.test(file)) return [];

      const spec = `${file.replace(/\.[^./]+$/u, '')}.spec.ts`;

      return exists(spec) ? [spec] : [];
    });

  return [...new Set(files)];
};
