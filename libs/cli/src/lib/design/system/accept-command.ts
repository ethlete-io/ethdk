import { dirname, relative } from 'path';
import { ruleProblemsOf } from './check-system';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf } from './sketch/cli-args';
import { acceptPart } from './sketch/merged-parts';
import { parseTarget } from './sketch/sketch';

export const ACCEPT_USAGE =
  'accept <layer>/<name> --product <name> --by <model id> --note <why the user approved the direct edit>';

const THEMING_CLASS_RULES = new Set(['CLASS-UNDEFINED', 'DENIED-CLASS', 'DENIED-STYLESHEET']);

const findingsOfPart = (options: { target: string; product: ResolvedProduct; part: string }) => {
  const found = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!found) return [];

  const dir = dirname(found.file);

  return ruleProblemsOf(options.product)
    .filter((problem) => THEMING_CLASS_RULES.has(problem.rule) && !relative(dir, problem.file).startsWith('..'))
    .map((problem) => `${problem.rule} ${relative(options.target, problem.file)}: ${problem.message}`);
};

/** `et design accept <layer>/<name> …` records a direct edit of a merged part the user approved, so check stops warning of it. */
export const designAccept = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--by', '--note']);
  const usage = `usage: ${invocation} ${ACCEPT_USAGE}`;

  if (typeof args === 'string') {
    console.error(args);
    console.error(usage);

    return 2;
  }

  const by = authorOf(args);
  const note = args.values['--note']?.trim();

  if (by === null || !note || args.positional.length !== 1) {
    if (by === null) console.error(`accept ${NEEDS_AUTHOR}`);
    if (!note) console.error('accept needs --note <why the user approved the direct edit>');

    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  const parsed = parseTarget(args.positional[0]);

  if (typeof parsed === 'string') {
    console.error(parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const part = partKeyOf(parsed);
  const findings = findingsOfPart({ target, product, part });

  if (findings.length > 0) {
    console.error(`${findings.join('\n')}\n${part} has problems - fix them before accept`);

    return 1;
  }

  const problem = acceptPart({ product, part, by, note });

  if (problem) {
    console.error(problem);

    return 1;
  }

  console.log(`accepted the direct edit of ${part} in ${product.name}`);

  return 0;
};
