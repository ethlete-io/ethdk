import { createInterface } from 'readline';
import { DrawStates } from './accepted-pictures';

/** The terminal a `--by tom` write asks: whether stdin is a TTY, and how to ask one question there. */
export type TomPrompt = { isTTY: boolean; ask: (question: string) => Promise<string> };

/** One prepared go or accept: the line Tom confirms, and the write it runs, answering its exit code. */
export type DesignStep = { line: string; run: () => Promise<number> };

/** Options shared by `design go` and `design accept`. */
export type WriteCommandOptions = {
  target: string;
  argv: string[];
  invocation: string;
  draw?: DrawStates;
  prompt?: TomPrompt;
};

export const isTom = (by: string) => by.trim().toLowerCase() === 'tom';

export const ttyPrompt = (): TomPrompt => ({
  isTTY: !!process.stdin.isTTY,
  ask: (question) =>
    new Promise((resolve) => {
      const terminal = createInterface({ input: process.stdin, output: process.stdout });

      terminal.question(question, (answer) => {
        terminal.close();
        resolve(answer);
      });
    }),
});

/**
 * Shows every step to Tom and asks once; answers why nothing may run, or `null` after a yes. Without a TTY it refuses,
 * so an agent cannot give the confirm.
 */
export const tomConfirmRefusalOf = async (options: { steps: DesignStep[]; invocation: string; prompt: TomPrompt }) => {
  const { steps, invocation, prompt } = options;

  if (!prompt.isTTY)
    return `--by tom needs Tom at a terminal, and stdin is not a TTY: write the entries to a go list and let Tom run \`${invocation} go --batch <file>\`, or give the go in Studio`;

  console.log(steps.map((step) => `  ${step.line}`).join('\n'));

  const answer = await prompt.ask(`Record ${steps.length === 1 ? 'this' : `these ${steps.length}`} as Tom? [y/N] `);

  return /^y(es)?$/i.test(answer.trim()) ? null : 'not confirmed - nothing recorded';
};

/** Runs the steps in order and answers 1 when any failed. */
export const runSteps = async (steps: DesignStep[]) => {
  let code = 0;

  for (const step of steps) code = Math.max(code, await step.run());

  return code;
};
