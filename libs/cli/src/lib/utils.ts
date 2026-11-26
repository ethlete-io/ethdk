import { createInterface } from 'readline/promises';

export const askQuestion = async (question: string) => {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await readline.question(question);
  } finally {
    readline.close();
  }
};

export type ConfirmOptions = {
  /** What is wrong, or what is about to happen. Printed above the question. */
  problem: string;
  question: string;
  /** Printed instead of the question when no terminal can answer it. It names the flag that skips it. */
  hint: string;
  /** What an empty answer means. Pass `false` for anything that deletes. */
  defaultsToYes: boolean;
};

/**
 * Asks a yes or no question. Without a terminal it prints the hint and answers no, so nothing
 * applies itself in a script that cannot be asked.
 */
export const confirm = async ({ problem, question, hint, defaultsToYes }: ConfirmOptions) => {
  if (!process.stdin.isTTY) {
    console.error(`${problem}\n\n${hint}`);

    return false;
  }

  const answer = (await askQuestion(`${problem}\n\n${question} ${defaultsToYes ? '[Y/n]' : '[y/N]'} `)).trim();

  return defaultsToYes ? !/^n(o)?$/i.test(answer) : /^y(es)?$/i.test(answer);
};
