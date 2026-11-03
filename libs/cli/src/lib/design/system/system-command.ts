import { configPathOf, readConfig } from '../paths';
import { createDesignServer } from '../serve';
import { listSystem } from './list-system';
import { argsOf } from './sketch/cli-args';
import { createSystemModules, productModuleIdOf } from './system-modules';

/**
 * `et design system --json [--product <name>]` prints the parts list the design server answers on
 * `/__design/system`, loading each part through the same Vite setup.
 */
export const designSystem = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product'], ['--json']);
  const usage = `usage: ${invocation} system --json [--product <name>]`;
  const asked = typeof args === 'string' ? null : (args.values['--product'] ?? null);

  if (typeof args === 'string' || !args.flags.has('--json') || args.positional.length > 0) {
    console.error(typeof args === 'string' ? `${args}\n${usage}` : usage);

    return 2;
  }

  const config = readConfig(target);

  if (!config) {
    console.error(`design-explore: no config at ${configPathOf(target)}`);

    return 1;
  }

  const declared = Object.keys(config.products ?? {});

  if (asked && !declared.includes(asked)) {
    console.error(`NO PRODUCT "${asked}" - config.json declares ${declared.join(', ') || 'none'}.`);

    return 1;
  }

  const vite = await createDesignServer({ target, config, listen: false });

  try {
    const products = await listSystem({
      target,
      system: createSystemModules({ target, config }),
      products: asked ? [asked] : declared,
      load: ({ file, product }) => vite.ssrLoadModule(productModuleIdOf({ file, product })),
    });

    console.log(JSON.stringify(products, null, 2));

    return 0;
  } finally {
    await vite.close();
  }
};
