import { goBatch } from './go-batch';
import { goStepOf } from './go-step';
import { argsOf, authorOf, NEEDS_AUTHOR } from './sketch/cli-args';
import { isTom, runSteps, tomConfirmRefusalOf, ttyPrompt, WriteCommandOptions } from './tom-confirm';

export const GO_USAGE =
  'go <layer>/<name> --product <name> --by <name> [--note "Impl Qnn"] | go --batch <file> (Tom confirms every entry)';

/** `et design go <layer>/<name> …` releases a part for implementation at its current hash; `--batch` runs a go list. */
export const designGo = async (options: WriteCommandOptions) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--by', '--note', '--batch']);
  const usage = `usage: ${invocation} ${GO_USAGE}`;
  const prompt = options.prompt ?? ttyPrompt();

  if (typeof args !== 'string' && args.values['--batch'] !== undefined && args.positional.length === 0)
    return goBatch({ target, file: args.values['--batch'], invocation, draw: options.draw, prompt });

  const by = typeof args === 'string' ? null : authorOf(args);

  if (typeof args === 'string' || by === null || args.positional.length !== 1 || args.values['--batch']) {
    if (typeof args === 'string') console.error(args);
    else if (by === null) console.error(`go ${NEEDS_AUTHOR}`);

    console.error(usage);

    return 2;
  }

  const step = goStepOf({
    target,
    product: args.values['--product'],
    part: args.positional[0] ?? '',
    by,
    note: args.values['--note']?.trim() || undefined,
    draw: options.draw,
  });

  if (typeof step === 'string') {
    console.error(step);

    return 1;
  }

  if (isTom(by)) {
    const refusal = await tomConfirmRefusalOf({ steps: [step], invocation, prompt });

    if (refusal) {
      console.error(refusal);

      return 1;
    }
  }

  return runSteps([step]);
};
