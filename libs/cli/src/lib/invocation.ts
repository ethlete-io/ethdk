import { readFileSync } from 'fs';
import { join } from 'path';

type Manifest = { packageManager?: string; scripts?: Record<string, string> };

/**
 * How each package manager runs a script, and how it runs a binary from `node_modules` when no
 * script wraps it.
 */
const RUNNERS = [
  { name: 'yarn', script: 'yarn', binary: 'yarn et' },
  { name: 'pnpm', script: 'pnpm', binary: 'pnpm exec et' },
  { name: 'bun', script: 'bun run', binary: 'bunx et' },
  { name: 'npm', script: 'npm run', binary: 'npx et' },
];

const readManifest = (root: string): Manifest => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    return {};
  }

  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Manifest) : {};
};

const runnerFor = (manifest: Manifest) => {
  const declared = manifest.packageManager ?? process.env['npm_config_user_agent'];

  return declared ? RUNNERS.find((runner) => declared.startsWith(runner.name)) : undefined;
};

const scriptFor = (manifest: Manifest, command: string) =>
  Object.entries(manifest.scripts ?? {}).find(([, value]) => value.trim() === command)?.[0];

/**
 * What the reader of a message can type to reach `et <subcommand>` in this repo, because `et` itself
 * is rarely on the PATH: the package script that wraps it, or the package manager's own way to run
 * the binary, for example `npx et api`.
 */
export const repoInvocation = (options: { root: string; subcommand: string }) => {
  const { root, subcommand } = options;
  const manifest = readManifest(root);
  const runner = runnerFor(manifest);

  if (!runner) return `et ${subcommand}`;

  const script = scriptFor(manifest, `et ${subcommand}`);

  return script ? `${runner.script} ${script}` : `${runner.binary} ${subcommand}`;
};
