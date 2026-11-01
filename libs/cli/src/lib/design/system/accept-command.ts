import { dirname, relative } from 'path';
import { DrawStates, storePictures } from './accepted-pictures';
import { ruleProblemsOf } from './check-system';
import { DesignConfig } from '../paths';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf } from './sketch/cli-args';
import { AcceptRefusal, acceptPart, acceptRefusalOf, readMerged } from './sketch/merged-parts';
import { parseTarget } from './sketch/sketch';
import { DesignStep, isTom, runSteps, tomConfirmRefusalOf, ttyPrompt, WriteCommandOptions } from './tom-confirm';

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

export type PartAcceptRefusal = AcceptRefusal | { reason: 'findings'; error: string; findings: string[] };

/** Why a direct edit of a part cannot be accepted - theming findings in its folder first - or `null` when it can. */
export const partAcceptRefusalOf = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
}): PartAcceptRefusal | null => {
  const findings = findingsOfPart(options);

  if (findings.length > 0)
    return {
      reason: 'findings',
      error: `${findings.join('\n')}\n${options.part} has problems - fix them before accept`,
      findings,
    };

  return acceptRefusalOf(options);
};

/** Accepts a direct edit and stores the review pictures, for a part whose {@link partAcceptRefusalOf} is `null`. */
export const acceptRunOf = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  by: string;
  note: string;
  draw?: DrawStates;
}): DesignStep => {
  const { target, config, product, part, by, note } = options;

  return {
    line: `accept ${product.name} ${part} - ${note}`,
    run: async () => {
      const problem = acceptPart({ product, part, by, note });

      if (problem) {
        console.error(problem);

        return 1;
      }

      console.log(`accepted the direct edit of ${part} in ${product.name}`);

      const unstored = await storePictures({
        target,
        config,
        product,
        part,
        kind: 'review',
        hash: readMerged(product.dir)[part] ?? '',
        draw: options.draw,
      });

      if (unstored) console.warn(`PICTURES NOT STORED ${part}: ${unstored} - design check draws them`);

      return 0;
    },
  };
};

/** An acceptance of a direct edit of one part as a step, or why it may not run. */
export const acceptStepOf = (options: {
  target: string;
  product: string | undefined;
  part: string;
  by: string;
  note: string;
  draw?: DrawStates;
}): DesignStep | string => {
  const { target, by, note } = options;
  const config = configOf(target);

  if (typeof config === 'string') return config;

  const parsed = parseTarget(options.part);

  if (typeof parsed === 'string') return parsed;

  const product = oneProductOf({ target, config, asked: options.product });

  if (typeof product === 'string') return product;

  const part = partKeyOf(parsed);
  const refusal = partAcceptRefusalOf({ target, product, part });

  if (refusal) return refusal.error;

  return acceptRunOf({ target, config, product, part, by, note, draw: options.draw });
};

/**
 * `et design accept <layer>/<name> …` records a direct edit of a merged part the user approved, so check stops warning
 * of it. `--by tom` needs Tom's confirm at a terminal.
 */
export const designAccept = async (options: WriteCommandOptions) => {
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

  const step = acceptStepOf({
    target,
    product: args.values['--product'],
    part: args.positional[0] ?? '',
    by,
    note,
    draw: options.draw,
  });

  if (typeof step === 'string') {
    console.error(step);

    return 1;
  }

  if (isTom(by)) {
    const refusal = await tomConfirmRefusalOf({ steps: [step], invocation, prompt: options.prompt ?? ttyPrompt() });

    if (refusal) {
      console.error(refusal);

      return 1;
    }
  }

  return runSteps([step]);
};
