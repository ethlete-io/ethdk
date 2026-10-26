import { existsSync, globSync } from 'fs';
import { relative, resolve } from 'path';
import { callsRootOf } from './paths';
import { callSlugOf } from './vite-paths';

export const CALLS_PATH = '/__design/calls';

/** Every `call.ts` below a folder, as absolute paths in slug order. */
export const callFilesOf = (folder: string) =>
  existsSync(folder)
    ? globSync('**/call.ts', { cwd: folder })
        .sort()
        .map((file) => resolve(folder, file))
    : [];

export const callSlugsOf = (target: string) => {
  const root = callsRootOf(target);

  return callFilesOf(root).map((file) => callSlugOf(relative(root, file)));
};

type CallModule = {
  default: {
    eyebrow: string;
    headline: string;
    stage?: string;
    legacy?: true;
    transferred?: true;
    closed?: string;
    frameWidth: number;
    variants: { key: string; name: string }[];
  };
};

export type ListedCall =
  | {
      slug: string;
      project: string;
      eyebrow: string;
      headline: string;
      stage: string | null;
      legacy: boolean;
      transferred: boolean;
      closed: string | null;
      frameWidth: number;
      variants: { key: string; name: string }[];
    }
  | { slug: string; project: string; error: string };

/** The calls of every project, each read through `load`, which answers with the module of a `call.ts`. */
export const listCalls = async (options: {
  target: string;
  load: (file: string) => Promise<unknown>;
}): Promise<ListedCall[]> => {
  const { target, load } = options;
  const root = callsRootOf(target);

  return Promise.all(
    callSlugsOf(target).map(async (slug): Promise<ListedCall> => {
      const project = slug.split('/')[0] ?? '';

      try {
        const call = ((await load(resolve(root, slug, 'call.ts'))) as CallModule).default;

        return {
          slug,
          project,
          eyebrow: call.eyebrow,
          headline: call.headline,
          stage: call.stage ?? null,
          legacy: call.legacy === true,
          transferred: call.transferred === true,
          closed: call.closed ?? null,
          frameWidth: call.frameWidth,
          variants: call.variants.map((variant) => ({ key: variant.key, name: variant.name })),
        };
      } catch (error) {
        return { slug, project, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
};
