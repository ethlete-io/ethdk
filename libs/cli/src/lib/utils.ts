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
