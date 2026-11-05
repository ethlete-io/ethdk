import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG = '.ethlete/design/config.json';
const DESIGN_DIR = '.ethlete/design';
const RULES_DIR = 'libs/cli/src/lib/design/';
const CLI = 'dist/libs/cli/src/index.js';

const asDir = (path) => (path.endsWith('/') ? path : `${path}/`);

/** The products whose design, base design or harness app `files` touch; every product when the design rules change. */
export const productsToCheck = (config, files) =>
  Object.entries(config?.products ?? {})
    .filter(([name, entry]) => {
      const dirs = [
        `${DESIGN_DIR}/${name}/`,
        ...(entry.base ? [asDir(entry.base)] : []),
        ...(entry.harness?.app ? [asDir(entry.harness.app)] : []),
        RULES_DIR,
      ];

      return files.some((file) => file === CONFIG || dirs.some((dir) => file.startsWith(dir)));
    })
    .map(([name]) => name);

const run = (root, command, args) =>
  spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
  });

const report = (result) => {
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
};

export const checkDesignRules = (root, base, head) => {
  const configPath = join(root, CONFIG);

  if (!existsSync(configPath)) return 0;

  const changed = run(root, 'git', ['diff', '--name-only', base, head]).stdout.split('\n').filter(Boolean);
  const products = productsToCheck(JSON.parse(readFileSync(configPath, 'utf8')), changed);

  if (products.length === 0) return 0;

  const build = run(root, 'npx', ['nx', 'build', 'cli', '--outputStyle=static']);

  if (build.status !== 0) {
    report(build);
    console.error('design-rules-gate: the cli does not build (above).');

    return 1;
  }

  const check = run(root, 'node', [
    CLI,
    'design',
    'check',
    '--product',
    ...products,
    '--rules',
    '--base',
    `${base}..${head}`,
  ]);

  if (check.status === 0) return 0;

  report(check);
  console.error(`design-rules-gate: design check --rules fails for ${products.join(', ')} (above).`);

  return 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, head] = process.argv.slice(2);
  process.exit(checkDesignRules(process.cwd(), base, head));
}
