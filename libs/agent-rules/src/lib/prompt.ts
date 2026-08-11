import { createInterface } from 'readline/promises';

/**
 * Without a TTY there is nobody to ask, so an unattended run must pass `--yes` explicitly rather
 * than have silence read as consent.
 */
export const confirm = async (options: { question: string; assumeYes: boolean }) => {
  if (options.assumeYes) return true;

  if (!process.stdin.isTTY) {
    console.error('Nothing to prompt on (no TTY). Re-run with --yes to proceed unattended.');

    return false;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await readline.question(`${options.question} [y/N] `);

    return /^y(es)?$/i.test(answer.trim());
  } finally {
    readline.close();
  }
};
