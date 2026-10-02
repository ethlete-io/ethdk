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

const readManifest = (root: string) => {
  const path = join(root, 'package.json');

  if (!existsSync(path)) return undefined;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as {
      packageManager?: unknown;
      scripts?: Record<string, unknown>;
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
  } catch {
    return undefined;
  }
};

const declaredManager = (root: string): PackageManagerName | undefined => {
  const packageManager = readManifest(root)?.packageManager;

  if (typeof packageManager !== 'string') return undefined;

  return (Object.keys(RUNNERS) as PackageManagerName[]).find((name) => packageManager.startsWith(`${name}@`));
};

const detectPackageManagerName = (root: string): PackageManagerName =>
  declaredManager(root) ?? LOCKFILES.find(([fileName]) => existsSync(join(root, fileName)))?.[1] ?? 'npm';

export const detectPackageRunner = (root: string) => RUNNERS[detectPackageManagerName(root)];

export const readScripts = (root: string) => {
  const manifest = readManifest(root);

  if (!manifest) return undefined;

  return new Set(manifest.scripts && typeof manifest.scripts === 'object' ? Object.keys(manifest.scripts) : []);
};

const SCRIPT_RUNNERS: Record<PackageManagerName, string> = {
  yarn: 'yarn run',
  pnpm: 'pnpm run',
  bun: 'bun run',
  npm: 'npm run',
};

export const detectCommandVars = (root: string): Record<string, string> => {
  const manager = detectPackageManagerName(root);
  const manifest = readManifest(root);
  const scripts = readScripts(root) ?? new Set<string>();
  const script = (name: string, ...args: string[]) =>
    [SCRIPT_RUNNERS[manager], name, ...(args.length && manager === 'npm' ? ['--'] : []), ...args].join(' ');
  const hasNx =
    Boolean(manifest?.devDependencies?.['nx'] ?? manifest?.dependencies?.['nx']) || existsSync(join(root, 'nx.json'));
  const vars: Record<string, string> = {};

  if (scripts.has('lint')) {
    vars['lintCommand'] = script('lint');
    vars['lintFixCommand'] = script('lint', '--fix');
  } else if (hasNx) {
    vars['lintCommand'] = `${RUNNERS[manager]} nx lint <project>`;
    vars['lintFixCommand'] = `${RUNNERS[manager]} nx lint <project> --fix`;
  }

  if (scripts.has('storybook')) vars['storybookStartCommand'] = script('storybook');

  return vars;
};
