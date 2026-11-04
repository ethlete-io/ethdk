import { DesignConfig } from '../../paths';
import { ShootStates } from '../compare-command';
import { StartHarnessServer } from '../harness-server';
import { Problem } from '../problem';
import { checkVisibleChange } from '../visible-change-command';

export const VISIBLE_CHANGE_RULE = 'VISIBLE-CHANGE';

/**
 * One `VISIBLE-CHANGE` problem per harness part whose app looks different from the base without a picked or merged
 * sketch, and one on `(product)` for a run that could not judge the product.
 */
export const visibleChangeProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: string;
  harnessMap: string;
  base: string | undefined;
  parts?: string[];
  shoot?: ShootStates;
  start?: StartHarnessServer;
}): Promise<Map<string, Problem[]>> => {
  const problems = new Map<string, Problem[]>();
  const add = (part: string, message: string) =>
    problems.set(part, [
      ...(problems.get(part) ?? []),
      { rule: VISIBLE_CHANGE_RULE, file: options.harnessMap, message },
    ]);

  await checkVisibleChange({
    target: options.target,
    config: options.config,
    products: [options.product],
    base: options.base,
    parts: options.parts,
    shoot: options.shoot,
    start: options.start,
    onVerdict: ({ verdict, line }) => {
      if (!verdict.pass) add(verdict.part, line.replace(/^FAIL [^:]+: /u, ''));
    },
    onProblem: ({ line }) => add('(product)', line),
  });

  return problems;
};
