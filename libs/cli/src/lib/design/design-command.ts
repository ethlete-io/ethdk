import { resolve } from 'path';
import { checkDesign } from './check';
import { serveDesign } from './serve';

/** Reads `--checkout <path>` out of an argument list, and answers with the path and the rest. */
const splitCheckout = (argv: string[], root: string) => {
  const index = argv.indexOf('--checkout');

  if (index === -1) return { target: root, rest: argv };

  return { target: resolve(root, argv[index + 1] ?? '.'), rest: [...argv.slice(0, index), ...argv.slice(index + 2)] };
};

const helpOf = (invocation: string) =>
  [
    `${invocation} [checkout]`,
    '  Serve the variant frames of a checkout. The checkout defaults to the working directory.',
    '',
    `${invocation} check [--lint <file>…] [--tsconfig [path]] [--call <slug> [--variant <key>]]`,
    '  Find out why a call does not render: eslint, then tsc, then the live frames.',
    '',
    'Every command takes --checkout <path>. DE_PORT overrules the port in .ethlete/design/config.json.',
    '',
  ].join('\n');

/**
 * `et design [checkout]` serves the variant frames of a checkout, and `et design check …` says why
 * a call does not render. Both work on any checkout that keeps a `.ethlete/design` folder, so a
 * repository needs no design tooling of its own.
 */
export const designCommand = async (options: { root: string; argv: string[]; invocation: string }): Promise<number> => {
  const { root, argv, invocation } = options;

  if (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    console.log(helpOf(invocation));

    return 0;
  }

  if (argv[0] === 'check') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return checkDesign({ target, argv: rest, invocation });
  }

  const { target, rest } = splitCheckout(argv, root);
  const positional = rest[0];

  return serveDesign({ target: positional ? resolve(root, positional) : target });
};
