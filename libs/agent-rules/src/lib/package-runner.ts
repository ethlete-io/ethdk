import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RUNNERS = { yarn: 'yarn', pnpm: 'pnpm exec', bun: 'bunx', npm: 'npx' } as const;

type PackageManagerName = keyof typeof RUNNERS;

const LOCKFILES: [string, PackageManagerName][] = [
  ['yarn.lock', 'yarn'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

const declaredManager = (root: string): PackageManagerName | undefined => {
  const path = join(root, 'package.json');

  if (!existsSync(path)) return undefined;

  try {
    const { packageManager } = JSON.parse(readFileSync(path, 'utf8')) as { packageManager?: unknown };

    if (typeof packageManager !== 'string') return undefined;

    return (Object.keys(RUNNERS) as PackageManagerName[]).find((name) => packageManager.startsWith(`${name}@`));
  } catch {
    return undefined;
  }
};

export const detectPackageRunner = (root: string) => {
  const manager = declaredManager(root) ?? LOCKFILES.find(([fileName]) => existsSync(join(root, fileName)))?.[1];

  return RUNNERS[manager ?? 'npm'];
};
